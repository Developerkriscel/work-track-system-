import assert from 'node:assert/strict';
import { WhatsAppIntegration } from '../models/whatsappIntegration.model.js';
WhatsAppIntegration.findById = () => ({ lean: async () => null });
import { WhatsAppAlertJob } from '../models/whatsappAlertJob.model.js';
import { WhatsAppContact } from '../models/whatsappContact.model.js';
import {
  buildDailyAdminReportAttachment,
  buildDailyAdminReportData,
  queueDailyAdminReports
} from '../services/whatsappWeeklyReport.service.js';
import { processNextAlert } from '../services/whatsappAlerts.service.js';

const runAt = new Date('2026-09-21T06:00:00+05:30');
const reportDay = new Date('2026-09-20T12:00:00+05:30');
const users = [
  { 'Employee ID': 'MS101', 'Employee Name': 'Mitushi', Role: 'Admin', Status: 'Active' },
  { 'Employee ID': 'S103', 'Employee Name': 'Sunny', Role: 'HR', Status: 'Active' },
  { 'Employee ID': 'NL106', 'Employee Name': 'Nandlal', Role: 'Manager', Status: 'Active' },
  { 'Employee ID': 'SA1', 'Employee Name': 'Super Admin', Role: 'Super Admin', Status: 'Active' },
  { 'Employee ID': 'E1', 'Employee Name': 'Asha', Role: 'Employee', Status: 'Active', 'Manager ID': 'MS101' },
  { 'Employee ID': 'E2', 'Employee Name': 'Bhavesh', Role: 'Employee', Status: 'Active', 'Manager ID': 'MS101' }
];
const baseRows = {
  User: users,
  Client: [{ Client_Id: 'C1', 'Client Name': 'Acme' }],
  Ticket: [
    { 'Ticket ID': 'T1', Client_Id: 'C1', 'Employee ID': 'E1', 'Employee Name': 'Asha', 'Creator ID': 'MS101', Status: 'Closed', 'Plan Date': '2026-09-20', Duration: '2h', 'Task Description': 'Create landing page' },
    { 'Ticket ID': 'T2', Client_Id: 'C1', 'Employee ID': 'E2', Status: 'Pending Approval', 'Plan Date': '2026-09-19', Duration: '4h' }
  ],
  Attendance: [
    { AttendanceID: 'AT1', 'Employee ID': 'E1', Date: '2026-09-20', Action: 'Punch In', Time: '2026-09-20T09:30:00+05:30', 'Admin Approval': 'Approved' },
    { AttendanceID: 'AT2', 'Employee ID': 'E1', Date: '2026-09-20', Action: 'Punch Out', Time: '2026-09-20T18:30:00+05:30', 'Admin Approval': 'Approved' },
    { AttendanceID: 'AT3', 'Employee ID': 'E2', Date: '2026-09-20', Action: 'Punch In', Time: '2026-09-20T10:00:00+05:30', 'Admin Approval': 'Pending' }
  ],
  Leave: [{ LeaveID: 'L1', 'Employee ID': 'E2', Status: 'Pending', 'Start Date': '2026-09-20', 'End Date': '2026-09-20' }],
  Intimation: [{ IntimationID: 'I1', 'Employee ID': 'E1', Status: 'Submitted', 'Intimation Date': '2026-09-20' }]
};

const data = buildDailyAdminReportData(baseRows, reportDay, { scopeEmployeeId: 'MS101' });
assert.equal(data.day, '2026-09-20');
assert.equal(data.totals.attendanceDays, 2);
assert.equal(data.totals.absentEmployees, 1);
assert.equal(data.totals.leaves, 1);
assert.equal(data.totals.intimations, 1);
assert.equal(data.totals.pendingApprovals, 4);
assert.equal(data.clientWise.length, 1);
assert.equal(data.clientWise[0].tickets, 1);
assert.equal(data.clientWise[0].hours, 2);
assert.equal(data.clientWise[0].completed, 1);
assert.equal(data.totals.tickets, 1);
assert.equal(data.personWiseTickets.length, 1);
assert.equal(data.personWiseTickets[0].employeeId, 'E1');
assert.equal(data.personWiseTickets[0].name, 'Asha');
assert.equal(data.personWiseTickets[0].tickets, 1);
assert.equal(data.personWiseTickets[0].completed, 1);
assert.equal(data.personWiseTickets[0].pending, 0);
assert.equal(data.personWiseTickets[0].hours, 2);
assert.equal(data.personWiseTickets[0].clientHours[0].client, 'Acme');
assert.equal(data.personWiseTickets[0].clientHours[0].hours, 2);
assert.equal(data.attendanceRows.find((row) => row.employeeId === 'E1').punchIn, '09:30');
assert.equal(data.attendanceRows.find((row) => row.employeeId === 'E1').punchOut, '18:30');
assert.equal(data.attendanceRows.find((row) => row.employeeId === 'E2').status, 'Present');
assert.equal(data.completedClientWise[0].client, 'Acme');
assert.equal(data.completedClientWise[0].completed, 1);
assert.equal(data.leaveDetails.length, 1);
assert.equal(data.intimationDetails.length, 1);

const noTicketRows = { ...baseRows, Ticket: [] };
const noTicketAttachment = await buildDailyAdminReportAttachment({ readRows: async (model) => noTicketRows[model] || [], now: reportDay });
assert.match(noTicketAttachment.message, /No client tickets were found/);
assert.equal(Buffer.from(noTicketAttachment.pdfAttachment.base64, 'base64').subarray(0, 4).toString(), '%PDF');

const jobs = [];
const adminContact = { _id: 'aaaaaaaaaaaaaaaaaaaaaaaa', employeeId: 'MS101', enabled: true, alertTypes: ['attendance'] };
const superAdminContact = { _id: 'bbbbbbbbbbbbbbbbbbbbbbbb', employeeId: 'SA1', enabled: true, alertTypes: ['attendance'] };
const hrContact = { _id: 'cccccccccccccccccccccccc', employeeId: 'S103', enabled: true, alertTypes: ['attendance'] };
const managerContact = { _id: 'dddddddddddddddddddddddd', employeeId: 'NL106', enabled: true, alertTypes: ['attendance'] };
WhatsAppContact.find = () => ({ lean: async () => [adminContact, superAdminContact, hrContact, managerContact] });
WhatsAppAlertJob.updateOne = async (_, update) => { jobs.push(update.$setOnInsert); };
assert.equal(await queueDailyAdminReports({ readRows: async (model) => baseRows[model] || [], now: new Date('2026-09-21T05:59:00+05:30') }), 0);
assert.equal(await queueDailyAdminReports({ readRows: async (model) => baseRows[model] || [], now: runAt }), 3);
assert.equal(jobs.length, 3);
assert.equal(jobs[0].employeeId, 'MS101');
assert.deepEqual(jobs.map((job) => job.employeeId).sort(), ['MS101', 'NL106', 'S103']);
assert.equal(jobs[0].entityId, 'DAY-2026-09-20');
assert.match(jobs[0].event, /^daily-admin-report:/);

process.env.AKNEXUS_ACCESS_TOKEN = 'offline-test';
process.env.AKNEXUS_INSTANCE_ID = 'offline-instance';
let claim = { ...jobs[0], _id: 'job1', contactId: adminContact._id };
let resultState = '';
let sentPayload = null;
WhatsAppAlertJob.findOneAndUpdate = () => ({ lean: async () => { const job = claim; claim = null; return job; } });
WhatsAppAlertJob.updateOne = async (_, update) => { resultState = update.$set.state; };
WhatsAppContact.findById = () => ({ lean: async () => adminContact });
await processNextAlert({
  readUsers: async () => users,
  readRows: async (model) => baseRows[model] || [],
  now: () => runAt,
  send: async (payload) => { sentPayload = payload; return { success: true }; }
});
assert.equal(resultState, 'sent');
assert.equal(sentPayload.alertType, 'attendance');
assert.match(sentPayload.message, /Previous-day admin report \(2026-09-20\)/);
assert.match(sentPayload.message, /Tickets for the day: 1/);
assert.equal(sentPayload.pdfAttachment.contentType, 'application/pdf');

console.log('Daily Admin WhatsApp PDF report passed: previous-day queue at 6 AM, MS101/S103/NL106 recipients, PDF generation, pending approvals, client ticket hours, and no-ticket alert. No real messages sent.');

