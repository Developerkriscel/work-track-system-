import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDatabase } from '../config/database.js';
import { LegacyModels } from '../models/legacyModels.js';
import { createManagementBatch, getManagementDashboardData } from '../services/managementDashboard.service.js';
import { insertRow, upsertRow } from '../services/legacyStore.service.js';

const failures = [];
const cleanupUsers = new Set();
const cleanupClients = new Set();
const cleanupTickets = new Set();
const cleanupFms = new Set();
const cleanupTodo = new Set();
const cleanupInvoices = new Set();
const cleanupAttendance = new Set();

const assert = (condition, message) => {
  if (!condition) failures.push(message);
};

function tempId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`.toUpperCase();
}

function dateAt(day = '15') {
  return `2099-01-${day}`;
}

async function seedUser({ employeeId, name, role = 'User', department = 'Operations', managerId = '' }) {
  cleanupUsers.add(employeeId);
  await upsertRow('User', 'Employee ID', employeeId, {
    'Employee ID': employeeId,
    'User ID': employeeId,
    'Employee Name': name,
    Name: name,
    Role: role,
    Department: department,
    Status: 'Active',
    'Manager ID': managerId,
    Manager: managerId,
    Password: 'Verify@123'
  });
}

async function seedAttendance(employeeId, employeeName) {
  const attendanceId = tempId(`ATT_${employeeId}`);
  cleanupAttendance.add(attendanceId);
  await insertRow('Attendance', {
    AttendanceID: attendanceId,
    'Employee ID': employeeId,
    EmpID: employeeId,
    'Employee Name': employeeName,
    Date: `${dateAt('15')}T09:00:00+05:30`,
    Time: `${dateAt('15')}T09:00:00+05:30`,
    Action: 'Punch In',
    'Punch In': '09:00 am',
    Status: 'Present'
  });
}

await connectDatabase();
process.env.WORKTRACK_REFERENCE_DATE = dateAt('15');

const managerId = tempId('MGMT_MGR');
const employeeId = tempId('MGMT_EMP');
const clientId = tempId('MGMT_CLIENT');
const ticketId = tempId('MGMT_TICKET');
const fmsId = tempId('MGMT_FMS');
const todoId = tempId('MGMT_TODO');
const invoiceId = tempId('MGMT_INV');

try {
  await seedUser({ employeeId: managerId, name: 'Mgmt Manager', role: 'Manager', department: 'Operations' });
  await seedUser({ employeeId, name: 'Mgmt Employee', role: 'User', department: 'Development', managerId });
  cleanupClients.add(clientId);
  await upsertRow('Client', 'Client_Id', clientId, {
    Client_Id: clientId,
    'Client ID': clientId,
    'Client Name': 'Mgmt Client',
    CustomerName: 'Mgmt Client',
    Status: 'Active',
    Password: 'Client@123'
  });

  await seedAttendance(managerId, 'Mgmt Manager');
  await seedAttendance(employeeId, 'Mgmt Employee');

  cleanupTickets.add(ticketId);
  await insertRow('Ticket', {
    'Ticket ID': ticketId,
    ID: ticketId,
    Client_Id: clientId,
    Client: 'Mgmt Client',
    'Client Name': 'Mgmt Client',
    'Employee ID': employeeId,
    'Employee Name': 'Mgmt Employee',
    Priority: 'High',
    'Task Description': 'Management dashboard ticket',
    Description: 'Management dashboard ticket',
    Status: 'Closed',
    'Plan Date': dateAt('15'),
    Date: dateAt('15'),
    TAT: '90',
    When: '90'
  });

  cleanupFms.add(fmsId);
  await insertRow('FmsTask', {
    'Task ID': fmsId,
    ID: fmsId,
    Client_Id: clientId,
    Client: 'Mgmt Client',
    'Client Name': 'Mgmt Client',
    'Employee ID': employeeId,
    'Employee Name': 'Mgmt Employee',
    'Task Description': 'Management dashboard FMS',
    Description: 'Management dashboard FMS',
    Status: 'Completed',
    'Plan Date': dateAt('15'),
    Date: dateAt('15'),
    TAT: '30'
  });

  cleanupTodo.add(todoId);
  await insertRow('Todo', {
    'Task ID': todoId,
    TodoID: todoId,
    'Employee ID': employeeId,
    'Employee Name': 'Mgmt Employee',
    Task: 'Management dashboard todo',
    Description: 'Management dashboard todo',
    Priority: 'Medium',
    'Due Date': dateAt('15'),
    Date: dateAt('15'),
    TAT: '60',
    Status: 'Completed'
  });

  cleanupInvoices.add(invoiceId);
  await insertRow('Invoice', {
    InvoiceID: invoiceId,
    'Invoice ID': invoiceId,
    ID: invoiceId,
    CustomerID: clientId,
    CustomerName: 'Mgmt Client',
    'Client Name': 'Mgmt Client',
    Amount: '1000',
    Outstanding: '250',
    Status: 'Open',
    DueDate: dateAt('15'),
    Date: dateAt('15')
  });

  const dashboard = await getManagementDashboardData('2099-01-14', '2099-01-15');
  assert(dashboard.success, 'Management dashboard data should load successfully.');
  assert(Array.isArray(dashboard.data?.users) && dashboard.data.users.some((item) => String(item.id || item['Employee ID']) === managerId), 'Dashboard should include the seeded manager.');
  assert(Array.isArray(dashboard.data?.users) && dashboard.data.users.some((item) => String(item.id || item['Employee ID']) === employeeId), 'Dashboard should include the seeded employee.');
  assert(Array.isArray(dashboard.data?.clients) && dashboard.data.clients.some((item) => String(item.id || item.Client_Id) === clientId), 'Dashboard should include the seeded client.');
  assert(Array.isArray(dashboard.data?.tickets) && dashboard.data.tickets.some((item) => String(item['Ticket ID'] || item.ID) === ticketId), 'Dashboard should include the seeded ticket.');
  assert(Array.isArray(dashboard.data?.fms) && dashboard.data.fms.some((item) => String(item['Task ID'] || item.ID) === fmsId), 'Dashboard should include the seeded FMS item.');
  assert(Array.isArray(dashboard.data?.todo) && dashboard.data.todo.some((item) => String(item['Task ID'] || item.TodoID) === todoId), 'Dashboard should include the seeded todo item.');
  assert(Array.isArray(dashboard.data?.attendance) && dashboard.data.attendance.some((item) => String(item['Employee ID'] || item.EmpID) === managerId), 'Dashboard should include the seeded attendance records.');
  assert(String(dashboard.data?.kpis?.attendanceCount || '').includes('of'), `Unexpected attendance KPI: ${dashboard.data?.kpis?.attendanceCount}`);
  assert(Number.isFinite(Number(dashboard.data?.kpis?.completedRate)), `Completion rate should be numeric: ${dashboard.data?.kpis?.completedRate}`);
  assert(String(dashboard.data?.kpis?.plannedTime || '').includes('h'), `Unexpected planned time: ${dashboard.data?.kpis?.plannedTime}`);
  assert(Number.isFinite(Number(dashboard.data?.kpis?.outstanding)), `Outstanding amount should be numeric: ${dashboard.data?.kpis?.outstanding}`);

  const ticketBatch = await createManagementBatch(managerId, 'ticket', employeeId, [
    {
      description: 'Batch assigned ticket',
      clientId,
      priority: 'Normal',
      tat: '45',
      planDate: dateAt('15')
    }
  ]);
  assert(ticketBatch.success, 'Management batch ticket assignment should succeed for manager role.');
  assert(Array.isArray(ticketBatch.data) && ticketBatch.data.length === 1, 'Ticket batch should create exactly one item.');
  const createdTicketId = ticketBatch.data[0]?.['Ticket ID'] || ticketBatch.data[0]?.TicketID || ticketBatch.data[0]?.ID;
  if (createdTicketId) cleanupTickets.add(createdTicketId);

  const todoBatch = await createManagementBatch(managerId, 'todo', employeeId, [
    {
      description: 'Batch assigned todo',
      dueDate: dateAt('15'),
      tat: '20'
    }
  ]);
  assert(todoBatch.success, 'Management batch todo assignment should succeed for manager role.');
  assert(Array.isArray(todoBatch.data) && todoBatch.data.length === 1, 'Todo batch should create exactly one item.');
  const createdTodoId = todoBatch.data[0]?.['Task ID'] || todoBatch.data[0]?.TodoID || todoBatch.data[0]?.ID;
  if (createdTodoId) cleanupTodo.add(createdTodoId);
} catch (error) {
  failures.push(`Management dashboard verification failed: ${error.message}`);
} finally {
  if (cleanupTickets.size) {
    await LegacyModels.Ticket.deleteMany({
      $or: [...cleanupTickets].map((ticketIdValue) => ({
        $or: [{ legacyId: ticketIdValue }, { 'data.Ticket ID': ticketIdValue }, { 'data.ID': ticketIdValue }]
      }))
    });
  }

  if (cleanupFms.size) {
    await LegacyModels.FmsTask.deleteMany({
      $or: [...cleanupFms].map((taskIdValue) => ({
        $or: [{ legacyId: taskIdValue }, { 'data.Task ID': taskIdValue }, { 'data.ID': taskIdValue }]
      }))
    });
  }

  if (cleanupTodo.size) {
    await LegacyModels.Todo.deleteMany({
      $or: [...cleanupTodo].map((todoIdValue) => ({
        $or: [{ legacyId: todoIdValue }, { 'data.Task ID': todoIdValue }, { 'data.TodoID': todoIdValue }]
      }))
    });
  }

  if (cleanupInvoices.size) {
    await LegacyModels.Invoice.deleteMany({
      $or: [...cleanupInvoices].map((invoiceIdValue) => ({
        $or: [{ legacyId: invoiceIdValue }, { 'data.InvoiceID': invoiceIdValue }, { 'data.Invoice ID': invoiceIdValue }]
      }))
    });
  }

  if (cleanupAttendance.size) {
    await LegacyModels.Attendance.deleteMany({
      $or: [...cleanupAttendance].map((attendanceIdValue) => ({
        $or: [{ legacyId: attendanceIdValue }, { 'data.AttendanceID': attendanceIdValue }]
      }))
    });
  }

  if (cleanupClients.size) {
    await LegacyModels.Client.deleteMany({
      $or: [...cleanupClients].map((clientIdValue) => ({
        $or: [{ legacyId: clientIdValue }, { 'data.Client_Id': clientIdValue }, { 'data.Client ID': clientIdValue }]
      }))
    });
  }

  if (cleanupUsers.size) {
    await LegacyModels.User.deleteMany({
      $or: [...cleanupUsers].map((employeeIdValue) => ({
        $or: [{ legacyId: employeeIdValue }, { 'data.Employee ID': employeeIdValue }, { 'data.User ID': employeeIdValue }]
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

console.log('Management dashboard verification passed.');
