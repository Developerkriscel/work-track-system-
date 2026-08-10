import { listRows, insertRow } from './legacyStore.service.js';
import { createTicket } from './ticket.service.js';

const safe = (value = '') => String(value ?? '').trim();
const eq = (left, right) => safe(left).toLowerCase() === safe(right).toLowerCase();
const num = (value) => Number(String(value ?? 0).replace(/[^0-9.-]/g, '')) || 0;
const first = (row, keys, fallback = '') => keys.map((key) => row?.[key]).find((value) => safe(value)) ?? fallback;
const ok = (payload = {}) => ({ success: true, ...payload });

const closedTerms = ['closed', 'approved', 'cancelled', 'completed', 'done', 'resolved', 'paid'];

function isClosedStatus(status = '') {
  return closedTerms.some((term) => safe(status).toLowerCase().includes(term));
}

function parseReferenceNow(value) {
  if (!value) return new Date();
  if (String(value).includes('T')) return new Date(value);
  return new Date(`${value}T12:00:00+05:30`);
}

const referenceNow = () => parseReferenceNow(process.env.WORKTRACK_REFERENCE_DATE);

function today() {
  return referenceNow().toISOString().slice(0, 10);
}

function normalizedDate(value) {
  if (!value) return today();
  const raw = safe(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const dmy = raw.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (dmy) return `${dmy[3]}-${String(dmy[2]).padStart(2, '0')}-${String(dmy[1]).padStart(2, '0')}`;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? raw : parsed.toISOString().slice(0, 10);
}

function dateInRange(value, start, end) {
  if (!start || !end || !value) return true;
  const date = normalizedDate(value);
  return date >= start && date <= end;
}

function normalizeTicketForDashboard(ticket, users, clients) {
  const status = first(ticket, ['Status'], 'Open');
  const date = first(ticket, ['Plan Date', 'Date', 'Timestamp', 'Due Date'], today());
  return {
    ...ticket,
    ID: first(ticket, ['Ticket ID', 'Task ID', 'ID']),
    Type: 'Ticket',
    Client: clientName(ticket, clients),
    User: taskOwnerName(ticket, users),
    Status: status,
    Date: normalizedDate(date),
    TAT: first(ticket, ['TAT', 'When', 'TAT Minutes'], '0'),
    Duration: first(ticket, ['Total Duration', 'Duration', 'Actual Duration'], '0h 0m'),
    Description: first(ticket, ['Task Description', 'Description', 'Task'])
  };
}

function normalizeFmsForDashboard(task, users, clients) {
  const status = first(task, ['Status'], first(task, ['Done Date', 'actualDate']) ? 'Completed' : 'Pending');
  const date = first(task, ['Plan Date', 'Date'], today());
  return {
    ...task,
    ID: first(task, ['Task ID', 'ID', 'rowId']),
    Type: 'FMS',
    Client: clientName(task, clients),
    User: taskOwnerName(task, users),
    Status: status,
    Date: normalizedDate(date),
    TAT: first(task, ['TAT', 'When'], '0'),
    Duration: first(task, ['Duration', 'Actual Duration'], '0h 0m'),
    Description: first(task, ['Task Description', 'Description', 'Content', 'Task'])
  };
}

function normalizeTodoForDashboard(todo, users) {
  const date = first(todo, ['Due Date', 'Date'], today());
  return {
    ...todo,
    ID: first(todo, ['Task ID', 'TodoID', 'ID']),
    Type: 'To-Do',
    Client: 'Internal / General',
    User: taskOwnerName(todo, users),
    Status: first(todo, ['Status'], 'Pending'),
    Date: normalizedDate(date),
    TAT: first(todo, ['TAT', 'When'], '0'),
    Description: first(todo, ['Task', 'Description', 'Task Description'])
  };
}

function taskOwnerName(task, users = []) {
  const explicit = first(task, ['Employee Name', 'User', 'Who', 'Assigned To']);
  if (explicit) return explicit;
  const empId = first(task, ['Employee ID', 'EmpID', 'empId']);
  const user = users.find((item) => eq(item['Employee ID'], empId));
  return user?.['Employee Name'] || empId || 'Unassigned';
}

function clientName(task, clients = []) {
  const explicit = first(task, ['Client', 'Client Name', 'CustomerName']);
  if (explicit) return explicit;
  const clientId = first(task, ['Client_Id', 'Client ID', 'CustomerID']);
  const client = clients.find((item) => eq(item.Client_Id, clientId));
  return client?.['Client Name'] || 'Internal / General';
}

async function getRows() {
  const [users, clients, tickets, attendance, leaves, intimations, fms, todos, invoices] = await Promise.all([
    listRows('User'),
    listRows('Client'),
    listRows('Ticket'),
    listRows('Attendance'),
    listRows('Leave'),
    listRows('Intimation'),
    listRows('FmsTask'),
    listRows('Todo'),
    listRows('Invoice')
  ]);
  return { users, clients, tickets, attendance, leaves, intimations, fms, todos, invoices };
}

export async function getManagementDashboardData(startDate, endDate) {
  const data = await getRows();
  const activeUsers = data.users.filter((user) => eq(user.Status, 'Active'));
  const activeClients = data.clients.filter((client) => !eq(client.Status, 'Inactive'));
  const tickets = data.tickets
    .map((ticket) => normalizeTicketForDashboard(ticket, data.users, data.clients))
    .filter((ticket) => dateInRange(ticket.Date, startDate, endDate));
  const fms = data.fms
    .map((task) => normalizeFmsForDashboard(task, data.users, data.clients))
    .filter((task) => dateInRange(task.Date, startDate, endDate));
  const todo = data.todos
    .map((task) => normalizeTodoForDashboard(task, data.users))
    .filter((task) => dateInRange(task.Date, startDate, endDate));
  const allTasks = [...tickets, ...fms, ...todo];
  const checkedIn = new Set(
    data.attendance
      .filter((attendance) => safe(attendance.Date).slice(0, 10) === today() && /in|present/i.test(safe(attendance.Action || attendance.Status)))
      .map((attendance) => attendance.EmpID || attendance['Employee ID'])
  );
  const outstanding = data.invoices.reduce((sum, invoice) => sum + num(first(invoice, ['Outstanding', 'Balance', 'Due Amount'])), 0);
  const completed = allTasks.filter((task) => isClosedStatus(task.Status)).length;
  const plannedMinutes = allTasks.reduce((sum, task) => sum + num(task.TAT), 0);

  return ok({
    data: {
      activeUsers: activeUsers.map((user) => ({ id: user['Employee ID'], name: user['Employee Name'], role: user.Role })),
      activeClients: activeClients.map((client) => ({ id: client.Client_Id, name: client['Client Name'] })),
      users: activeUsers,
      clients: activeClients,
      tickets,
      fms,
      todo,
      attendance: data.attendance,
      leaves: data.leaves,
      intimations: data.intimations,
      invoices: data.invoices,
      kpis: {
        attendancePct: activeUsers.length ? Math.round((checkedIn.size / activeUsers.length) * 100) : 0,
        attendanceCount: `${checkedIn.size} of ${activeUsers.length}`,
        plannedTime: `${Math.floor(plannedMinutes / 60)}h ${plannedMinutes % 60}m`,
        outstanding,
        completedToday: completed,
        completedRate: allTasks.length ? Math.round((completed / allTasks.length) * 100) : 0
      }
    }
  });
}

export async function createManagementBatch(adminId, type, employeeId, tasks = []) {
  const users = await listRows('User');
  const actor = users.find((user) => eq(first(user, ['Employee ID', 'User ID']), adminId));
  const role = safe(first(actor, ['Role', 'role']));
  if (!actor || !/^(admin|super admin|hr|manager)$/i.test(role)) {
    return { success: false, message: 'Access denied: only management roles can assign batch work.' };
  }

  const assignee = users.find((user) => eq(first(user, ['Employee ID', 'User ID']), employeeId));
  if (!assignee || eq(first(assignee, ['Status', 'status']), 'Inactive')) {
    return { success: false, message: 'Selected employee is not available.' };
  }

  const normalizedType = safe(type).toLowerCase();
  if (!['ticket', 'todo'].includes(normalizedType)) {
    return { success: false, message: 'Unsupported batch work type.' };
  }
  const validTasks = Array.isArray(tasks)
    ? tasks.filter((task) => safe(task.description || task.Description || task.task || task.Task))
    : [];
  if (!validTasks.length) return { success: false, message: 'Add at least one task before submitting.' };

  const created = [];
  for (const task of validTasks) {
    const description = first(task, ['description', 'Description', 'task', 'Task']);
    if (normalizedType === 'ticket') {
      const result = await createTicket({
        'Employee ID': employeeId,
        Client_Id: first(task, ['clientId', 'Client_Id', 'Client ID']),
        'Task Description': description,
        Description: description,
        Priority: first(task, ['priority', 'Priority'], 'Normal'),
        TAT: first(task, ['tat', 'TAT'], ''),
        'Plan Date': first(task, ['planDate', 'Plan Date'], today()),
        Status: 'Open'
      });
      if (!result.success) return result;
      created.push(result.item);
      continue;
    }

    const id = `TODO_${Date.now()}_${created.length}`;
    const dueDate = first(task, ['dueDate', 'Due Date', 'planDate', 'Plan Date'], today());
    const row = {
      'Task ID': id,
      TodoID: id,
      'Employee ID': employeeId,
      'Employee Name': first(assignee, ['Employee Name', 'Name']),
      Task: description,
      Description: description,
      Priority: first(task, ['priority', 'Priority'], 'Medium'),
      'Due Date': dueDate,
      Date: dueDate,
      TAT: first(task, ['tat', 'TAT'], ''),
      Status: 'Pending',
      'Last Update Date': new Date().toISOString()
    };
    created.push(await insertRow('Todo', row));
  }

  return ok({ message: `${created.length} ${normalizedType} task(s) assigned.`, data: created });
}
