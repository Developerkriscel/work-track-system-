import crypto from 'node:crypto';
import { WhatsAppAlertJob } from '../models/whatsappAlertJob.model.js';
import { WhatsAppContact } from '../models/whatsappContact.model.js';
import { listRows } from './legacyStore.service.js';
import { onRowSaved } from './rowEvents.service.js';
import { getAknexusStatus, sendWhatsAppText } from './aknexusWhatsApp.service.js';
import { buildRowAlerts, buildDailyAlerts, employeeIdOf, isActive, istClock } from './whatsappAlertRules.js';
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
let stop = null;
export async function enqueueAlerts(events, users, revision = '') {
  if (!events.length) return;
  const contacts = await WhatsAppContact.find({ enabled: true, employeeId: { $in: events.map((e) => e.employeeId) } }).lean();
  const queuedMessages = new Set();
  for (const event of events) {
    if (event.clientId) {
      const key = hash(JSON.stringify(['client', event.clientId, event.event]));
      await WhatsAppAlertJob.updateOne({ key }, { $setOnInsert: { key, clientId: event.clientId, employeeId: '', alertType: event.alertType, entityId: event.entityId, event: event.event, message: event.message, state: 'pending' } }, { upsert: true });
      continue;
    }
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
      const [clients, ticket] = await Promise.all([readRows('Client'), findTicket(job.entityId)]);
      const client = clients.find((row) => clientIdOf(row) === job.clientId);
      const linkedContact = await WhatsAppContact.findOne({ clientId: job.clientId }).lean();
      const phone = normalizeWhatsAppPhone(linkedContact?.phone || clientPhoneOf(client));
      const preference = linkedContact || (phone ? await WhatsAppContact.findOne({ phone }).lean() : null);
      if (!clientAlertRecipientStillAllowed(job, ticket, [], clients)) error = 'Client inactive or ticket no longer belongs to this client.';
      else if (!phone) error = 'Client has no valid WhatsApp/mobile number in Client Master.';
      else if (preference && (!preference.enabled || !preference.alertTypes.includes('ticket'))) error = 'Ticket alerts disabled for the client number.';
      else {
        const result = await send({ ...(linkedContact ? { contactId: String(linkedContact._id) } : { phone, name: clientNameOf(client), clientId: job.clientId }), message: job.message, alertType: 'ticket', entityId: job.entityId });
        state = result.success ? 'sent' : 'failed';
        error = result.success ? '' : result.message;
      }
    } else {
      const contact = await WhatsAppContact.findById(job.contactId).lean();
      const users = await readUsers();
      const special = /^client-(created|chat):/.test(job.event || '');
      const weeklyReport = isWeeklySuperAdminReportJob(job);
      const dailyAdminReport = isDailyAdminReportJob(job);
      const requiredReminder = mandatoryDailyReminder(job.event);
      const active = isActive(users.find((user) => employeeIdOf(user) === job.employeeId))
        && (!special || clientAlertRecipientStillAllowed(job, await findTicket(job.entityId), users, []));
      // Resolve the current saved number and preferences at send time, never a stale phone snapshot.
      if (contact?.enabled && contact.employeeId === job.employeeId && (requiredReminder || contact.alertTypes.includes(job.alertType)) && active) {
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
  const unsubscribe = regularAlertsPaused ? () => {} : onRowSaved(async (change) => {
    if (!['Ticket', 'Message', 'Attendance', 'Expense', 'FmsTask', 'Leave', 'Intimation'].includes(change.model)) return;
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


