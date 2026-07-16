import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDatabase } from '../config/database.js';
import { LegacyModels } from '../models/legacyModels.js';
import { purgeTestArtifacts } from './testArtifactCleanup.js';

const baseUrl = process.env.PERSISTENCE_URL || `http://localhost:${process.env.PORT || 5000}`;
const liveDate = new Date().toISOString().slice(0, 10);
const smokeUserId = 'DBPERSIST01';
const smokeUserName = 'DB Persistence Smoke';
const smokeClientId = 'CL000';
const failures = [];

function assert(condition, message) {
  if (!condition) failures.push(message);
}

async function post(fn, args) {
  const response = await fetch(`${baseUrl}/api/apps-script/${fn}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ args })
  });
  const payload = await response.json();
  return { ok: response.ok, payload };
}

async function findLegacy(modelName, field, value) {
  return LegacyModels[modelName].findOne({ [`data.${field}`]: value }).lean();
}

async function main() {
  await connectDatabase();
  await purgeTestArtifacts();

  const attendanceId = `ATT_DBPERSIST_${Date.now()}`;
  const ticketId = `TICKET_DBPERSIST_${Date.now()}`;
  const clientTicketId = `TICKET_CLIENT_DBPERSIST_${Date.now()}`;
  const fmsId = `FMS_DBPERSIST_${Date.now()}`;
  const todoTask = `DB persistence todo ${Date.now()}`;

  const saveUser = await post('saveOrUpdateUser', [{
    'Employee ID': smokeUserId,
    'Employee Name': smokeUserName,
    Password: '123456',
    Role: 'User',
    Status: 'Active'
  }]);
  assert(saveUser.payload.success, `Smoke user save failed: ${saveUser.payload.message || 'unknown error'}`);

  const attendanceWrite = await post('recordAttendance', [{
    AttendanceID: attendanceId,
    'Employee ID': smokeUserId,
    'Employee Name': smokeUserName,
    Date: liveDate,
    Action: 'Punch In',
    Time: '09:55',
    'Punch In': '09:55',
    Status: 'Present',
    Remarks: 'DB persistence smoke attendance'
  }]);
  assert(attendanceWrite.payload.success, `Attendance write failed: ${attendanceWrite.payload.message || 'unknown error'}`);

  const attendanceDoc = await findLegacy('Attendance', 'AttendanceID', attendanceId);
  assert(!!attendanceDoc, 'Attendance document was not written to MongoDB.');
  assert(attendanceDoc?.data?.['Employee ID'] === smokeUserId, 'Attendance Mongo document has wrong Employee ID.');
  assert(attendanceDoc?.data?.Date === liveDate, `Attendance Mongo document has wrong Date: ${attendanceDoc?.data?.Date}`);
  assert(attendanceDoc?.data?.Action === 'Punch In', `Attendance Mongo document has wrong Action: ${attendanceDoc?.data?.Action}`);

  const attendanceRead = await post('getAttendanceForUser', [smokeUserId, liveDate, liveDate]);
  assert(attendanceRead.payload.success, `Attendance read failed: ${attendanceRead.payload.message || 'unknown error'}`);
  const attendanceRows = attendanceRead.payload.data || [];
  assert(attendanceRows.some((row) => row.AttendanceID === attendanceId || row.ID === attendanceId), 'Attendance readback does not include the Mongo-written record.');

  const leaveWrite = await post('submitLeaveRequest', [{
    LeaveID: `LEAVE_DBPERSIST_${Date.now()}`,
    'Employee ID': smokeUserId,
    'Employee Name': smokeUserName,
    'Leave Type': 'Casual Leave',
    'Day Type': 'Full Day',
    'Start Date': liveDate,
    'End Date': liveDate,
    Reason: 'DB persistence smoke leave'
  }]);
  assert(leaveWrite.payload.success, `Leave write failed: ${leaveWrite.payload.message || 'unknown error'}`);
  const leaveId = leaveWrite.payload.item?.LeaveID;
  const leaveDoc = leaveId ? await findLegacy('Leave', 'LeaveID', leaveId) : null;
  assert(!!leaveDoc, 'Leave request was not written to MongoDB.');
  assert(leaveDoc?.data?.Status === 'Pending', `Leave Mongo status mismatch: ${leaveDoc?.data?.Status}`);

  const intimationWrite = await post('submitIntimation', [{
    IntimationID: `INT_DBPERSIST_${Date.now()}`,
    'Employee ID': smokeUserId,
    'Employee Name': smokeUserName,
    'Intimation Date': liveDate,
    'Intimation Type': 'Work from Home',
    Reason: 'DB persistence smoke intimation'
  }]);
  assert(intimationWrite.payload.success, `Intimation write failed: ${intimationWrite.payload.message || 'unknown error'}`);
  const intimationId = intimationWrite.payload.item?.IntimationID;
  const intimationDoc = intimationId ? await findLegacy('Intimation', 'IntimationID', intimationId) : null;
  assert(!!intimationDoc, 'Intimation was not written to MongoDB.');
  assert(intimationDoc?.data?.Status === 'Submitted', `Intimation Mongo status mismatch: ${intimationDoc?.data?.Status}`);

  const expenseWrite = await post('recordExpense', [{
    ExpenseID: `EXP_DBPERSIST_${Date.now()}`,
    'Employee ID': smokeUserId,
    'Employee Name': smokeUserName,
    Date: liveDate,
    Type: 'Travel',
    Amount: '321.00',
    Description: 'DB persistence smoke expense',
    Receipt: {
      base64: 'ZGIgcGVyc2lzdGVuY2UgZXhwZW5zZQ==',
      mimeType: 'text/plain',
      fileName: 'db-persistence-expense.txt'
    }
  }]);
  assert(expenseWrite.payload.success, `Expense write failed: ${expenseWrite.payload.message || 'unknown error'}`);
  const expenseId = expenseWrite.payload.item?.ExpenseID;
  const expenseDoc = expenseId ? await findLegacy('Expense', 'ExpenseID', expenseId) : null;
  assert(!!expenseDoc, 'Expense was not written to MongoDB.');
  assert(expenseDoc?.data?.Status === 'Pending', `Expense Mongo status mismatch: ${expenseDoc?.data?.Status}`);
  assert(String(expenseDoc?.data?.['Receipt URL'] || '').startsWith('/uploads/expenses/'), `Expense receipt URL not normalized in MongoDB: ${expenseDoc?.data?.['Receipt URL']}`);

  const ticketWrite = await post('createTicketInSheet', [{
    'Ticket ID': ticketId,
    Client_Id: smokeClientId,
    'Client Name': 'Kriscel Tech Private Limited',
    'Employee ID': smokeUserId,
    'Employee Name': smokeUserName,
    'Task Category': 'Documentation',
    Priority: 'Normal',
    'Task Description': 'DB persistence smoke ticket',
    'Plan Date': liveDate,
    'Creator ID': smokeUserId,
    'Creator Name': smokeUserName,
    TAT: 30
  }]);
  assert(ticketWrite.payload.success, `Ticket create failed: ${ticketWrite.payload.message || 'unknown error'}`);

  const ticketCreatedDoc = await findLegacy('Ticket', 'Ticket ID', ticketId);
  assert(!!ticketCreatedDoc, 'Ticket create did not write a MongoDB document.');
  assert(ticketCreatedDoc?.data?.Status === 'Open', `Ticket create Mongo status mismatch: ${ticketCreatedDoc?.data?.Status}`);

  const ticketStart = await post('updateTicketInSheet', [ticketId, { newStatus: 'In Progress', updatedBy: smokeUserId }]);
  assert(ticketStart.payload.success, `Ticket start failed: ${ticketStart.payload.message || 'unknown error'}`);
  assert(ticketStart.payload.finalStatus === 'In Progress', `Ticket start returned wrong finalStatus: ${ticketStart.payload.finalStatus}`);

  const ticketPause = await post('updateTicketInSheet', [ticketId, { newStatus: 'Paused', updatedBy: smokeUserId, newRemarks: 'DB persistence pause' }]);
  assert(ticketPause.payload.success, `Ticket pause failed: ${ticketPause.payload.message || 'unknown error'}`);
  assert(ticketPause.payload.finalStatus === 'Paused', `Ticket pause returned wrong finalStatus: ${ticketPause.payload.finalStatus}`);

  const ticketPausedDoc = await findLegacy('Ticket', 'Ticket ID', ticketId);
  assert(!!ticketPausedDoc, 'Ticket pause did not leave a MongoDB document.');
  assert(ticketPausedDoc?.data?.Status === 'Paused', `Ticket Mongo status was not updated to Paused: ${ticketPausedDoc?.data?.Status}`);
  assert(typeof ticketPausedDoc?.data?.['Total Duration'] === 'string' && /\d+h \d+m/.test(ticketPausedDoc.data['Total Duration']), `Ticket Mongo total duration missing after pause: ${ticketPausedDoc?.data?.['Total Duration']}`);

  const ticketHistoryDocs = await LegacyModels.TicketHistory.find({ 'data.Ticket ID': ticketId }).lean();
  assert(ticketHistoryDocs.length >= 2, `Ticket history Mongo writes missing; found ${ticketHistoryDocs.length}.`);

  const clientTicketWrite = await post('createTicketInSheet', [{
    'Ticket ID': clientTicketId,
    Client_Id: smokeClientId,
    'Client Name': 'Kriscel Tech Private Limited',
    'Employee ID': smokeUserId,
    'Employee Name': smokeUserName,
    'Task Category': 'Documentation',
    Priority: 'Normal',
    'Task Description': 'DB persistence smoke client ticket',
    'Plan Date': liveDate,
    'Creator ID': smokeUserId,
    'Creator Name': smokeUserName,
    TAT: 20
  }]);
  assert(clientTicketWrite.payload.success, `Client-side ticket setup create failed: ${clientTicketWrite.payload.message || 'unknown error'}`);
  const clientTicketUpdate = await post('updateTicketStatusByClient', [clientTicketId, 'Closed', 'DB persistence client close', smokeClientId]);
  assert(clientTicketUpdate.payload.success, `Client ticket update failed: ${clientTicketUpdate.payload.message || 'unknown error'}`);
  const clientTicketDoc = await findLegacy('Ticket', 'Ticket ID', clientTicketId);
  assert(!!clientTicketDoc, 'Client-updated ticket was not found in MongoDB.');
  assert(clientTicketDoc?.data?.Status === 'Closed', `Client ticket Mongo status mismatch: ${clientTicketDoc?.data?.Status}`);
  assert(/DB persistence client close/i.test(String(clientTicketDoc?.data?.Remarks || '')), 'Client ticket Mongo remarks were not updated.');

  const fmsSave = await post('saveFmsTaskForApp', [{
    'Task ID': fmsId,
    Client_Id: smokeClientId,
    'Client Name': 'Kriscel Tech Private Limited',
    'Employee ID': smokeUserId,
    empId: smokeUserId,
    'Employee Name': smokeUserName,
    who: smokeUserName,
    'Task Description': 'DB persistence smoke FMS',
    Description: 'DB persistence smoke FMS',
    'Plan Date': liveDate,
    Date: liveDate,
    Status: 'Pending',
    TAT: 10
  }]);
  assert(fmsSave.payload.success, `FMS save failed: ${fmsSave.payload.message || 'unknown error'}`);
  const fmsDocCreated = await findLegacy('FmsTask', 'Task ID', fmsId);
  assert(!!fmsDocCreated, 'FMS task was not written to MongoDB.');
  assert(fmsDocCreated?.data?.Status === 'Pending', `FMS Mongo initial status mismatch: ${fmsDocCreated?.data?.Status}`);

  const fmsDone = await post('markFmsTaskDoneInApp', [fmsId, 'DB persistence complete', smokeUserId]);
  assert(fmsDone.payload.success, `FMS completion failed: ${fmsDone.payload.message || 'unknown error'}`);
  const fmsDocDone = await findLegacy('FmsTask', 'Task ID', fmsId);
  assert(!!fmsDocDone, 'Completed FMS task not found in MongoDB.');
  assert(fmsDocDone?.data?.Status === 'Completed', `FMS Mongo completed status mismatch: ${fmsDocDone?.data?.Status}`);
  assert(fmsDocDone?.data?.['Done Date'] === liveDate || fmsDocDone?.data?.actualDate === liveDate, `FMS Mongo completion date mismatch: ${fmsDocDone?.data?.['Done Date']} / ${fmsDocDone?.data?.actualDate}`);

  const todoWrite = await post('addTodo', [smokeUserId, todoTask, 'Low', liveDate, '15']);
  assert(todoWrite.payload.success, `Todo create failed: ${todoWrite.payload.message || 'unknown error'}`);
  const todoId = todoWrite.payload.item?.['Task ID'];
  assert(!!todoId, 'Todo create did not return Task ID.');
  const todoDoc = todoId ? await findLegacy('Todo', 'Task ID', todoId) : null;
  assert(!!todoDoc, 'Todo create did not write MongoDB document.');
  assert(todoDoc?.data?.Task === todoTask, `Todo Mongo task mismatch: ${todoDoc?.data?.Task}`);

  const dashboardRead = await post('getDashboardData', [smokeUserId, 'today']);
  assert(dashboardRead.payload.success, `Dashboard read failed: ${dashboardRead.payload.message || 'unknown error'}`);
  const dashboard = dashboardRead.payload.data?.data || dashboardRead.payload.data || {};
  const dashboardTickets = dashboard.tickets || [];
  const dashboardTodos = dashboard.todos || [];
  assert(dashboardTickets.some((ticket) => ticket['Ticket ID'] === ticketId || ticket.ID === ticketId), 'Dashboard ticket list does not include Mongo-written ticket.');
  assert(dashboardTodos.some((todo) => todo['Task ID'] === todoId || todo.ID === todoId), 'Dashboard todo list does not include Mongo-written todo.');
  assert(Number(dashboard.kpis?.pendingTickets) >= 1, `Dashboard pendingTickets did not reflect Mongo ticket write: ${dashboard.kpis?.pendingTickets}`);
  assert(Number(dashboard.kpis?.pendingFms) >= 0, 'Dashboard pendingFms KPI is missing or invalid.');
  assert(typeof dashboard.kpis?.totalExpenses !== 'undefined', 'Dashboard totalExpenses KPI is missing after Mongo expense write.');

  const expenseRead = await post('getExpensesForUser', [smokeUserId]);
  assert(expenseRead.payload.success, `Expense read failed: ${expenseRead.payload.message || 'unknown error'}`);
  assert((expenseRead.payload.data || []).some((row) => row.ExpenseID === expenseId), 'Expense readback does not include Mongo-written expense.');

  const requestStatusRead = await post('getUserRequestStatus', [smokeUserId]);
  assert(requestStatusRead.payload.success, `User request status read failed: ${requestStatusRead.payload.message || 'unknown error'}`);
  const requestRows = requestStatusRead.payload.data || [];
  assert(requestRows.some((row) => row.ID === leaveId && row.Type === 'Leave'), 'User request status does not include Mongo-written leave.');
  assert(requestRows.some((row) => row.ID === intimationId && row.Type === 'Intimation'), 'User request status does not include Mongo-written intimation.');

  if (failures.length) {
    throw new Error(failures.join('\n'));
  }

  console.log('Mongo persistence verification passed.');
}

try {
  await main();
} finally {
  try {
    if (mongoose.connection.readyState !== 0) {
      await purgeTestArtifacts();
      await mongoose.disconnect();
    }
  } catch (error) {
    console.error(`Mongo persistence cleanup warning: ${error.message}`);
  }
}
