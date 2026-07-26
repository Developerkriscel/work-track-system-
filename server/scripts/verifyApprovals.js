import 'dotenv/config';
import fs from 'fs';
import mongoose from 'mongoose';
import { connectDatabase } from '../config/database.js';
import { LegacyModels } from '../models/legacyModels.js';
import {
  adminTicketAction,
  getPendingApprovals,
  processApprovalAction,
  transferTicketApproval
} from '../services/approvals.service.js';
import { upsertRow, insertRow, listRows } from '../services/legacyStore.service.js';

const failures = [];
const cleanupUsers = new Set();
const cleanupTickets = new Set();
const cleanupLeaves = new Set();
const cleanupIntimations = new Set();
const cleanupAttendance = new Set();
const cleanupHistory = new Set();

const assert = (condition, message) => {
  if (!condition) failures.push(message);
};

function tempId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`.toUpperCase();
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

async function seedUser({
  employeeId,
  name,
  role,
  department = 'Operations',
  managerId = '',
  taskApprover = '',
  status = 'Active'
}) {
  cleanupUsers.add(employeeId);
  await upsertRow('User', 'Employee ID', employeeId, {
    'Employee ID': employeeId,
    'User ID': employeeId,
    'Employee Name': name,
    Name: name,
    Role: role,
    Department: department,
    Status: status,
    'Manager ID': managerId,
    Manager: managerId,
    'Task Approver': taskApprover,
    Password: 'Verify@123'
  });
}

async function seedAttendanceGate(employeeId, employeeName) {
  const attendanceId = `ATT_GATE_${employeeId}_${Date.now()}`;
  cleanupAttendance.add(attendanceId);
  await insertRow('Attendance', {
    AttendanceID: attendanceId,
    'Employee ID': employeeId,
    EmpID: employeeId,
    'Employee Name': employeeName,
    Date: `${today()}T09:00:00+05:30`,
    Time: `${today()}T09:00:00+05:30`,
    Action: 'Punch In',
    'Punch In': '09:00 am',
    Status: 'Present'
  });
}

await connectDatabase();

const managerId = tempId('APR_MGR');
const targetApproverId = tempId('APR_TRF');
const teamEmployeeId = tempId('APR_EMP');
const outsiderEmployeeId = tempId('APR_OUT');
const superAdminId = tempId('APR_SA');
const regularUserId = tempId('APR_USR');

const ticketId = `TICKET_${Date.now()}`;
const leaveId = `LEAVE_${Date.now()}`;
const intimationId = `INTIMATION_${Date.now()}`;
const attendanceApprovalId = `ATT_APPROVAL_${Date.now()}`;
const attendanceGroupId = `${teamEmployeeId}|${today()}`;

cleanupTickets.add(ticketId);
cleanupLeaves.add(leaveId);
cleanupIntimations.add(intimationId);
cleanupAttendance.add(attendanceApprovalId);

try {
  await seedUser({
    employeeId: managerId,
    name: 'Approval Manager',
    role: 'Manager',
    department: 'Operations'
  });
  await seedUser({
    employeeId: targetApproverId,
    name: 'Transfer Approver',
    role: 'Manager',
    department: 'Operations'
  });
  await seedUser({
    employeeId: teamEmployeeId,
    name: 'Team Employee',
    role: 'User',
    department: 'CRM',
    managerId,
    taskApprover: managerId
  });
  await seedUser({
    employeeId: outsiderEmployeeId,
    name: 'Outside Employee',
    role: 'User',
    department: 'Digital'
  });
  await seedUser({
    employeeId: superAdminId,
    name: 'Approval Super Admin',
    role: 'Super Admin',
    department: 'Management'
  });
  await seedUser({
    employeeId: regularUserId,
    name: 'Regular Employee',
    role: 'User',
    department: 'Development'
  });

  await seedAttendanceGate(managerId, 'Approval Manager');
  await seedAttendanceGate(targetApproverId, 'Transfer Approver');
  await seedAttendanceGate(superAdminId, 'Approval Super Admin');

  await upsertRow('Ticket', 'Ticket ID', ticketId, {
    'Ticket ID': ticketId,
    ID: ticketId,
    Client_Id: 'CL000',
    Name: 'Kriscel Test Client',
    'Client Name': 'Kriscel Test Client',
    'Employee ID': teamEmployeeId,
    'Employee Name': 'Team Employee',
    'Task Category': 'CRM',
    'Task Description': 'Approval lifecycle verification ticket',
    Status: 'Pending Approval',
    'Plan Date': today(),
    TAT: '60',
    Remarks: 'Pending manager review',
    'Task Approver': managerId
  });

  await upsertRow('Leave', 'LeaveID', leaveId, {
    LeaveID: leaveId,
    'Leave ID': leaveId,
    'Employee ID': teamEmployeeId,
    'Employee Name': 'Team Employee',
    'Leave Type': 'Casual Leave',
    'Day Type': 'Full Day',
    'Start Date': today(),
    'End Date': today(),
    Reason: 'Approval verifier leave request',
    Status: 'Pending'
  });

  await upsertRow('Intimation', 'IntimationID', intimationId, {
    IntimationID: intimationId,
    'Intimation ID': intimationId,
    'Employee ID': teamEmployeeId,
    'Employee Name': 'Team Employee',
    'Intimation Type': 'Work From Home',
    'Intimation Date': today(),
    Reason: 'Approval verifier intimation',
    Status: 'Submitted'
  });

  await insertRow('Attendance', {
    AttendanceID: attendanceApprovalId,
    'Employee ID': teamEmployeeId,
    EmpID: teamEmployeeId,
    'Employee Name': 'Team Employee',
    Date: `${today()}T10:15:00+05:30`,
    Time: `${today()}T10:15:00+05:30`,
    Action: 'Punch In',
    'Punch In': '10:15 am',
    Status: 'Need Approval'
  });

  const managerQueue = await getPendingApprovals(managerId);
  assert(managerQueue.success, 'Manager queue should load successfully.');
  assert(
    managerQueue.tickets.some((row) => row['Ticket ID'] === ticketId && row._isActionableByMe === true),
    'Manager should receive actionable pending ticket approval.'
  );
  assert(
    managerQueue.leaves.some((row) => String(row.LeaveID || row['Leave ID']) === leaveId),
    'Manager should see subordinate leave request.'
  );
  assert(
    managerQueue.intimations.some((row) => String(row.IntimationID || row['Intimation ID']) === intimationId),
    'Manager should see subordinate intimation request.'
  );
  assert(
    managerQueue.attendance.some((row) => String(row.AttendanceID) === attendanceGroupId || String(row['Employee ID']) === teamEmployeeId),
    'Manager should see subordinate attendance approval group.'
  );

  const regularQueue = await getPendingApprovals(regularUserId);
  assert(!regularQueue.success, 'Regular employee should not access approvals queue.');

  const leaveApprove = await processApprovalAction({
    type: 'Leave',
    id: leaveId,
    action: 'Approved',
    adminId: managerId,
    remarks: 'Leave approved in verifier.'
  });
  assert(leaveApprove.success, 'Manager should be able to approve subordinate leave.');

  const intimationReject = await processApprovalAction({
    type: 'Intimation',
    id: intimationId,
    action: 'Rejected',
    adminId: managerId,
    remarks: 'Intimation rejected in verifier.'
  });
  assert(intimationReject.success, 'Manager should be able to reject subordinate intimation.');

  const attendanceApprove = await processApprovalAction({
    type: 'Attendance',
    id: attendanceGroupId,
    action: 'Approved',
    adminId: managerId,
    remarks: 'Attendance approved in verifier.'
  });
  assert(attendanceApprove.success, 'Manager should be able to approve subordinate attendance.');

  const leaveRows = await listRows('Leave');
  const leaveRow = leaveRows.find((row) => String(row.LeaveID || row['Leave ID']) === leaveId);
  assert(/approved/i.test(String(leaveRow?.Status || '')), 'Approved leave should persist updated status.');

  const intimationRows = await listRows('Intimation');
  const intimationRow = intimationRows.find((row) => String(row.IntimationID || row['Intimation ID']) === intimationId);
  assert(/rejected/i.test(String(intimationRow?.Status || '')), 'Rejected intimation should persist updated status.');

  const attendanceRows = await listRows('Attendance');
  const teamAttendanceRows = attendanceRows.filter((row) => String(row['Employee ID'] || row.EmpID) === teamEmployeeId);
  assert(
    teamAttendanceRows.some((row) => /present/i.test(String(row.Status || ''))),
    'Approved attendance should persist Present status on attendance rows.'
  );

  const transferResult = await transferTicketApproval(ticketId, targetApproverId, managerId, 'Transfering for verification.');
  assert(transferResult.success, 'Manager should be able to transfer ticket approval.');

  const targetQueue = await getPendingApprovals(targetApproverId);
  assert(
    targetQueue.success &&
      targetQueue.tickets.some((row) => row['Ticket ID'] === ticketId && row._isActionableByMe === true),
    'Transferred approver should receive actionable ticket approval.'
  );

  const reworkResult = await adminTicketAction(ticketId, targetApproverId, 'Reject', 'Please rework and resubmit.');
  assert(reworkResult.success, 'Transferred approver should be able to send ticket for rework.');

  const ticketRows = await listRows('Ticket');
  const updatedTicket = ticketRows.find((row) => String(row['Ticket ID']) === ticketId);
  assert(/rework/i.test(String(updatedTicket?.Status || '')), 'Ticket rework action should persist Rework status.');

  const historyRows = await listRows('TicketHistory');
  const ticketHistoryRows = historyRows.filter((row) => String(row['Ticket ID']) === ticketId);
  ticketHistoryRows.forEach((row) => cleanupHistory.add(String(row['History ID'] || row.ID || row._legacyId || '')));
  assert(ticketHistoryRows.length >= 1, 'Ticket approval actions should create ticket history rows.');

  const ticketTableSource = fs.readFileSync('client/src/features/approvals/components/TicketApprovalTable.jsx', 'utf8');
  assert(/View only/.test(ticketTableSource), 'Approvals ticket table should render a View only state for non-actionable rows.');
  assert(/Approve/.test(ticketTableSource) && /Rework/.test(ticketTableSource) && /Transfer/.test(ticketTableSource), 'Approvals ticket table should expose Approve, Rework, and Transfer actions.');
} catch (error) {
  failures.push(`Approvals verification failed: ${error.message}`);
} finally {
  if (cleanupHistory.size) {
    await LegacyModels.TicketHistory.deleteMany({
      $or: [...cleanupHistory].filter(Boolean).map((historyId) => ({ $or: [{ legacyId: historyId }, { 'data.History ID': historyId }] }))
    });
  }
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

console.log('Approvals lifecycle and role verification passed.');
