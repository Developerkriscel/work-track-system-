import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDatabase } from '../config/database.js';
import { createAccessToken } from '../middleware/auth.middleware.js';
import { LegacyModels } from '../models/legacyModels.js';
import { insertRow, listRows, upsertRow } from '../services/legacyStore.service.js';

const baseUrl = process.env.PARITY_URL || `http://localhost:${process.env.PORT || 5000}`;
const failures = [];
const cleanup = {
  users: new Set(),
  clients: new Set(),
  tickets: new Set(),
  leaves: new Set(),
  intimations: new Set(),
  attendance: new Set(),
  expenses: new Set(),
  fms: new Set(),
  todos: new Set(),
  social: new Set()
};

const assert = (condition, message) => {
  if (!condition) failures.push(message);
};

const safe = (value = '') => String(value ?? '').trim();
const first = (row = {}, keys = [], fallback = '') => keys.map((key) => row?.[key]).find((value) => safe(value)) ?? fallback;

async function post(path, headers, body = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  let payload;
  try {
    payload = await response.json();
  } catch {
    payload = { success: false, message: `Non-JSON response from ${path}` };
  }
  return { response, payload };
}

function tempId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`.toUpperCase();
}

async function main() {
  await connectDatabase();

  const users = await listRows('User');
  const activeUser = users.find((row) => /active/i.test(first(row, ['Status', 'status'], 'Active')));
  const employeeId = activeUser ? first(activeUser, ['Employee ID', 'User ID', 'employeeId', 'userId']) : tempId('NTF_EMP');
  const employeeName = activeUser ? first(activeUser, ['Employee Name', 'Name'], 'Notification User') : 'Notification User';
  const role = activeUser ? first(activeUser, ['Role', 'role'], 'User') : 'User';

  if (!activeUser) {
    cleanup.users.add(employeeId);
    await upsertRow('User', 'Employee ID', employeeId, {
      'Employee ID': employeeId,
      'User ID': employeeId,
      'Employee Name': employeeName,
      Role: role,
      Department: 'QA',
      Status: 'Active',
      Password: 'Notification@123'
    });
  }

  const clients = await listRows('Client');
  const activeClient = clients.find((row) => !/^inactive$/i.test(safe(row.Status || 'Active'))) || clients[0];
  assert(!!activeClient, 'No active client exists for notification verification.');
  const clientId = first(activeClient, ['Client_Id', 'Client ID', 'clientId']);
  const clientName = first(activeClient, ['Client Name', 'CustomerName', 'name'], clientId);

  const employeeToken = createAccessToken({ kind: 'employee', id: employeeId, role });
  const clientToken = createAccessToken({ kind: 'client', id: clientId, role: 'Client' });
  const employeeHeaders = { Authorization: `Bearer ${employeeToken}` };
  const clientHeaders = { Authorization: `Bearer ${clientToken}` };

  const stamp = new Date().toISOString();
  const employeePayloads = {
    ticketId: tempId('NTF_TICKET'),
    leaveId: tempId('NTF_LEAVE'),
    intimationId: tempId('NTF_INT'),
    attendanceId: tempId('NTF_ATT'),
    expenseId: tempId('NTF_EXP'),
    fmsId: tempId('NTF_FMS'),
    todoId: tempId('NTF_TODO')
  };

  cleanup.tickets.add(employeePayloads.ticketId);
  cleanup.leaves.add(employeePayloads.leaveId);
  cleanup.intimations.add(employeePayloads.intimationId);
  cleanup.attendance.add(employeePayloads.attendanceId);
  cleanup.expenses.add(employeePayloads.expenseId);
  cleanup.fms.add(employeePayloads.fmsId);
  cleanup.todos.add(employeePayloads.todoId);

  await Promise.all([
    insertRow('Ticket', {
      'Ticket ID': employeePayloads.ticketId,
      ID: employeePayloads.ticketId,
      'Employee ID': employeeId,
      'Employee Name': employeeName,
      'Task Category': 'Verification',
      'Task Description': 'Notifications verification ticket',
      Status: 'Pending Approval',
      'Plan Date': stamp,
      'Last Update Date': stamp,
      'Last Action By': 'Verifier'
    }),
    insertRow('Leave', {
      LeaveID: employeePayloads.leaveId,
      'Leave ID': employeePayloads.leaveId,
      'Employee ID': employeeId,
      'Employee Name': employeeName,
      'Leave Type': 'Casual Leave',
      'Start Date': stamp,
      'End Date': stamp,
      Status: 'Pending',
      'Admin Remarks': 'Verifier leave'
    }),
    insertRow('Intimation', {
      IntimationID: employeePayloads.intimationId,
      'Intimation ID': employeePayloads.intimationId,
      'Employee ID': employeeId,
      'Employee Name': employeeName,
      'Intimation Type': 'Work From Home',
      'Intimation Date': stamp,
      Status: 'Submitted',
      'Admin Remarks': 'Verifier intimation'
    }),
    insertRow('Attendance', {
      AttendanceID: employeePayloads.attendanceId,
      'Employee ID': employeeId,
      EmpID: employeeId,
      'Employee Name': employeeName,
      Date: stamp,
      Action: 'Punch In',
      Status: 'Need Approval',
      'Admin Approval': 'Pending'
    }),
    insertRow('Expense', {
      ExpenseID: employeePayloads.expenseId,
      'Employee ID': employeeId,
      'Employee Name': employeeName,
      Date: stamp,
      Amount: '123.45',
      Status: 'Pending'
    }),
    insertRow('FmsTask', {
      'Task ID': employeePayloads.fmsId,
      ID: employeePayloads.fmsId,
      'Employee ID': employeeId,
      'Employee Name': employeeName,
      Description: 'Notifications verification FMS task',
      'Task Description': 'Notifications verification FMS task',
      Status: 'Pending',
      'Plan Date': stamp
    }),
    insertRow('Todo', {
      'Task ID': employeePayloads.todoId,
      ID: employeePayloads.todoId,
      'Employee ID': employeeId,
      'Employee Name': employeeName,
      Task: 'Notifications verification todo',
      Status: 'Pending',
      'Due Date': stamp
    })
  ]);

  const employeeResult = await post('/api/notifications/employee', employeeHeaders, { employeeId, lastCheckTimestamp: 0 });
  assert(employeeResult.response.ok && employeeResult.payload?.success, `Employee notifications failed: ${employeeResult.payload?.message || employeeResult.response.status}`);
  const employeeItems = employeeResult.payload.notifications || employeeResult.payload.updates || [];
  assert(Array.isArray(employeeItems) && employeeItems.length >= 4, 'Employee notifications should return multiple activity items.');
  assert(employeeItems.some((item) => item.type === 'Ticket' && String(item.id) === employeePayloads.ticketId), 'Ticket notification missing for employee.');
  assert(employeeItems.some((item) => item.type === 'Leave' && String(item.id) === employeePayloads.leaveId), 'Leave notification missing for employee.');
  assert(employeeItems.some((item) => item.type === 'Intimation' && String(item.id) === employeePayloads.intimationId), 'Intimation notification missing for employee.');
  assert(employeeItems.some((item) => item.type === 'Attendance' && String(item.id) === employeePayloads.attendanceId), 'Attendance notification missing for employee.');
  assert(employeeItems.some((item) => item.type === 'Expense' && String(item.id) === employeePayloads.expenseId), 'Expense notification missing for employee.');
  assert(employeeItems.some((item) => item.type === 'FMS' && String(item.id) === employeePayloads.fmsId), 'FMS notification missing for employee.');
  assert(employeeItems.some((item) => item.type === 'To-Do' && String(item.id) === employeePayloads.todoId), 'To-Do notification missing for employee.');
  assert(employeeResult.payload.serverTime, 'Employee notifications should include serverTime.');

  const clientTicketId = tempId('NTF_CLIENT_TICKET');
  const clientFmsId = tempId('NTF_CLIENT_FMS');
  const clientPostId = tempId('NTF_CLIENT_SOCIAL');
  cleanup.tickets.add(clientTicketId);
  cleanup.fms.add(clientFmsId);
  cleanup.social.add(clientPostId);

  await Promise.all([
    insertRow('Ticket', {
      'Ticket ID': clientTicketId,
      ID: clientTicketId,
      Client_Id: clientId,
      'Task Description': `${clientName} ticket notification`,
      Status: 'Open',
      'Plan Date': stamp,
      'Last Update Date': stamp
    }),
    insertRow('FmsTask', {
      'Task ID': clientFmsId,
      ID: clientFmsId,
      Client_Id: clientId,
      Description: `${clientName} checklist notification`,
      Status: 'Pending',
      'Plan Date': stamp
    }),
    insertRow('SocialMedia', {
      'Post ID': clientPostId,
      Client_Id: clientId,
      Platform: 'Verification',
      Description: `${clientName} social notification`,
      Status: 'Pending Approval',
      'Planned Post Date': stamp
    })
  ]);

  const clientResult = await post('/api/notifications/client', clientHeaders, { clientId, lastCheckTimestamp: new Date(0).toISOString() });
  assert(clientResult.response.ok && clientResult.payload?.success, `Client notifications failed: ${clientResult.payload?.message || clientResult.response.status}`);
  const clientItems = clientResult.payload.notifications || clientResult.payload.updates || [];
  assert(Array.isArray(clientItems) && clientItems.length >= 3, 'Client notifications should return multiple activity items.');
  assert(clientItems.some((item) => item.type === 'Ticket' && String(item.id) === clientTicketId), 'Client ticket notification missing.');
  assert(clientItems.some((item) => item.type === 'Checklist' && String(item.id) === clientFmsId), 'Client checklist notification missing.');
  assert(clientItems.some((item) => item.type === 'Social Media' && String(item.id) === clientPostId), 'Client social notification missing.');
  assert(clientResult.payload.serverTime, 'Client notifications should include serverTime.');

  console.log('Notifications verification passed.');
}

try {
  await main();
} catch (error) {
  failures.push(`Notifications verification failed: ${error.message}`);
} finally {
  if (cleanup.tickets.size) {
    await LegacyModels.Ticket.deleteMany({
      $or: [...cleanup.tickets].map((ticketId) => ({
        $or: [
          { legacyId: ticketId },
          { 'data.Ticket ID': ticketId },
          { 'data.ID': ticketId }
        ]
      }))
    });
  }

  if (cleanup.leaves.size) {
    await LegacyModels.Leave.deleteMany({
      $or: [...cleanup.leaves].map((leaveId) => ({
        $or: [
          { legacyId: leaveId },
          { 'data.LeaveID': leaveId },
          { 'data.Leave ID': leaveId }
        ]
      }))
    });
  }

  if (cleanup.intimations.size) {
    await LegacyModels.Intimation.deleteMany({
      $or: [...cleanup.intimations].map((intimationId) => ({
        $or: [
          { legacyId: intimationId },
          { 'data.IntimationID': intimationId },
          { 'data.Intimation ID': intimationId }
        ]
      }))
    });
  }

  if (cleanup.attendance.size) {
    await LegacyModels.Attendance.deleteMany({
      $or: [...cleanup.attendance].map((attendanceId) => ({
        $or: [
          { legacyId: attendanceId },
          { 'data.AttendanceID': attendanceId }
        ]
      }))
    });
  }

  if (cleanup.expenses.size) {
    await LegacyModels.Expense.deleteMany({
      $or: [...cleanup.expenses].map((expenseId) => ({
        $or: [
          { legacyId: expenseId },
          { 'data.ExpenseID': expenseId }
        ]
      }))
    });
  }

  if (cleanup.fms.size) {
    await LegacyModels.FmsTask.deleteMany({
      $or: [...cleanup.fms].map((fmsId) => ({
        $or: [
          { legacyId: fmsId },
          { 'data.Task ID': fmsId },
          { 'data.ID': fmsId }
        ]
      }))
    });
  }

  if (cleanup.todos.size) {
    await LegacyModels.Todo.deleteMany({
      $or: [...cleanup.todos].map((todoId) => ({
        $or: [
          { legacyId: todoId },
          { 'data.Task ID': todoId },
          { 'data.ID': todoId }
        ]
      }))
    });
  }

  if (cleanup.social.size) {
    await LegacyModels.SocialMedia.deleteMany({
      $or: [...cleanup.social].map((socialId) => ({
        $or: [
          { legacyId: socialId },
          { 'data.Post ID': socialId }
        ]
      }))
    });
  }

  if (cleanup.users.size) {
    await LegacyModels.User.deleteMany({
      $or: [...cleanup.users].map((userId) => ({
        $or: [
          { legacyId: userId },
          { 'data.Employee ID': userId },
          { 'data.User ID': userId }
        ]
      }))
    });
  }

  if (cleanup.clients.size) {
    await LegacyModels.Client.deleteMany({
      $or: [...cleanup.clients].map((clientId) => ({
        $or: [
          { legacyId: clientId },
          { 'data.Client_Id': clientId },
          { 'data.Client ID': clientId }
        ]
      }))
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
