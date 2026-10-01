import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDatabase } from '../config/database.js';
import { WhatsAppContact } from '../models/whatsappContact.model.js';
import { listRows } from '../services/legacyStore.service.js';
import { buildDailyAdminReportAttachment, buildWeeklySuperAdminReportAttachment } from '../services/whatsappWeeklyReport.service.js';
import { sendWhatsAppText } from '../services/aknexusWhatsApp.service.js';

const recipients = ['AS101', 'MS101'];
const empId = (row) => String(row?.['Employee ID'] || row?.employeeId || row?.['User ID'] || row?.EmpID || '').trim();
const active = (row) => !/^(inactive|disabled|terminated|deleted)$/i.test(String(row?.Status || row?.status || '').trim());
function scopedIdsFor(allUsers, scopeEmployeeId) {
  const activeIds = new Set(allUsers.filter(active).map(empId).filter(Boolean));
  const scoped = new Set([scopeEmployeeId]);
  for (const user of allUsers) {
    const id = empId(user);
    const refs = [user['Manager ID'], user.Manager, user['Reporting Manager'], user.managerId, user['Task Approver'], user['Approver ID'], user.taskApprover, user['HR ID'], user.HR, user['Admin ID']]
      .flatMap((value) => String(value || '').split(/[,;|]/).map((item) => item.trim()).filter(Boolean));
    if (refs.some((ref) => ref.toLowerCase() === scopeEmployeeId.toLowerCase()) && id) scoped.add(id);
  }
  for (const id of [...scoped]) if (!activeIds.has(id)) scoped.delete(id);
  return scoped;
}
try {
  await connectDatabase();
  const allUsers = await listRows('User');
  const results = [];
  for (const employeeId of recipients) {
    const contact = await WhatsAppContact.findOne({ employeeId: new RegExp(`^${employeeId}$`, 'i') }).lean();
    if (!contact) throw new Error(`No saved WhatsApp contact found for ${employeeId}.`);
    if (!contact.enabled) throw new Error(`WhatsApp contact for ${employeeId} is disabled.`);
    const scopedIds = scopedIdsFor(allUsers, employeeId);
    const readScopedRows = async (model) => {
      const rows = await listRows(model);
      if (!['Ticket', 'Todo', 'FmsTask', 'Attendance', 'Leave', 'Intimation'].includes(model)) return rows;
      return rows.filter((row) => scopedIds.has(empId(row)));
    };
    const daily = await buildDailyAdminReportAttachment({ readRows: listRows, now: new Date(), scopeEmployeeId: employeeId });
    const dailyResult = await sendWhatsAppText({
      contactId: String(contact._id),
      message: `Test previous-day admin report generated according to ${employeeId} scope.\n\n${daily.message}`,
      pdfAttachment: daily.pdfAttachment,
      alertType: 'manual',
      entityId: `TEST-DAILY-${employeeId}-${daily.pdfAttachment.fileName}`,
      auth: { sub: 'codex', role: 'Super Admin' }
    });
    results.push({ employeeId, type: 'previous-day', success: dailyResult.success, fileName: daily.pdfAttachment.fileName, scopedEmployees: scopedIds.size });
    const weekly = await buildWeeklySuperAdminReportAttachment({ readRows: readScopedRows, now: new Date() });
    const weeklyResult = await sendWhatsAppText({
      contactId: String(contact._id),
      message: `Test weekly admin report generated according to ${employeeId} scope.\n\n${weekly.message}`,
      pdfAttachment: weekly.pdfAttachment,
      alertType: 'manual',
      entityId: `TEST-WEEKLY-${employeeId}-${weekly.pdfAttachment.fileName}`,
      auth: { sub: 'codex', role: 'Super Admin' }
    });
    results.push({ employeeId, type: 'weekly', success: weeklyResult.success, fileName: weekly.pdfAttachment.fileName, scopedEmployees: scopedIds.size });
  }
  console.log(JSON.stringify(results, null, 2));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
}
