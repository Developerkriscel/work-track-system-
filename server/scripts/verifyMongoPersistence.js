import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDatabase } from '../config/database.js';
import { employeeToken, normalizeEmployee } from '../services/auth.service.js';
import { insertRow, listRows } from '../services/legacyStore.service.js';
import { LegacyModels } from '../models/legacyModels.js';

const baseUrl = process.env.PERSISTENCE_URL || `http://localhost:${process.env.PORT || 5000}`;
const prefix = `MERN_VERIFY_${Date.now()}`;
const failures = [];
let actorId = '';
let token = '';

const today = new Date().toISOString().slice(0, 10);

function assert(condition, message) {
  if (!condition) failures.push(message);
}

async function request(path, body = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  let payload = {};
  try {
    payload = await response.json();
  } catch {
    payload = { success: false, message: `Non-JSON response (${response.status})` };
  }
  return { ok: response.ok, status: response.status, payload };
}

async function cleanup() {
  // Remove this run and any interrupted prior run, while leaving real user data untouched.
  const reservedPrefix = /^MERN_VERIFY_/;
  await LegacyModels.Attendance.deleteMany({ 'data.AttendanceID': reservedPrefix });
  await LegacyModels.Ticket.deleteMany({ 'data.Ticket ID': reservedPrefix });
  await LegacyModels.Todo.deleteMany({
    $or: [
      { 'data.Task ID': reservedPrefix },
      { 'data.Task': reservedPrefix }
    ]
  });
  await LegacyModels.Expense.deleteMany({
    $or: [
      { 'data.ExpenseID': reservedPrefix },
      { 'data.Description': reservedPrefix }
    ]
  });
  await LegacyModels.TicketHistory.deleteMany({ 'data.Ticket ID': reservedPrefix });
  await LegacyModels.Leave.deleteMany({ 'data.LeaveID': reservedPrefix });
  await LegacyModels.Intimation.deleteMany({ 'data.IntimationID': reservedPrefix });
}

function requireSuccess(result, label) {
  assert(result.ok && result.payload?.success, `${label} failed: ${result.payload?.message || result.status}`);
  return result.payload;
}

async function main() {
  await connectDatabase();
  await cleanup();

  const users = await listRows('User');
  const existingAttendance = await listRows('Attendance');
  const actor = users.find((row) => {
    const status = String(row.Status || row.status || 'Active').toLowerCase();
    const id = String(row['Employee ID'] || row.employeeId || row['User ID'] || '').trim();
    const hasTodayPunch = existingAttendance.some((attendance) =>
      String(attendance['Employee ID'] || attendance.employeeId || attendance.EmpID || '').trim().toUpperCase() === id.toUpperCase()
      && String(attendance.Date || '').slice(0, 10) === today
    );
    return status === 'active' && id && !hasTodayPunch;
  });
  actorId = String(actor?.['Employee ID'] || actor?.employeeId || '').trim();
  assert(!!actorId, 'No active Mongo employee is available for persistence verification.');
  if (!actorId) throw new Error(failures.join('\n'));

  token = employeeToken(normalizeEmployee(actor));

  const attendanceId = `${prefix}_ATT`;
  const ticketId = `${prefix}_TICKET`;
  const todoTask = `${prefix} todo`;
  const expenseId = `${prefix}_EXP`;
  const targetUser = users.find((row) =>
    String(row['Manager ID'] || row.Manager || row.managerId || '')
      .split(',')
      .map((item) => item.trim().toUpperCase())
      .includes(actorId.toUpperCase())
    && String(row.Status || row.status || 'Active').toLowerCase() === 'active'
  );

  const missingEvidence = await request('/api/attendance/record', {
    payload: {
      AttendanceID: `${attendanceId}_NO_EVIDENCE`,
      Date: today,
      Action: 'Punch In'
    }
  });
  assert(!missingEvidence.payload?.success && /photo|GPS|location/i.test(missingEvidence.payload?.message || ''), 'Attendance accepted a punch without photo and GPS evidence.');

  const attendance = requireSuccess(await request('/api/attendance/record', {
    payload: {
      AttendanceID: attendanceId,
      Date: today,
      Action: 'Punch In',
      Time: '09:55 am',
      'Punch In': '09:55 am',
      Status: 'Pending',
      Latitude: '28.6139',
      Longitude: '77.2090',
      Photo: { base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', fileName: `${attendanceId}.png` }
    }
  }), 'Attendance write');
  assert(attendance.item?.AttendanceID === attendanceId, 'Attendance response lost the requested AttendanceID.');
  assert(attendance.item?.Status === 'Need Approval', `Attendance API returned unexpected status: ${attendance.item?.Status}`);
  assert(attendance.item?.['Admin Approval'] === 'Pending', 'Attendance API response omitted Pending Admin Approval.');

  const attendanceDoc = await LegacyModels.Attendance.findOne({ 'data.AttendanceID': attendanceId }).lean();
  assert(!!attendanceDoc, 'Attendance record was not persisted in MongoDB.');
  assert(attendanceDoc?.data?.['Employee ID'] === actorId, 'Attendance Employee ID was not taken from the authenticated session.');
  assert(attendanceDoc?.data?.Status === 'Need Approval', `Attendance status did not match Apps Script: ${attendanceDoc?.data?.Status}`);
  assert(attendanceDoc?.data?.['Admin Approval'] === 'Pending', 'Attendance Admin Approval did not default to Pending.');

  const attendanceRead = requireSuccess(await request('/api/attendance/list', { startDate: today, endDate: today }), 'Attendance read');
  assert((attendanceRead.data || []).some((row) => row.AttendanceID === attendanceId), 'Attendance readback did not return the Mongo-written row.');

  if (targetUser) {
    const targetId = String(targetUser['Employee ID'] || targetUser.employeeId);
    const approvalAttendanceId = `${prefix}_APPROVAL`;
    await insertRow('Attendance', {
      AttendanceID: approvalAttendanceId,
      'Employee ID': targetId,
      'Employee Name': targetUser['Employee Name'] || targetUser.name,
      Date: today,
      Time: new Date().toISOString(),
      Action: 'Punch In',
      'Punch In': '10:00 am',
      Status: 'Need Approval',
      'Admin Approval': 'Pending',
      'Admin Remarks': ''
    });
    await insertRow('Attendance', {
      AttendanceID: `${approvalAttendanceId}_OUT`,
      'Employee ID': targetId,
      'Employee Name': targetUser['Employee Name'] || targetUser.name,
      Date: today,
      Time: new Date().toISOString(),
      Action: 'Punch Out',
      'Punch Out': '11:00 am',
      Duration: '1h 0m',
      'Total Working Hours': '1h 0m',
      Status: 'Need Approval',
      'Admin Approval': 'Pending',
      'Admin Remarks': ''
    });
    const queue = requireSuccess(await request('/api/approvals/queue', { employeeId: actorId }), 'Attendance approval queue');
    const approvalGroup = (queue.attendance || []).find((row) => String(row.AttendanceID || '').startsWith(`${targetId}|${today}`));
    assert(!!approvalGroup, `Manager could not see team attendance in the approval queue: ${JSON.stringify(queue.attendance || [])}`);
    if (approvalGroup) {
      const approval = requireSuccess(await request('/api/approvals/action', {
        payload: { type: 'Attendance', id: approvalGroup.AttendanceID, action: 'Approved', newPunchIn: '10:30', newPunchOut: '18:00', remarks: `${prefix} approval` }
      }), 'Attendance approval action');
      assert(approval.item?.Status === 'Present', 'Attendance approval did not set Apps Script Present status.');
      assert(approval.item?.['Admin Approval'] === 'Approved', 'Attendance approval did not set Approved admin status.');
    }
    const approvedDoc = await LegacyModels.Attendance.findOne({ 'data.AttendanceID': approvalAttendanceId }).lean();
    const approvedOutDoc = await LegacyModels.Attendance.findOne({ 'data.AttendanceID': `${approvalAttendanceId}_OUT` }).lean();
    assert(approvedDoc?.data?.Status === 'Present', 'Attendance approval was not persisted in MongoDB.');
    assert(approvedDoc?.data?.['Admin Approval'] === 'Approved', 'Attendance approval field was not persisted in MongoDB.');
    assert(approvedDoc?.data?.['Punch In'] === '10:30', 'Attendance punch-in correction was not persisted.');
    assert(approvedOutDoc?.data?.['Punch Out'] === '18:00', 'Attendance punch-out correction was not persisted.');
    assert(approvedOutDoc?.data?.['Total Working Hours'] === '7h 30m', 'Attendance correction did not recalculate duration.');
  } else {
    assert(false, 'No active direct-report employee was available for approval verification.');
  }

  const leave = requireSuccess(await request('/api/attendance/leave', {
    payload: {
      LeaveID: `${prefix}_LEAVE`,
      'Start Date': today,
      'End Date': today,
      'Day Type': 'Full Day',
      'Leave Type': 'Casual Leave',
      Reason: `${prefix} leave`
    }
  }), 'Leave request');
  assert(leave.item?.Status === 'Pending', 'Leave request did not default to Pending.');
  assert(await LegacyModels.Leave.exists({ 'data.LeaveID': `${prefix}_LEAVE` }), 'Leave request was not persisted in MongoDB.');

  const intimation = requireSuccess(await request('/api/attendance/intimation', {
    payload: {
      IntimationID: `${prefix}_INTIMATION`,
      'Intimation Date': today,
      'Intimation Type': 'Work from Home',
      Reason: `${prefix} intimation`
    }
  }), 'Work intimation');
  assert(intimation.item?.Status === 'Submitted', 'Work intimation did not default to Submitted.');
  assert(await LegacyModels.Intimation.exists({ 'data.IntimationID': `${prefix}_INTIMATION` }), 'Work intimation was not persisted in MongoDB.');

  const duplicatePunchIn = await request('/api/attendance/record', {
    payload: {
      AttendanceID: `${attendanceId}_DUPLICATE`,
      Date: today,
      Action: 'Punch In',
      Latitude: '28.6139',
      Longitude: '77.2090',
      Photo: { base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', fileName: `${attendanceId}_duplicate.png` }
    }
  });
  assert(!duplicatePunchIn.payload?.success && /already.*Punch In|pehle.*Punch In/i.test(duplicatePunchIn.payload?.message || ''), 'Duplicate Punch In was not rejected.');

  const ticket = requireSuccess(await request('/api/tickets/create', {
    ticketPayload: {
      'Ticket ID': ticketId,
      Client_Id: 'CL000',
      'Task Category': 'Verification',
      Priority: 'Normal',
      'Task Description': `${prefix} ticket`,
      'Plan Date': today,
      TAT: 30
    }
  }), 'Ticket create');
  assert(ticket.item?.['Ticket ID'] === ticketId, 'Ticket response lost the requested Ticket ID.');

  const ticketDoc = await LegacyModels.Ticket.findOne({ 'data.Ticket ID': ticketId }).lean();
  assert(ticketDoc?.data?.Status === 'Open', `Ticket was not persisted with Open status: ${ticketDoc?.data?.Status}`);

  const ticketProgress = requireSuccess(await request('/api/tickets/update', {
    ticketId,
    updatePayload: { newStatus: 'In Progress' }
  }), 'Ticket status update');
  assert(ticketProgress.finalStatus === 'In Progress', 'Ticket status update did not return In Progress.');

  const ticketUpdatedDoc = await LegacyModels.Ticket.findOne({ 'data.Ticket ID': ticketId }).lean();
  assert(ticketUpdatedDoc?.data?.Status === 'In Progress', 'Ticket status update was not persisted in MongoDB.');
  assert(await LegacyModels.TicketHistory.exists({ 'data.Ticket ID': ticketId }), 'Ticket history was not persisted in MongoDB.');

  const todo = requireSuccess(await request('/api/todo/create', {
    task: todoTask,
    priority: 'Low',
    dueDate: today,
    tat: '15'
  }), 'To-Do create');
  const todoId = todo.item?.['Task ID'];
  assert(!!todoId, 'To-Do create did not return a Task ID.');
  assert(!!(todoId && await LegacyModels.Todo.findOne({ 'data.Task ID': todoId })), 'To-Do was not persisted in MongoDB.');

  const expense = requireSuccess(await request('/api/expenses/record', {
    payload: {
      ExpenseID: expenseId,
      Date: today,
      Type: 'Verification',
      Amount: '1.00',
      Description: `${prefix} expense`
    }
  }), 'Expense create');
  assert(expense.item?.ExpenseID === expenseId, 'Expense response lost the requested ExpenseID.');
  const expenseDoc = await LegacyModels.Expense.findOne({ 'data.ExpenseID': expenseId }).lean();
  assert(expenseDoc?.data?.Status === 'Pending', 'Expense was not persisted with Pending status.');

  const dashboard = requireSuccess(await request('/api/dashboard/data', { filterRange: 'today' }), 'Dashboard read');
  assert(typeof dashboard.data?.kpis === 'object' || typeof dashboard.kpis === 'object', 'Dashboard response is missing KPI data.');

  const punchOut = requireSuccess(await request('/api/attendance/record', {
    payload: {
      AttendanceID: `${attendanceId}_OUT`,
      Date: today,
      Action: 'Punch Out',
      Latitude: '28.6139',
      Longitude: '77.2090',
      Photo: { base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', fileName: `${attendanceId}_out.png` }
    }
  }), 'Attendance punch out');
  assert(/\d+h \d+m/.test(punchOut.item?.Duration || ''), 'Punch Out did not persist a calculated duration.');
  const punchOutDoc = await LegacyModels.Attendance.findOne({ 'data.AttendanceID': `${attendanceId}_OUT` }).lean();
  assert(punchOutDoc?.data?.['Total Working Hours'] === punchOut.item?.Duration, 'Punch Out total working hours did not match duration.');

  if (failures.length) throw new Error(failures.join('\n'));
  console.log(`MERN Mongo persistence verification passed for authenticated employee ${actorId}.`);
}

try {
  await main();
} finally {
  try {
    if (mongoose.connection.readyState === 1) {
      await cleanup();
      await mongoose.disconnect();
    }
  } catch (error) {
    console.error(`Mongo persistence cleanup warning: ${error.message}`);
  }
}
