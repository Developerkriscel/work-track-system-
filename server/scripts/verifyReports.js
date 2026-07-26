import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDatabase } from '../config/database.js';
import { createAccessToken } from '../middleware/auth.middleware.js';
import { LegacyModels } from '../models/legacyModels.js';
import { insertRow, listRows, upsertRow } from '../services/legacyStore.service.js';

const baseUrl = process.env.PARITY_URL || `http://localhost:${process.env.PORT || 5000}`;
const failures = [];
const cleanup = {
  userIds: new Set(),
  ticketIds: new Set(),
  fmsIds: new Set()
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

  const today = new Date('2099-01-15T12:00:00+05:30');
  const yesterday = new Date('2099-01-14T12:00:00+05:30');

  const managerId = tempId('REPORTS_MGR');
  const employeeId = tempId('REPORTS_EMP');
  const managerName = 'Reports Verification Manager';
  const employeeName = 'Reports Verification Employee';
  const role = 'Manager';
  cleanup.userIds.add(managerId);
  cleanup.userIds.add(employeeId);

  await Promise.all([
    upsertRow('User', 'Employee ID', managerId, {
      'Employee ID': managerId,
      'User ID': managerId,
      'Employee Name': managerName,
      Name: managerName,
      Role: role,
      Department: 'QA',
      Status: 'Active',
      Password: 'Reports@123'
    }),
    upsertRow('User', 'Employee ID', employeeId, {
      'Employee ID': employeeId,
      'User ID': employeeId,
      'Employee Name': employeeName,
      Name: employeeName,
      Role: 'User',
      'Manager ID': managerId,
      'Task Approver': managerId,
      Department: 'QA',
      Status: 'Active',
      Password: 'Reports@123'
    })
  ]);

  const clients = await listRows('Client');
  const clientId = safe(clients[0]?.Client_Id || clients[0]?.['Client ID'] || 'CL000');

  const ticketOpenId = tempId('REPORT_TICKET_OPEN');
  const ticketClosedId = tempId('REPORT_TICKET_CLOSED');
  const fmsPendingId = tempId('REPORT_FMS_PENDING');
  const fmsCompletedId = tempId('REPORT_FMS_COMPLETED');
  cleanup.ticketIds.add(ticketOpenId);
  cleanup.ticketIds.add(ticketClosedId);
  cleanup.fmsIds.add(fmsPendingId);
  cleanup.fmsIds.add(fmsCompletedId);

  await Promise.all([
    insertRow('Ticket', {
      'Ticket ID': ticketOpenId,
      ID: ticketOpenId,
      'Employee ID': employeeId,
      'Employee Name': employeeName,
      Client_Id: clientId,
      'Task Category': 'Reports',
      'Task Description': 'Reports open ticket',
      Priority: 'High',
      Status: 'Open',
      TAT: 90,
      'Plan Date': ymd(today),
      Timestamp: today.toISOString()
    }),
    insertRow('Ticket', {
      'Ticket ID': ticketClosedId,
      ID: ticketClosedId,
      'Employee ID': employeeId,
      'Employee Name': employeeName,
      Client_Id: clientId,
      'Task Category': 'Reports',
      'Task Description': 'Reports closed ticket',
      Priority: 'Normal',
      Status: 'Completed',
      TAT: 30,
      'Plan Date': ymd(yesterday),
      'Close Date': yesterday.toISOString(),
      Timestamp: yesterday.toISOString()
    }),
    insertRow('FmsTask', {
      'Task ID': fmsPendingId,
      ID: fmsPendingId,
      'Employee ID': employeeId,
      'Employee Name': employeeName,
      Client_Id: clientId,
      Description: 'Reports pending FMS',
      'Task Description': 'Reports pending FMS',
      Priority: 'Normal',
      Status: 'Pending',
      TAT: 45,
      'Plan Date': ymd(today)
    }),
    insertRow('FmsTask', {
      'Task ID': fmsCompletedId,
      ID: fmsCompletedId,
      'Employee ID': employeeId,
      'Employee Name': employeeName,
      Client_Id: clientId,
      Description: 'Reports completed FMS',
      'Task Description': 'Reports completed FMS',
      Priority: 'High',
      Status: 'Completed',
      TAT: 60,
      Duration: '1h 0m',
      'Plan Date': ymd(today),
      'Done Date': today.toISOString()
    })
  ]);

  const token = createAccessToken({ kind: 'employee', id: managerId, role });
  const headers = { Authorization: `Bearer ${token}` };

  const todayTicketResult = await post('/api/reports/tickets', headers, { startDate: ymd(today), endDate: ymd(today) });
  assert(todayTicketResult.response.ok && todayTicketResult.payload?.success, `Today ticket report failed: ${todayTicketResult.payload?.message || todayTicketResult.response.status}`);
  assert((todayTicketResult.payload.data || []).length === 1, `Expected 1 ticket in today's report, got ${(todayTicketResult.payload.data || []).length}`);
  assert(todayTicketResult.payload.summary?.total === 1, `Expected ticket summary total 1 for today, got ${todayTicketResult.payload.summary?.total}`);
  assert(todayTicketResult.payload.summary?.open === 1, `Expected ticket summary open 1 for today, got ${todayTicketResult.payload.summary?.open}`);
  assert(todayTicketResult.payload.summary?.closed === 0, `Expected ticket summary closed 0 for today, got ${todayTicketResult.payload.summary?.closed}`);

  const allTicketResult = await post('/api/reports/tickets', headers, { startDate: '', endDate: '' });
  assert(allTicketResult.response.ok && allTicketResult.payload?.success, `All ticket report failed: ${allTicketResult.payload?.message || allTicketResult.response.status}`);
  assert((allTicketResult.payload.data || []).length >= 2, 'All ticket report should include both temporary tickets.');
  assert(allTicketResult.payload.summary?.total >= 2, 'All ticket summary should include at least two records.');
  assert(allTicketResult.payload.summary?.open >= 1, 'All ticket summary should include an open item.');
  assert(allTicketResult.payload.summary?.closed >= 1, 'All ticket summary should include a closed item.');

  const todayFmsResult = await post('/api/reports/fms', headers, { startDate: ymd(today), endDate: ymd(today) });
  assert(todayFmsResult.response.ok && todayFmsResult.payload?.success, `Today FMS report failed: ${todayFmsResult.payload?.message || todayFmsResult.response.status}`);
  assert((todayFmsResult.payload.data || []).length === 2, `Expected 2 FMS records in today's report, got ${(todayFmsResult.payload.data || []).length}`);
  assert(todayFmsResult.payload.summary?.total === 2, `Expected FMS summary total 2 for today, got ${todayFmsResult.payload.summary?.total}`);
  assert(todayFmsResult.payload.summary?.completed === 1, `Expected FMS summary completed 1 for today, got ${todayFmsResult.payload.summary?.completed}`);

  const exportResult = await post('/api/reports/export', headers, {
    format: 'csv',
    sheetName: 'Tickets_Report',
    startDate: ymd(today),
    endDate: ymd(today)
  });
  assert(exportResult.response.ok && exportResult.payload?.success, `Report export failed: ${exportResult.payload?.message || exportResult.response.status}`);
  const csv = Buffer.from(String(exportResult.payload.base64Data || ''), 'base64').toString('utf8');
  assert(csv.includes(ticketOpenId), 'Exported CSV did not include the expected in-range temporary ticket.');
  assert(!csv.includes(ticketClosedId), 'Exported CSV should not include the out-of-range temporary ticket.');
  assert(exportResult.payload.fileName && /\.csv$/i.test(exportResult.payload.fileName), 'CSV export did not return a CSV filename.');

  console.log('Reports verification passed.');
}

try {
  await main();
} catch (error) {
  failures.push(`Reports verification failed: ${error.message}`);
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
