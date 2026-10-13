import crypto from 'node:crypto';
import { WhatsAppAlertJob } from '../models/whatsappAlertJob.model.js';
import { WhatsAppContact } from '../models/whatsappContact.model.js';
import { listRows } from './legacyStore.service.js';
import { onRowSaved } from './rowEvents.service.js';
import { getAknexusStatus, sendWhatsAppText } from './aknexusWhatsApp.service.js';
import { buildRowAlerts, buildDailyAlerts, employeeIdOf, isActive, istClock, field } from './whatsappAlertRules.js';
import { buildClientTicketAlerts, clientAlertRecipientStillAllowed, clientIdOf, clientNameOf, clientPhoneOf } from './whatsappClientAlerts.js';
import { normalizeWhatsAppPhone } from './whatsappContacts.service.js';
import { findOneRowByFilter } from './legacyStore.service.js';
import {
  buildDailyAdminReportAttachment,
  buildWeeklySuperAdminReportAttachment,
  dailyAdminReportDateForJob,
  isDailyAdminReportJob,
  isWeeklySuperAdminReportJob,
  queueDailyAdminReports,
  queueWeeklySuperAdminReports,
  weeklyReportDateForJob
} from './whatsappWeeklyReport.service.js';

const readTicket = (id) => findOneRowByFilter('Ticket', { $or: [{ 'data.Ticket ID': id }, { 'data.ID': id }, { legacyId: id }] });

const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');
const mandatoryDailyReminder = (event = '') => /^(pending-tasks|no-ticket-after-present):/.test(String(event));

export function isAllowedRecipientAlert(event, users = []) {
  if (!event?.employeeId) return false;
  const user = (users || []).find((u) => employeeIdOf(u) === event.employeeId);
  if (!user) return true;
  const role = String(field(user, ['Role', 'role']) || '').toLowerCase();
  const isAdminOrHr = /^(admin|super admin|hr)$/.test(role);
  if (!isAdminOrHr) return true;

  const eventName = String(event.event || '');

  // 1. Attendance approval requested must NEVER reach Admin, Super Admin, or HR:
  if (/^attendance\s+approval\s+requested/i.test(eventName)) return false;

  // 2. Only Leave & Intimation approval requests from employees are allowed for Admin, Super Admin, HR:
  if (event.alertType === 'approval' && /^(leave|intimation)\s+approval\s+requested/i.test(eventName)) {
    return true;
  }

  // 3. Any other approval requests from employees (Ticket, Expense, Attendance, etc.) are blocked for Admin/HR:
  if (event.alertType === 'approval' && /approval\s+requested/i.test(eventName)) {
    return false;
  }

  // 4. Their OWN messages are strictly permitted:
  if (/^(pending-tasks|no-ticket-after-present):/.test(eventName)) return true;
  if (/^(daily-admin-report|weekly-super-admin-report|attendance-summary):/.test(eventName)) return true;
  if (/^(missed-in|missed-out):/.test(eventName)) return true;
  if (event.alertType === 'attendance' && /^punch\s*(in|out)/i.test(eventName)) return true;
  if (event.alertType === 'ticket') return true;
  if (event.alertType === 'fms') return true;
  if (event.alertType === 'expense') return true;
  if (/^(leave|intimation)\s*(submitted|approved|rejected)/i.test(eventName)) return true;

  // By default, if it's an unsolicited approval broadcast, block it for Admin/Super Admin/HR:
  if (event.alertType === 'approval') return false;

  return true;
}

let stop = null;
export async function enqueueAlerts(events, users, revision = '') {
  if (!events.length) return;
  // Strictly prohibit client alerts: Only active employees can receive WhatsApp alerts
  // and enforce Admin/Super Admin/HR recipient restrictions (only own alerts & Leave/Intimation approvals)
  const validEvents = events.filter((e) => !e.clientId && e.employeeId && isAllowedRecipientAlert(e, users));
  if (!validEvents.length) return;

  const employeeIds = [...new Set(validEvents.map((e) => e.employeeId))];
  const contacts = await WhatsAppContact.find({ enabled: true, employeeId: { $in: employeeIds } }).lean();

  // If any active employee in events lacks a contact, auto-provision from their active User record
  const missingIds = employeeIds.filter((id) => !contacts.some((c) => c.employeeId === id));
  if (missingIds.length && Array.isArray(users)) {
    for (const id of missingIds) {
      const user = users.find((u) => employeeIdOf(u) === id);
      if (user && isActive(user)) {
        const rawPhone = field(user, ['Mobile Number', 'Mobile', 'Phone No', 'Phone', 'phone', 'mobile']);
        const phone = normalizeWhatsAppPhone(rawPhone);
        if (phone) {
          try {
            const name = field(user, ['Employee Name', 'User Name', 'Name', 'name']) || id;
            const dept = field(user, ['Department', 'department']);
            const newContact = await WhatsAppContact.findOneAndUpdate(
              { employeeId: id },
              { $set: { employeeId: id, clientId: '', name, phone, department: dept, enabled: true, alertTypes: ['ticket', 'approval', 'reminder', 'attendance', 'expense', 'fms'], updatedBy: 'system' } },
              { upsert: true, new: true }
            ).lean();
            if (newContact) contacts.push(newContact);
          } catch (err) {
            console.warn(`[WhatsApp] Auto-contact failed for ${id}: ${err.message}`);
          }
        }
      }
    }
  }

  const queuedMessages = new Set();
  for (const event of validEvents) {
    const requiredReminder = mandatoryDailyReminder(event.event);
    const contact = contacts.find((c) => c.employeeId === event.employeeId && (requiredReminder || c.alertTypes.includes(event.alertType)));
    if (!contact || !isActive(users.find((u) => employeeIdOf(u) === event.employeeId))) continue;
    const messageKey = hash(JSON.stringify([event.employeeId, event.entityId, event.message]));
    if (queuedMessages.has(messageKey)) continue;
    const key = hash(JSON.stringify([event.employeeId, event.alertType, event.entityId, event.event, revision]));
    try {
      await WhatsAppAlertJob.updateOne({ key }, { $setOnInsert: { key, employeeId: event.employeeId, contactId: contact._id, alertType: event.alertType, entityId: event.entityId, event: event.event, message: event.message, state: 'pending' } }, { upsert: true });
      queuedMessages.add(messageKey);
    } catch (error) { if (error.code !== 11000) throw error; }
  }
}

export async function processNextAlert({ readUsers = () => listRows('User'), readRows = listRows, findTicket = readTicket, send = sendWhatsAppText, now = () => new Date(), reportsOnly = false } = {}) {
  if (!(await getAknexusStatus()).connected) return false;
  const pendingQuery = reportsOnly
    ? { state: 'pending', event: { $regex: '^(weekly-super-admin-report|daily-admin-report|attendance-summary):' } }
    : { state: 'pending' };
  const job = await WhatsAppAlertJob.findOneAndUpdate(pendingQuery, { $set: { state: 'processing', startedAt: new Date() } }, { new: true, sort: { createdAt: 1 } }).lean();
  if (!job) return false;
  let state = 'skipped';
  let error = '';
  try {
    if (job.clientId) {
      // Client WhatsApp alerts are strictly forbidden
      state = 'skipped';
      error = 'Client WhatsApp alerts are permanently disabled.';
    } else {
      let contact = job.contactId ? await WhatsAppContact.findById(job.contactId).lean() : null;
      if (!contact && job.employeeId) {
        contact = await WhatsAppContact.findOne({ employeeId: job.employeeId, enabled: true }).lean();
      }
      const users = await readUsers();
      const special = /^client-(created|chat):/.test(job.event || '');
      const weeklyReport = isWeeklySuperAdminReportJob(job);
      const dailyAdminReport = isDailyAdminReportJob(job);
      const requiredReminder = mandatoryDailyReminder(job.event);
      const active = isActive(users.find((user) => employeeIdOf(user) === job.employeeId))
        && (!special || clientAlertRecipientStillAllowed(job, await findTicket(job.entityId), users, []));
      // Enforce recipient restrictions: Admin/Super Admin/HR only receive their own alerts and Leave/Intimation approvals.
      if (!isAllowedRecipientAlert(job, users)) {
        state = 'skipped';
        error = 'Blocked: Admin, Super Admin, and HR only receive their own alerts and Leave/Intimation approvals.';
      } else if (contact?.enabled && contact.employeeId === job.employeeId && (requiredReminder || contact.alertTypes.includes(job.alertType)) && active) {
        let message = job.message;
        let pdfAttachment = null;
        const daily = !weeklyReport && !dailyAdminReport && ['reminder', 'fms', 'attendance'].includes(job.alertType) && /^\d{4}-\d{2}-\d{2}$/.test(job.entityId);
        if (weeklyReport) {
          const report = await buildWeeklySuperAdminReportAttachment({ readRows, now: weeklyReportDateForJob(job, now()), scopeEmployeeId: job.employeeId });
          message = report.message;
          pdfAttachment = report.pdfAttachment;
        } else if (dailyAdminReport) {
          const report = await buildDailyAdminReportAttachment({ readRows, now: dailyAdminReportDateForJob(job, now()), scopeEmployeeId: job.employeeId });
          message = report.message;
          pdfAttachment = report.pdfAttachment;
        } else if (daily) {
          message = '';
          const current = now();
          if (job.entityId === istClock(current).day) {
            const models = job.alertType === 'attendance' ? ['Attendance', 'Leave', 'Intimation', 'Holiday'] : job.alertType === 'fms' ? ['FmsTask'] : ['Ticket', 'Todo', 'FmsTask', 'Attendance', 'Leave'];
            const values = await Promise.all(models.map((model) => readRows(model)));
            const rows = { User: users, ...Object.fromEntries(models.map((model, index) => [model, values[index]])) };
            // Rebuild even legacy queued summaries with current dates, owners and completion states.
            const expectedEvent = job.event || `${job.alertType === 'attendance' ? 'missed-out' : 'pending-tasks'}:${job.entityId}`;
            message = buildDailyAlerts(rows, current).find((event) => event.employeeId === job.employeeId && event.alertType === job.alertType && event.event === expectedEvent)?.message || '';
          }
        }
        if (message) {
          const result = await send({ contactId: String(contact._id), message, pdfAttachment, alertType: job.alertType, entityId: job.entityId });
          state = result.success ? 'sent' : 'failed';
          error = result.success ? '' : result.message;
        } else error = weeklyReport || dailyAdminReport ? 'Scheduled report could not be generated.' : 'Daily reminder expired or no eligible tasks remain for this employee today.';
      } else error = 'Recipient inactive, contact removed, or alert preference disabled.';
    }
  } catch (cause) {
    state = 'failed';
    error = cause.message;
  }
  await WhatsAppAlertJob.updateOne({ _id: job._id }, { $set: { state, error, finishedAt: new Date() } });
  return true;
}

export async function startWhatsAppAlerts() {
  if (stop) return stop;
  const regularAlertsPaused = process.env.WHATSAPP_AUTOMATIC_ALERTS === 'false';
  await WhatsAppAlertJob.init();
  await WhatsAppAlertJob.updateMany(
    { clientId: { $exists: true, $ne: '' }, state: 'pending' },
    { $set: { state: 'skipped', error: 'Client WhatsApp alerts are permanently disabled.' } }
  ).catch(() => {});
  await WhatsAppAlertJob.updateMany(
    { event: { $regex: '^attendance approval requested', $options: 'i' }, state: 'pending' },
    { $set: { state: 'skipped', error: 'Attendance approval broadcasts permanently disabled by user request.' } }
  ).catch(() => {});
  const unsubscribe = regularAlertsPaused ? () => {} : onRowSaved(async (change) => {
    const users = await listRows('User');
    const isClientEvent = (change.model === 'Ticket' || change.model === 'Message') && !change.before;
    const ticket = isClientEvent ? (change.model === 'Ticket' ? change.after : await readTicket(change.after.TaskID)) : null;
    const clientEvents = isClientEvent ? buildClientTicketAlerts(change, ticket, users, await listRows('Client')) : [];
    const events = [...buildRowAlerts(change, users).filter((event) => !clientEvents.some((other) => other.employeeId === event.employeeId)), ...clientEvents];
    // Same before/after write produces the same key; unrelated writes produce no event.
    await enqueueAlerts(events, users, hash(JSON.stringify([change.model, change.before, change.after])));
  });
  let busy = false;
  let lastScheduleMinute = '';
  const tick = async () => {
    if (busy) return;
    busy = true;
    try {
      // Never retry an interrupted send automatically: it may already have reached WhatsApp.
      await WhatsAppAlertJob.updateMany({ state: 'processing', startedAt: { $lt: new Date(Date.now() - 5 * 60_000) } }, { $set: { state: 'unconfirmed', error: 'Worker interrupted; check delivery before retrying.', finishedAt: new Date() } });
      const clock = istClock();
      const minute = `${clock.day} ${clock.time}`;
      const reminderTime = process.env.WHATSAPP_REMINDER_TIME_IST || '10:00';
      const missedOutTime = process.env.WHATSAPP_MISSED_OUT_TIME_IST || '18:15';
      const missedInTime = process.env.WHATSAPP_MISSED_IN_TIME_IST || '10:15';
      const summaryTime = process.env.WHATSAPP_ATTENDANCE_SUMMARY_TIME_IST || '10:30';
      const dailyAdminReportTime = process.env.WHATSAPP_DAILY_ADMIN_REPORT_TIME_IST || '06:00';
      const weeklyReportTime = process.env.WHATSAPP_WEEKLY_REPORT_TIME_IST || '09:00';
      if (minute !== lastScheduleMinute && [dailyAdminReportTime, weeklyReportTime, reminderTime, missedOutTime, missedInTime, summaryTime].some((time) => clock.time >= time)) {
        const models = ['User', 'Ticket', 'Todo', 'FmsTask', 'Attendance', 'Leave', 'Intimation', 'Holiday'];
        const values = await Promise.all(models.map((model) => listRows(model)));
        const rows = Object.fromEntries(models.map((model, index) => [model, values[index]]));
        await queueDailyAdminReports({ readRows: listRows, now: new Date(), reportTime: dailyAdminReportTime });
        await queueWeeklySuperAdminReports({ readRows: listRows, now: new Date(), reportTime: weeklyReportTime });
        const dailyEvents = buildDailyAlerts(rows, new Date(), reminderTime, missedOutTime);
        await enqueueAlerts(regularAlertsPaused ? dailyEvents.filter((event) => /^attendance-summary:/.test(event.event)) : dailyEvents, rows.User);
        lastScheduleMinute = minute;
      }
      for (let count = 0; count < 10; count++) if (!await processNextAlert({ reportsOnly: regularAlertsPaused })) break;
    } catch (error) { console.error(`[WhatsApp worker] ${error.message}`); }
    finally { busy = false; }
  };
  const timer = setInterval(() => void tick(), 5000);
  timer.unref();
  stop = () => { clearInterval(timer); unsubscribe(); stop = null; };
  return stop;
}


