// No provider/database access: verify real rules and queue code using in-memory adapters.
import assert from 'node:assert/strict';
import { WhatsAppIntegration } from '../models/whatsappIntegration.model.js';
WhatsAppIntegration.findById = () => ({ lean: async () => null });
import { buildRowAlerts, buildDailyAlerts, istClock } from '../services/whatsappAlertRules.js';
import { enqueueAlerts, processNextAlert } from '../services/whatsappAlerts.service.js';
import { WhatsAppAlertJob } from '../models/whatsappAlertJob.model.js';
import { WhatsAppContact } from '../models/whatsappContact.model.js';
import { onRowSaved, emitRowSaved } from '../services/rowEvents.service.js';

const user = { 'Employee ID': 'E1', 'Employee Name': 'Employee', Role: 'User', Status: 'Active', 'Task Approver': 'M1', 'Manager ID': 'M1' };
const users = [
  user,
  { 'Employee ID': 'M1', Role: 'Manager', Status: 'Active' },
  { 'Employee ID': 'M2', Role: 'Manager', Status: 'Active' },
  { 'Employee ID': 'A1', Role: 'Admin', Status: 'Active' },
  { 'Employee ID': 'HR1', Role: 'HR', Status: 'Active' },
  { 'Employee ID': 'AS101', Role: 'Super Admin', Status: 'Active' },
  { 'Employee ID': 'MS101', Role: 'Admin', Status: 'Active' }
];
const ticket = { 'Ticket ID': 'T1', 'Employee ID': 'E1', Status: 'Open', 'Plan Date': '2026-09-09', Description: 'Task' };
const alerts = (model, before, after) => buildRowAlerts({ model, before, after }, users);
const nonSummaryUsers = users.filter((row) => row.Role !== 'Super Admin');
assert.equal(alerts('Ticket', null, ticket)[0].alertType, 'ticket');
const managerAssignedTicket = { ...ticket, 'Ticket ID': 'MANAGER_ASSIGN', 'Creator ID': 'M1', 'Created By': 'M1', 'Employee ID': 'E1' };
const managerAssignmentAlerts = alerts('Ticket', null, managerAssignedTicket).filter((event) => event.alertType === 'ticket');
assert.deepEqual(managerAssignmentAlerts.map((event) => event.employeeId), ['E1'], 'manager-assigned ticket alert must go to the assigned employee only');
const reassignedToEmployee = { ...ticket, 'Employee ID': 'M2', 'Reassigned By': 'M1', Status: 'Reassigned' };
const reassignmentAlerts = alerts('Ticket', ticket, reassignedToEmployee).filter((event) => event.alertType === 'ticket');
assert.deepEqual(reassignmentAlerts.map((event) => event.employeeId), ['M2'], 'reassigned ticket alert must go to the new assignee only');
assert.equal(alerts('Ticket', ticket, { ...ticket, Remarks: 'unrelated edit' }).length, 0);
assert.equal(alerts('Ticket', null, { ...ticket, 'Auto Ticket': 'Yes' }).length, 0);
const pending = { ...ticket, Status: 'Pending Approval' };
const ticketApprovalAlerts = alerts('Ticket', ticket, pending).filter((e) => e.alertType === 'approval');
assert.deepEqual(ticketApprovalAlerts.map((e) => e.employeeId), ['E1']);
assert(!ticketApprovalAlerts.some((e) => ['M1', 'M2', 'A1', 'HR1', 'SA1'].includes(e.employeeId)));
const reassignedTicketApprovalAlerts = alerts('Ticket', pending, { ...pending, 'Reassigned To': 'M2' }).filter((e) => e.alertType === 'approval');
assert.deepEqual(reassignedTicketApprovalAlerts.map((e) => e.employeeId), ['E1']);
assert(alerts('Ticket', pending, { ...pending, Status: 'Rework' }).some((e) => e.alertType === 'approval' && e.employeeId === 'E1'));
assert(alerts('Ticket', pending, { ...pending, Status: 'Closed' }).some((e) => e.alertType === 'approval'));
assert(alerts('Expense', null, { ExpenseID: 'EX1', 'Employee ID': 'E1', Status: 'Pending' }).some((e) => e.alertType === 'expense'));
assert(alerts('Expense', { Status: 'Pending' }, { ExpenseID: 'EX1', 'Employee ID': 'E1', Status: 'Approved' }).some((e) => e.alertType === 'expense'));
assert(alerts('FmsTask', null, { 'Task ID': 'F1', 'Employee ID': 'E1', Status: 'Pending' }).some((e) => e.alertType === 'fms'));
const attendance = { AttendanceID: 'A1', 'Employee ID': 'E1', Date: '2026-09-09', Action: 'Punch In', Time: '2026-09-09T10:00:00+05:30', 'Admin Approval': 'Pending' };
assert(alerts('Attendance', null, attendance).some((e) => e.alertType === 'attendance'));
assert(alerts('Attendance', attendance, { ...attendance, 'Admin Approval': 'Approved' }).some((e) => e.alertType === 'approval'));
assert(alerts('Leave', null, { LeaveID: 'L1', 'Employee ID': 'E1', Status: 'Pending' }).some((e) => e.alertType === 'approval'));
assert.equal(istClock(new Date('2026-09-08T20:00:00Z')).day, '2026-09-09');
const rows = { User: nonSummaryUsers, Ticket: [ticket, { ...ticket, 'Ticket ID': 'T2', Status: 'Closed' }, { ...ticket, 'Ticket ID': 'T3', 'Plan Date': '2026-10-01' }, { ...ticket, 'Ticket ID': 'OLD', 'Plan Date': '2026-06-20' }, { ...ticket, 'Ticket ID': 'WAIT', Status: 'Pending Approval' }, { ...ticket, 'Ticket ID': 'UNKNOWN', 'Employee ID': 'NOT_IN_DIRECTORY' }], Attendance: [attendance] };
assert.equal(buildDailyAlerts(rows, new Date('2026-09-09T09:59:00+05:30')).length, 0);
const reminders = buildDailyAlerts(rows, new Date('2026-09-09T10:00:00+05:30'));
assert.equal(reminders.length, 1);
assert.equal(reminders[0].event, 'pending-tasks:2026-09-09');
assert.match(reminders[0].message, /Tickets: 2\n/);
assert(!/WAIT|UNKNOWN|T2|T3|Overdue/.test(reminders[0].message));
const scoped = buildDailyAlerts({ User: users, Ticket: [ticket, { ...ticket, 'Ticket ID': 'M1_TASK', 'Employee ID': 'M1' }], FmsTask: [{ 'Task ID': 'OLD_FMS', 'Employee ID': 'E1', Status: 'Pending', 'Plan Date': '2026-06-01' }] }, new Date('2026-09-09T10:00:00+05:30'));
assert.equal(scoped.length, 2);
assert(!scoped.find((event) => event.employeeId === 'E1').message.includes('M1_TASK'));
assert.match(scoped.find((event) => event.employeeId === 'E1').message, /FMS Tasks/);
const roleRows = { User: users, Ticket: users.map((u) => ({ 'Ticket ID': `TASK_${u['Employee ID']}`, 'Employee ID': u['Employee ID'], Status: 'Open', 'Plan Date': '2026-09-09' })) };
assert.deepEqual(buildDailyAlerts(roleRows, new Date('2026-09-09T10:00:00+05:30')).map((event) => event.employeeId).sort(), ['A1', 'AS101', 'E1', 'HR1', 'M1', 'M2', 'MS101']);
assert(!scoped.find((event) => event.employeeId === 'M1').message.includes('T1'));
assert.equal(buildDailyAlerts({ User: [{ ...user, Status: 'Inactive' }], Ticket: [ticket] }, new Date('2026-09-09T10:00:00+05:30')).length, 0);
assert.equal(buildDailyAlerts(roleRows, new Date('2026-09-13T10:00:00+05:30')).length, 0, 'Sunday should not send regular pending task or missed punch alerts.');
const noTicketRows = { User: [user], Ticket: [], Attendance: [attendance] };
assert(!buildDailyAlerts(noTicketRows, new Date('2026-09-09T10:29:00+05:30')).some((event) => event.event === 'no-ticket-after-present:2026-09-09'));
const noTicketEvents = buildDailyAlerts(noTicketRows, new Date('2026-09-09T10:30:00+05:30')).filter((event) => event.event === 'no-ticket-after-present:2026-09-09');
assert.equal(noTicketEvents.length, 1);
assert.equal(noTicketEvents[0].employeeId, 'E1');
assert.match(noTicketEvents[0].message, /No Ticket \/ Work Entry Reminder/);
assert(!buildDailyAlerts({ ...noTicketRows, Ticket: [ticket] }, new Date('2026-09-09T10:30:00+05:30')).some((event) => event.event === 'no-ticket-after-present:2026-09-09'));
assert(buildDailyAlerts(rows, new Date('2026-09-09T20:00:00+05:30')).some((e) => e.event?.startsWith('missed-out:')));
rows.Attendance.push({ ...attendance, AttendanceID: 'A2', Action: 'Punch Out', Time: '2026-09-09T19:00:00+05:30' });
assert(!buildDailyAlerts(rows, new Date('2026-09-09T20:00:00+05:30')).some((e) => e.event?.startsWith('missed-out:')));
assert(!buildDailyAlerts({ Attendance: [] }, new Date('2026-09-09T20:00:00+05:30')).length);

const jobs = new Map();
const contact = { _id: 'aaaaaaaaaaaaaaaaaaaaaaaa', employeeId: 'E1', enabled: true, alertTypes: ['ticket'] };
WhatsAppContact.find = () => ({ lean: async () => contact.enabled ? [contact] : [] });
WhatsAppAlertJob.updateOne = async ({ key }, { $setOnInsert }) => { if (!jobs.has(key)) jobs.set(key, $setOnInsert); };
const created = alerts('Ticket', null, ticket);
await enqueueAlerts(created, users, 'revision1');
await enqueueAlerts(created, users, 'revision1');
assert.equal(jobs.size, 1, 'duplicate event must not queue twice');
await enqueueAlerts([{ employeeId: 'E1', alertType: 'reminder', entityId: '2026-09-09', event: 'pending-tasks:2026-09-09', message: 'Pending task reminder' }], users, 'pending1');
assert.equal(jobs.size, 2, 'pending task reminder should reach enabled internal contact even if reminder category is not selected');
await enqueueAlerts([{ employeeId: 'E1', alertType: 'reminder', entityId: '2026-09-09', event: 'no-ticket-after-present:2026-09-09', message: 'No ticket reminder' }], users, 'no-ticket1');
assert.equal(jobs.size, 3, 'no-ticket reminder should reach enabled internal contact even if reminder category is not selected');
contact.enabled = false;
await enqueueAlerts(created, users, 'revision2');
assert.equal(jobs.size, 3);
contact.enabled = true;
contact.alertTypes = ['expense'];
await enqueueAlerts(created, users, 'revision3');
assert.equal(jobs.size, 3);
contact.alertTypes = ['ticket'];
await enqueueAlerts(created, [{ ...user, Status: 'Inactive' }], 'revision4');
assert.equal(jobs.size, 3);
process.env.AKNEXUS_ACCESS_TOKEN = '';
process.env.AKNEXUS_API_TOKEN = '';
assert.equal(await processNextAlert(), false, 'unconfigured worker must not attempt send');
process.env.AKNEXUS_ACCESS_TOKEN = 'offline-test';
process.env.AKNEXUS_INSTANCE_ID = 'offline-instance';
let claim = null;
let resultState;
let sendCount = 0;
WhatsAppAlertJob.findOneAndUpdate = () => ({ lean: async () => { const row = claim; claim = null; return row; } });
WhatsAppAlertJob.updateOne = async (_, update) => { resultState = update.$set.state; };
WhatsAppContact.findById = () => ({ lean: async () => contact });
const job = { _id: 'job', contactId: contact._id, employeeId: 'E1', alertType: 'ticket', message: 'Test', entityId: 'T1' };
const deps = { readUsers: async () => users, send: async () => { sendCount++; return { success: true }; } };
claim = job;
contact.enabled = false;
await processNextAlert(deps);
assert.equal(resultState, 'skipped');
assert.equal(sendCount, 0, 'disabled after enqueue must not send');
contact.enabled = true;
claim = job;
await processNextAlert({ ...deps, readUsers: async () => [{ ...user, Status: 'Inactive' }] });
assert.equal(resultState, 'skipped');
claim = job;
await Promise.all([processNextAlert(deps), processNextAlert(deps)]);
assert.equal(sendCount, 1, 'only the claimed job may send');
assert.equal(resultState, 'sent');
claim = job;
await processNextAlert({ ...deps, send: async () => { throw new Error('Provider unavailable'); } });
assert.equal(resultState, 'failed');
assert.equal(await processNextAlert(deps), false, 'failed jobs are not automatically retried');
const dailyJob = { ...job, alertType: 'reminder', entityId: '2026-09-09', message: '117 old tasks' };
contact.alertTypes = ['reminder'];
let sentMessage;
const dailyDeps = { ...deps, now: () => new Date('2026-09-09T10:00:00+05:30'), readRows: async (model) => model === 'Ticket' ? rows.Ticket : [], send: async (payload) => { sentMessage = payload.message; return { success: true }; } };
claim = dailyJob;
await processNextAlert(dailyDeps);
assert.equal(resultState, 'sent');
assert.match(sentMessage, /Tickets: 2\n/);
assert(!sentMessage.includes('117'));
claim = dailyJob;
sentMessage = null;
await processNextAlert({ ...dailyDeps, readRows: async () => [{ ...ticket, 'Employee ID': 'M1' }] });
assert.equal(resultState, 'skipped');
assert.equal(sentMessage, null, 'reassigned tasks must not reach the previous owner');
claim = { ...dailyJob, entityId: '2026-09-08' };
await processNextAlert(dailyDeps);
assert.equal(resultState, 'skipped');
const noTicketJob = { ...dailyJob, event: 'no-ticket-after-present:2026-09-09', message: 'old no-ticket text' };
contact.alertTypes = ['ticket'];
claim = noTicketJob;
sentMessage = null;
await processNextAlert({ ...dailyDeps, now: () => new Date('2026-09-09T10:30:00+05:30'), readRows: async (model) => model === 'Attendance' ? [attendance] : [] });
assert.equal(resultState, 'sent');
assert.match(sentMessage, /No Ticket \/ Work Entry Reminder/);
const summaryJob = { ...job, employeeId: 'AS101', alertType: 'attendance', entityId: '2026-09-09', event: 'attendance-summary:2026-09-09' };
contact.alertTypes = ['attendance'];
contact.employeeId = 'AS101';
claim = summaryJob;
sentMessage = null;
await processNextAlert({
  ...dailyDeps,
  now: () => new Date('2026-09-09T10:30:00+05:30'),
  readRows: async (model) => model === 'Attendance' ? [attendance] : model === 'Intimation' ? [{ IntimationID: 'I1', 'Employee ID': 'E1', Status: 'Submitted', 'Intimation Date': '2026-09-09' }] : [],
  readUsers: async () => [{ 'Employee ID': 'AS101', Role: 'Super Admin', Status: 'Active' }, user]
});
assert.equal(resultState, 'sent');
assert.match(sentMessage, /Attendance Summary/);
assert.match(sentMessage, /Total Present: 1/);
assert.match(sentMessage, /Intimations: 1/);
claim = summaryJob;
sentMessage = null;
await processNextAlert({ ...dailyDeps, now: () => new Date('2026-09-09T10:30:00+05:30'), readRows: async () => [], readUsers: async () => [user] });
assert.equal(sentMessage, null, 'Summary must be skipped after losing Super Admin role');
contact.employeeId = 'E1';
let captured;
const unsubscribe = onRowSaved((event) => { captured = event; });
await emitRowSaved('Ticket', null, ticket);
assert.equal(captured.after, ticket);
unsubscribe();
console.log('Automatic WhatsApp alerts passed: six categories, AS101/MS101 attendance summary, ticket self-only requests, non-ticket approval permissions, lifecycle transitions, IST reminder boundaries, missed punch-out, duplicate prevention, disabled categories and inactive users. No real messages sent.');



