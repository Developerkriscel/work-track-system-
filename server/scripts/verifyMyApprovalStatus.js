import 'dotenv/config';
import fs from 'fs';
import mongoose from 'mongoose';
import { connectDatabase } from '../config/database.js';
import { LegacyModels } from '../models/legacyModels.js';
import { getMyApprovalStatus } from '../services/myApprovalStatus.service.js';
import { upsertRow } from '../services/legacyStore.service.js';

const failures = [];
const cleanupUsers = new Set();
const cleanupLeaves = new Set();
const cleanupIntimations = new Set();
const cleanupAttendance = new Set();
const cleanupTickets = new Set();

const assert = (condition, message) => {
  if (!condition) failures.push(message);
};

function tempId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`.toUpperCase();
}

async function seedUser(employeeId, name) {
  cleanupUsers.add(employeeId);
  await upsertRow('User', 'Employee ID', employeeId, {
    'Employee ID': employeeId,
    'User ID': employeeId,
    'Employee Name': name,
    Name: name,
    Role: 'User',
    Status: 'Active',
    Department: 'QA',
    Password: 'Verify@123'
  });
}

await connectDatabase();

const employeeId = tempId('MAS_EMP');
const employeeName = 'Approval Status Employee';
const leaveId = `MAS_LEAVE_${Date.now()}`;
const intimationId = `MAS_INTIMATION_${Date.now()}`;
const attendanceId = `MAS_ATT_${Date.now()}`;
const ticketId = `MAS_TICKET_${Date.now()}`;

cleanupLeaves.add(leaveId);
cleanupIntimations.add(intimationId);
cleanupAttendance.add(attendanceId);
cleanupTickets.add(ticketId);

try {
  await seedUser(employeeId, employeeName);

  await upsertRow('Leave', 'LeaveID', leaveId, {
    LeaveID: leaveId,
    'Leave ID': leaveId,
    'Employee ID': employeeId,
    'Employee Name': employeeName,
    'Leave Type': 'Casual Leave',
    'Start Date': '2026-07-21',
    'End Date': '2026-07-22',
    Reason: 'Verifier leave reason',
    Status: 'Approved',
    'Admin Remarks': 'Leave approved by verifier.'
  });

  await upsertRow('Intimation', 'IntimationID', intimationId, {
    IntimationID: intimationId,
    'Intimation ID': intimationId,
    'Employee ID': employeeId,
    'Employee Name': employeeName,
    'Intimation Type': 'Work From Home',
    'Intimation Date': '2026-07-23',
    Reason: 'Verifier intimation reason',
    Status: 'Submitted',
    'Admin Remarks': 'Waiting for manager action.'
  });

  await upsertRow('Attendance', 'AttendanceID', attendanceId, {
    AttendanceID: attendanceId,
    'Employee ID': employeeId,
    EmpID: employeeId,
    'Employee Name': employeeName,
    Date: '2026-07-24T10:00:00+05:30',
    Action: 'Punch In',
    'Punch In': '10:00 am',
    Status: 'Need Approval',
    'Admin Approval': 'Pending',
    'Admin Remarks': 'Attendance waiting for review.'
  });

  await upsertRow('Ticket', 'Ticket ID', ticketId, {
    'Ticket ID': ticketId,
    ID: ticketId,
    'Employee ID': employeeId,
    'Employee Name': employeeName,
    'Task Category': 'Documentation',
    'Task Description': 'Verifier ticket task',
    'Plan Date': '2026-07-25',
    Status: 'Pending Approval',
    Remarks: 'Ticket submitted for approval.'
  });

  const result = await getMyApprovalStatus(employeeId);
  assert(result.success, 'My Approval Status service should return success for a valid employee.');
  assert(Array.isArray(result.data), 'My Approval Status service should return a data array.');

  const rows = result.data || [];
  const leaveRow = rows.find((row) => row.Type === 'Leave' && row.id === leaveId);
  const intimationRow = rows.find((row) => row.Type === 'Intimation' && row.id === intimationId);
  const attendanceRow = rows.find((row) => row.Type === 'Attendance' && row.id === attendanceId);
  const ticketRow = rows.find((row) => row.Type === 'Ticket' && row.id === ticketId);

  assert(Boolean(leaveRow), 'Leave rows should appear in My Approval Status.');
  assert(Boolean(intimationRow), 'Intimation rows should appear in My Approval Status.');
  assert(Boolean(attendanceRow), 'Attendance approval rows should appear in My Approval Status.');
  assert(Boolean(ticketRow), 'Ticket rows in approval-related states should appear in My Approval Status.');

  assert(leaveRow?.Status === 'Approved', 'Leave status should match Mongo-backed value.');
  assert(intimationRow?.Status === 'Submitted', 'Intimation status should match Mongo-backed value.');
  assert(attendanceRow?.Status === 'Pending', 'Attendance should prefer Admin Approval / pending state.');
  assert(ticketRow?.Status === 'Pending Approval', 'Ticket status should match Mongo-backed value.');

  assert(leaveRow?.SubType === 'Casual Leave', 'Leave subtype should map from Leave Type.');
  assert(intimationRow?.SubType === 'Work From Home', 'Intimation subtype should map from Intimation Type.');
  assert(attendanceRow?.SubType === 'Punch In', 'Attendance subtype should map from Action.');
  assert(ticketRow?.SubType === 'Documentation', 'Ticket subtype should map from Task Category.');

  assert(
    rows[0]?.Type === 'Ticket',
    'Most recent approval-history item should sort first by date.'
  );

  const foreignResult = await getMyApprovalStatus(tempId('MAS_OTHER'));
  assert(foreignResult.success && foreignResult.data.length === 0, 'Unknown employee should receive an empty approval-history list.');

  const pageSource = fs.readFileSync('client/src/features/my-approval-status/components/MyApprovalStatusTable.jsx', 'utf8');
  assert(/Approval History/.test(pageSource), 'My Approval Status page should expose the approval-history table heading.');
  assert(/No approval status records found/.test(pageSource), 'My Approval Status table should include its empty-state copy.');
} catch (error) {
  failures.push(`My Approval Status verification failed: ${error.message}`);
} finally {
  if (cleanupTickets.size) {
    await LegacyModels.Ticket.deleteMany({
      $or: [...cleanupTickets].map((ticketIdValue) => ({ $or: [{ legacyId: ticketIdValue }, { 'data.Ticket ID': ticketIdValue }] }))
    });
  }
  if (cleanupLeaves.size) {
    await LegacyModels.Leave.deleteMany({
      $or: [...cleanupLeaves].map((leaveIdValue) => ({ $or: [{ legacyId: leaveIdValue }, { 'data.LeaveID': leaveIdValue }, { 'data.Leave ID': leaveIdValue }] }))
    });
  }
  if (cleanupIntimations.size) {
    await LegacyModels.Intimation.deleteMany({
      $or: [...cleanupIntimations].map((intimationIdValue) => ({ $or: [{ legacyId: intimationIdValue }, { 'data.IntimationID': intimationIdValue }, { 'data.Intimation ID': intimationIdValue }] }))
    });
  }
  if (cleanupAttendance.size) {
    await LegacyModels.Attendance.deleteMany({
      $or: [...cleanupAttendance].map((attendanceIdValue) => ({ $or: [{ legacyId: attendanceIdValue }, { 'data.AttendanceID': attendanceIdValue }] }))
    });
  }
  if (cleanupUsers.size) {
    await LegacyModels.User.deleteMany({
      $or: [...cleanupUsers].map((employeeIdValue) => ({ $or: [{ legacyId: employeeIdValue }, { 'data.Employee ID': employeeIdValue }] }))
    });
  }

  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}

if (failures.length) {
  console.error(failures.join('\n---\n'));
  process.exit(1);
}

console.log('My Approval Status aggregation verification passed.');
