import assert from 'node:assert/strict';
import { WhatsAppIntegration } from '../models/whatsappIntegration.model.js';
WhatsAppIntegration.findById = () => ({ lean: async () => null });
import { WhatsAppAlertJob } from '../models/whatsappAlertJob.model.js';
import { WhatsAppContact } from '../models/whatsappContact.model.js';
import {
  buildWeeklyReportData,
  buildWeeklySuperAdminReportAttachment,
  queueWeeklySuperAdminReports,
  weeklyReportWindow
} from '../services/whatsappWeeklyReport.service.js';
import { processNextAlert } from '../services/whatsappAlerts.service.js';

const sunday = new Date('2026-09-20T09:05:00+05:30');
const users = [
  { 'Employee ID': 'AS101', 'Employee Name': 'Akash', Role: 'Super Admin', Status: 'Active' },
  { 'Employee ID': 'E1', 'Employee Name': 'Asha', Role: 'Employee', Status: 'Active', 'Manager ID': 'AS101' },
  { 'Employee ID': 'E2', 'Employee Name': 'Bhavesh', Role: 'Employee', Status: 'Active', 'Manager ID': 'AS101' },
  { 'Employee ID': 'OLD', 'Employee Name': 'Inactive', Role: 'Employee', Status: 'Inactive' }
];
const rows = {
  User: users,
  Client: [{ Client_Id: 'C1', 'Client Name': 'Acme' }, { Client_Id: 'C2', 'Client Name': 'Beta' }],
  Ticket: [
    { 'Ticket ID': 'T1', Client_Id: 'C1', 'Employee ID': 'E1', Status: 'Closed', 'Plan Date': '2026-09-16', TAT: '120', 'Total Duration': '01:30' },
    { 'Ticket ID': 'T2', Client_Id: 'C1', 'Employee ID': 'E2', Status: 'Open', 'Plan Date': '2026-09-18', 'Planned Hours': '3', Duration: '2h' },
    { 'Ticket ID': 'T3', Client_Id: 'C2', 'Employee ID': 'E2', Status: 'Open', 'Plan Date': '2026-09-10', 'Planned Hours': '5', Duration: '4h' },
    { 'Ticket ID': 'T4', Client_Id: 'C2', 'Employee ID': 'E2', Status: 'Closed', 'Plan Date': '2026-09-10', 'Done Date': '2026-09-18', Duration: '1h' }
  ],
  Todo: [{ 'Task ID': 'TD1', 'Employee ID': 'E1', Status: 'Pending', 'Due Date': '2026-09-17', 'Planned Hours': '1.5' }],
  FmsTask: [{ 'Task ID': 'F1', 'Employee ID': 'E2', Status: 'Done', 'Plan Date': '2026-09-19', TAT: '60' }],
  Attendance: [
    { AttendanceID: 'A1', 'Employee ID': 'E1', Date: '2026-09-16', Action: 'Punch In', Time: '2026-09-16T09:30:00+05:30' },
    { AttendanceID: 'A2', 'Employee ID': 'E1', Date: '2026-09-16', Action: 'Punch Out', Time: '2026-09-16T18:30:00+05:30' },
    { AttendanceID: 'A3', 'Employee ID': 'E2', Date: '2026-09-17', Action: 'Punch In', Time: '2026-09-17T10:00:00+05:30' },
    { AttendanceID: 'A4', 'Employee ID': 'E2', Date: '2026-09-17', Action: 'Punch Out', Time: '2026-09-17T18:00:00+05:30' }
  ],
  Leave: [{ LeaveID: 'L1', 'Employee ID': 'E1', Status: 'Approved', 'Start Date': '2026-09-18', 'End Date': '2026-09-18' }],
  Intimation: [{ IntimationID: 'I1', 'Employee ID': 'E2', 'Intimation Date': '2026-09-19', Status: 'Approved' }]
};

const data = buildWeeklyReportData(rows, sunday);
assert.equal(data.start, '2026-09-14');
assert.equal(data.end, '2026-09-19');
assert.deepEqual(weeklyReportWindow(new Date('2026-09-16T12:00:00+05:30')), {
  start: '2026-09-07',
  end: '2026-09-12',
  label: '2026-09-07 to 2026-09-12'
});
assert.equal(data.totals.activeTeam, 3);
assert.equal(data.totals.weekDays, 6);
assert.equal(data.totals.presentEmployees, 2);
assert.equal(data.totals.absentEmployees, 1);
assert.equal(data.totals.attendanceDays, 2);
assert.equal(data.totals.leaves, 1);
assert.equal(data.totals.intimations, 1);
assert.equal(data.totals.pendingTotal, 2);
assert.equal(data.totals.tickets, 3);
assert.equal(data.totals.completedTickets, 2);
assert.equal(data.totals.pendingTickets, 1);
assert.equal(data.pendingByPerson.length, 2);
assert.equal(data.pendingByPerson.find((row) => row.employeeId === 'E1').todo, 1);
assert.equal(data.pendingByPerson.find((row) => row.employeeId === 'E2').tickets, 1);
assert.equal(data.pendingByPerson.find((row) => row.employeeId === 'E2').total, 1);
assert.equal(data.clientWise.find((row) => row.client === 'Acme').tickets, 2);
assert.equal(data.clientWise.find((row) => row.client === 'Acme').hours, 3.5);
assert.equal(data.clientWise.find((row) => row.client === 'Acme').pending, 1);
assert.match(data.clientWise.find((row) => row.client === 'Acme').employees, /Asha|Bhavesh/);
assert.equal(data.personWiseTickets.find((row) => row.employeeId === 'E1').tickets, 1);
assert.equal(data.personWiseTickets.find((row) => row.employeeId === 'E1').completed, 1);
assert.equal(data.personWiseTickets.find((row) => row.employeeId === 'E1').hours, 1.5);
assert.equal(data.personWiseTickets.find((row) => row.employeeId === 'E2').tickets, 2);
assert.equal(data.personWiseTickets.find((row) => row.employeeId === 'E2').completed, 1);
assert.equal(data.personWiseTickets.find((row) => row.employeeId === 'E2').pending, 1);
assert.equal(data.personWiseTickets.find((row) => row.employeeId === 'E2').clientHours[0].client, 'Acme');
assert.equal(data.personWiseTickets.find((row) => row.employeeId === 'E2').clientHours[0].hours, 2);
assert.equal(data.personWise.find((row) => row.employeeId === 'E1').planned, 3.5);
assert.equal(data.personWise.find((row) => row.employeeId === 'E2').actual, 8);
assert.equal(data.personWise.find((row) => row.employeeId === 'E1').avgPunchIn, '09:30');
assert.equal(data.personWise.find((row) => row.employeeId === 'E2').avgPunchOut, '18:00');
assert.equal(data.completedClientWise[0].client, 'Acme');
assert.equal(data.completedClientWise[0].completed, 1);
assert.equal(data.completedClientWise.find((row) => row.client === 'Beta').completed, 1);
assert.equal(data.leaveDetails.length, 1);
assert.equal(data.intimationDetails.length, 1);

const readRows = async (model) => rows[model] || [];
const attachment = await buildWeeklySuperAdminReportAttachment({ readRows, now: sunday });
assert.match(attachment.message, /Weekly team report/);
assert.equal(attachment.pdfAttachment.contentType, 'application/pdf');
assert.equal(Buffer.from(attachment.pdfAttachment.base64, 'base64').subarray(0, 4).toString(), '%PDF');

const contact = { _id: 'aaaaaaaaaaaaaaaaaaaaaaaa', employeeId: 'AS101', enabled: true, alertTypes: ['attendance'] };
const jobs = [];
WhatsAppContact.find = () => ({ lean: async () => [contact, { ...contact, _id: 'bbbbbbbbbbbbbbbbbbbbbbbb', employeeId: 'E1' }] });
WhatsAppAlertJob.updateOne = async (_, update) => { jobs.push(update.$setOnInsert); };
assert.equal(await queueWeeklySuperAdminReports({ readRows, now: new Date('2026-09-19T10:00:00+05:30') }), 0);
assert.equal(await queueWeeklySuperAdminReports({ readRows, now: sunday }), 1);
assert.equal(jobs.length, 1);
assert.equal(jobs[0].employeeId, 'AS101');
assert.equal(jobs[0].alertType, 'attendance');
assert.match(jobs[0].event, /^weekly-super-admin-report:/);

process.env.AKNEXUS_ACCESS_TOKEN = 'offline-test';
process.env.AKNEXUS_INSTANCE_ID = 'offline-instance';
let claim = { ...jobs[0], _id: 'job1', contactId: contact._id };
let resultState = '';
let sentPayload = null;
WhatsAppAlertJob.findOneAndUpdate = () => ({ lean: async () => { const job = claim; claim = null; return job; } });
WhatsAppAlertJob.updateOne = async (_, update) => { resultState = update.$set.state; };
WhatsAppContact.findById = () => ({ lean: async () => contact });
await processNextAlert({
  readUsers: async () => users,
  readRows,
  now: () => sunday,
  send: async (payload) => { sentPayload = payload; return { success: true }; }
});
assert.equal(resultState, 'sent');
assert.equal(sentPayload.alertType, 'attendance');
assert.equal(sentPayload.pdfAttachment.contentType, 'application/pdf');
assert.match(sentPayload.message, /Working days: 6 \(Mon-Sat\)/);
assert.match(sentPayload.message, /Completed tickets: 2/);
assert.match(sentPayload.message, /Pending tickets: 1/);

console.log('Weekly WhatsApp PDF report passed: Sunday-only queue, AS101 recipient, scoped PDF generation, summary metrics, and send payload. No real messages sent.');
