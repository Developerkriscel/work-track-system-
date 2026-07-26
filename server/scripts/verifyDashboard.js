import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDatabase } from '../config/database.js';
import { createAccessToken } from '../middleware/auth.middleware.js';
import { LegacyModels } from '../models/legacyModels.js';
import { insertRow, upsertRow } from '../services/legacyStore.service.js';

const baseUrl = process.env.PARITY_URL || `http://localhost:${process.env.PORT || 5000}`;
const failures = [];
const cleanup = {
  userIds: new Set(),
  ticketIds: new Set(),
  fmsIds: new Set(),
  todoIds: new Set(),
  expenseIds: new Set(),
  historyIds: new Set()
};

const assert = (condition, message) => {
  if (!condition) failures.push(message);
};

const safe = (value = '') => String(value ?? '').trim();

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

function ymd(date) {
  return date.toISOString().slice(0, 10);
}

async function main() {
  await connectDatabase();

  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const employeeId = tempId('DASH_EMP');
  const employeeName = 'Dashboard Verification User';
  cleanup.userIds.add(employeeId);

  await upsertRow('User', 'Employee ID', employeeId, {
    'Employee ID': employeeId,
    'User ID': employeeId,
    'Employee Name': employeeName,
    Name: employeeName,
    Role: 'User',
    Department: 'QA',
    Status: 'Active',
    Password: 'Dashboard@123'
  });

  const ticketTodayOpen = tempId('DASH_TICKET_OPEN');
  const ticketYesterdayClosed = tempId('DASH_TICKET_DONE');
  const fmsTodayCompleted = tempId('DASH_FMS_DONE');
  const todoTodayPending = tempId('DASH_TODO');
  const expenseToday = tempId('DASH_EXP');
  const historyPaused = tempId('DASH_HIST_PAUSED');
  const historyResume = tempId('DASH_HIST_RESUME');

  cleanup.ticketIds.add(ticketTodayOpen);
  cleanup.ticketIds.add(ticketYesterdayClosed);
  cleanup.fmsIds.add(fmsTodayCompleted);
  cleanup.todoIds.add(todoTodayPending);
  cleanup.expenseIds.add(expenseToday);
  cleanup.historyIds.add(historyPaused);
  cleanup.historyIds.add(historyResume);

  await Promise.all([
    insertRow('Ticket', {
      'Ticket ID': ticketTodayOpen,
      ID: ticketTodayOpen,
      'Employee ID': employeeId,
      'Employee Name': employeeName,
      'Task Category': 'Verification',
      'Task Description': 'Dashboard open ticket',
      Status: 'Open',
      TAT: 120,
      'Plan Date': ymd(today),
      Timestamp: today.toISOString()
    }),
    insertRow('Ticket', {
      'Ticket ID': ticketYesterdayClosed,
      ID: ticketYesterdayClosed,
      'Employee ID': employeeId,
      'Employee Name': employeeName,
      'Task Category': 'Verification',
      'Task Description': 'Dashboard completed ticket',
      Status: 'Completed',
      TAT: 60,
      'Plan Date': ymd(yesterday),
      Timestamp: yesterday.toISOString()
    }),
    insertRow('FmsTask', {
      'Task ID': fmsTodayCompleted,
      ID: fmsTodayCompleted,
      'Employee ID': employeeId,
      'Employee Name': employeeName,
      Description: 'Dashboard completed FMS',
      'Task Description': 'Dashboard completed FMS',
      Status: 'Completed',
      TAT: 180,
      Duration: '3h 0m',
      'Plan Date': ymd(today),
      'Done Date': today.toISOString()
    }),
    insertRow('Todo', {
      'Task ID': todoTodayPending,
      ID: todoTodayPending,
      'Employee ID': employeeId,
      'Employee Name': employeeName,
      Task: 'Dashboard pending todo',
      Status: 'Pending',
      TAT: 30,
      'Due Date': ymd(today)
    }),
    insertRow('Expense', {
      ExpenseID: expenseToday,
      'Employee ID': employeeId,
      'Employee Name': employeeName,
      Date: ymd(today),
      Amount: '123.45',
      Status: 'Pending'
    }),
    insertRow('TicketHistory', {
      'History ID': historyPaused,
      'Ticket ID': ticketTodayOpen,
      'Action By': employeeId,
      'Action Type': 'Paused',
      Timestamp: new Date(today.getTime() - 15 * 60000).toISOString()
    }),
    insertRow('TicketHistory', {
      'History ID': historyResume,
      'Ticket ID': ticketTodayOpen,
      'Action By': employeeId,
      'Action Type': 'In Progress',
      Timestamp: today.toISOString()
    })
  ]);

  const token = createAccessToken({ kind: 'employee', id: employeeId, role: 'User' });
  const headers = { Authorization: `Bearer ${token}` };

  const todayResult = await post('/api/dashboard/data', headers, { employeeId, filterRange: 'today' });
  assert(todayResult.response.ok && todayResult.payload?.success, `Dashboard today failed: ${todayResult.payload?.message || todayResult.response.status}`);
  const todayData = todayResult.payload.data || {};
  assert(todayData.kpis?.pendingTickets === 1, `Expected 1 pending ticket today, got ${todayData.kpis?.pendingTickets}`);
  assert(todayData.kpis?.doneTickets === 0, `Expected 0 done tickets today, got ${todayData.kpis?.doneTickets}`);
  assert(todayData.kpis?.pendingFms === 0, `Expected 0 pending FMS today, got ${todayData.kpis?.pendingFms}`);
  assert(todayData.kpis?.doneFms === 1, `Expected 1 done FMS today, got ${todayData.kpis?.doneFms}`);
  assert(todayData.kpis?.pendingTodos === 1, `Expected 1 pending todo today, got ${todayData.kpis?.pendingTodos}`);
  assert(String(todayData.kpis?.totalExpenses) === '123.45', `Expected expense total 123.45, got ${todayData.kpis?.totalExpenses}`);
  assert(Array.isArray(todayData.todaysTasks) && todayData.todaysTasks.length === 3, 'Today tasks should include ticket, FMS, and todo items.');
  assert(Array.isArray(todayData.chartData?.lineChart?.labels) && todayData.chartData.lineChart.labels.length === 7, 'Line chart should contain 7 labels.');
  assert(
    todayData.chartData?.lineChart?.data?.some((value) => Number(value) >= 1),
    'Line chart should reflect at least one completed task.'
  );
  assert(typeof todayData.kpis?.totalGapTime === 'string' && /0h 15m/.test(todayData.kpis.totalGapTime), `Expected gap time near 0h 15m, got ${todayData.kpis?.totalGapTime}`);

  const allResult = await post('/api/dashboard/data', headers, { employeeId, filterRange: 'all' });
  assert(allResult.response.ok && allResult.payload?.success, `Dashboard all-time failed: ${allResult.payload?.message || allResult.response.status}`);
  const allData = allResult.payload.data || {};
  assert(allData.tickets?.length === 2, `Expected 2 tickets in all-time dashboard, got ${allData.tickets?.length}`);
  assert(allData.kpis?.pendingTickets === 1, `Expected 1 pending ticket in all-time dashboard, got ${allData.kpis?.pendingTickets}`);
  assert(allData.kpis?.doneTickets === 1, `Expected 1 done ticket in all-time dashboard, got ${allData.kpis?.doneTickets}`);
  assert(allData.kpis?.doneFms === 1, `Expected 1 done FMS in all-time dashboard, got ${allData.kpis?.doneFms}`);
  assert(allData.kpis?.pendingTodos === 1, `Expected 1 pending todo in all-time dashboard, got ${allData.kpis?.pendingTodos}`);
  assert(Array.isArray(allData.upcomingTasks) && allData.upcomingTasks.length >= 2, 'All-time dashboard should include actionable tasks.');

  console.log('Dashboard verification passed.');
}

try {
  await main();
} catch (error) {
  failures.push(`Dashboard verification failed: ${error.message}`);
} finally {
  if (cleanup.ticketIds.size) {
    await LegacyModels.Ticket.deleteMany({
      $or: [...cleanup.ticketIds].map((ticketId) => ({
        $or: [
          { legacyId: ticketId },
          { 'data.Ticket ID': ticketId },
          { 'data.ID': ticketId }
        ]
      }))
    });
  }

  if (cleanup.fmsIds.size) {
    await LegacyModels.FmsTask.deleteMany({
      $or: [...cleanup.fmsIds].map((fmsId) => ({
        $or: [
          { legacyId: fmsId },
          { 'data.Task ID': fmsId },
          { 'data.ID': fmsId }
        ]
      }))
    });
  }

  if (cleanup.todoIds.size) {
    await LegacyModels.Todo.deleteMany({
      $or: [...cleanup.todoIds].map((todoId) => ({
        $or: [
          { legacyId: todoId },
          { 'data.Task ID': todoId },
          { 'data.ID': todoId }
        ]
      }))
    });
  }

  if (cleanup.expenseIds.size) {
    await LegacyModels.Expense.deleteMany({
      $or: [...cleanup.expenseIds].map((expenseId) => ({
        $or: [
          { legacyId: expenseId },
          { 'data.ExpenseID': expenseId }
        ]
      }))
    });
  }

  if (cleanup.historyIds.size) {
    await LegacyModels.TicketHistory.deleteMany({
      $or: [...cleanup.historyIds].map((historyId) => ({
        $or: [
          { legacyId: historyId },
          { 'data.History ID': historyId }
        ]
      }))
    });
  }

  if (cleanup.userIds.size) {
    await LegacyModels.User.deleteMany({
      $or: [...cleanup.userIds].map((userId) => ({
        $or: [
          { legacyId: userId },
          { 'data.Employee ID': userId },
          { 'data.User ID': userId }
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
