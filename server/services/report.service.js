import { listRows } from './legacyStore.service.js';

const closedTerms = ['closed', 'approved', 'cancelled', 'completed', 'done', 'resolved', 'paid'];
const safe = (value = '') => String(value ?? '').trim();
const isClosed = (status = '') => closedTerms.some((term) => safe(status).toLowerCase().includes(term));
const inRange = (date, start, end) => {
  if (!start || !end || !date) return true;
  return date >= start && date <= end;
};
const hours = (mins) => `${Math.floor(mins / 60)}h ${mins % 60}m`;
const first = (row, keys, fallback = '') => keys.map((key) => row?.[key]).find((value) => safe(value)) ?? fallback;
const normalizedDate = (value) => {
  if (!value) return '';
  const raw = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? raw.slice(0, 10) : parsed.toISOString().slice(0, 10);
};

async function loadCollections() {
  const [users, clients, tickets, attendance, leaves, fmsTasks, todos, invoices] = await Promise.all([
    listRows('User'),
    listRows('Client'),
    listRows('Ticket'),
    listRows('Attendance'),
    listRows('Leave'),
    listRows('FmsTask'),
    listRows('Todo'),
    listRows('Invoice')
  ]);
  return { users, clients, tickets, attendance, leaves, fmsTasks, todos, invoices };
}

function normalizeTask(row, type) {
  const dateKey = type === 'Ticket' ? ['Plan Date', 'Date', 'Timestamp'] : type === 'FMS' ? ['Plan Date', 'Date'] : ['Due Date', 'Date'];
  const status = first(row, ['Status', 'status'], '');
  const planned = Number(first(row, ['TAT', 'When', 'tatMinutes', 'Duration'], 0)) || 0;
  return {
    ...row,
    type,
    id: first(row, type === 'Ticket' ? ['Ticket ID', 'ID'] : type === 'FMS' ? ['Task ID', 'ID'] : ['Task ID', 'TodoID', 'ID']),
    date: normalizedDate(first(row, dateKey)),
    planned,
    status,
    employeeId: first(row, ['Employee ID', 'employeeId', 'empId'], ''),
    clientId: first(row, ['Client_Id', 'Client ID', 'clientId'], ''),
    description: first(row, ['Task Description', 'Description', 'task'], '')
  };
}

export async function getAdminReports(startDate, endDate) {
  const { users, clients, tickets, attendance, leaves, fmsTasks, todos, invoices } = await loadCollections();
  const activeUsers = users.filter((user) => safe(first(user, ['Status', 'status'], 'Active')).toLowerCase() === 'active');
  const scopedTickets = tickets.map((row) => normalizeTask(row, 'Ticket')).filter((item) => inRange(item.date, startDate, endDate));
  const scopedFms = fmsTasks.map((row) => normalizeTask(row, 'FMS')).filter((item) => inRange(item.date, startDate, endDate));
  const scopedTodos = todos.map((row) => normalizeTask(row, 'To-Do')).filter((item) => inRange(item.date, startDate, endDate));
  const allTasks = [...scopedTickets, ...scopedFms, ...scopedTodos];

  const presentToday = attendance.filter((row) => safe(first(row, ['Status', 'status'], 'Present')).toLowerCase() === 'present').length;
  const plannedMinutes = allTasks.reduce((sum, task) => sum + (Number(task.planned) || 0), 0);
  const completed = allTasks.filter((task) => isClosed(task.status)).length;
  const outstanding = invoices.reduce((sum, invoice) => sum + (Number(first(invoice, ['Outstanding', 'outstanding'], 0)) || 0), 0);
  const overdueInvoices = invoices.filter((invoice) => Number(first(invoice, ['Outstanding', 'outstanding'], 0)) > 0 && normalizedDate(first(invoice, ['Due Date', 'dueDate'])) < new Date().toISOString().slice(0, 10)).length;

  const byStatus = allTasks.reduce((acc, task) => {
    acc[task.status || 'Unknown'] = (acc[task.status || 'Unknown'] || 0) + 1;
    return acc;
  }, {});

  const employeeRows = activeUsers.map((user) => {
    const employeeId = first(user, ['Employee ID', 'User ID', 'employeeId']);
    const mine = allTasks.filter((task) => String(task.employeeId) === String(employeeId));
    const planned = mine.reduce((sum, task) => sum + (task.planned || 0), 0);
    const done = mine.filter((task) => isClosed(task.status)).length;
    return {
      employeeId,
      name: first(user, ['Employee Name', 'name']),
      role: first(user, ['Role', 'role']),
      department: first(user, ['Department', 'department']),
      total: mine.length,
      completed: done,
      pending: mine.length - done,
      plannedTime: hours(planned),
      efficiency: mine.length ? Math.round((done / mine.length) * 100) : 0
    };
  });

  const clientRows = clients.map((client) => {
    const clientId = first(client, ['Client_Id', 'Client ID', 'clientId']);
    const clientTasks = allTasks.filter((task) => String(task.clientId) === String(clientId));
    const clientInvoices = invoices.filter((invoice) => String(first(invoice, ['Client_Id', 'Client ID', 'clientId'])) === String(clientId));
    return {
      clientId,
      name: first(client, ['Client Name', 'name']),
      status: first(client, ['Status', 'status'], 'Active'),
      openTasks: clientTasks.filter((task) => !isClosed(task.status)).length,
      completedTasks: clientTasks.filter((task) => isClosed(task.status)).length,
      outstanding: clientInvoices.reduce((sum, invoice) => sum + (Number(first(invoice, ['Outstanding', 'outstanding'], 0)) || 0), 0)
    };
  });

  return {
    success: true,
    summary: {
      attendancePct: activeUsers.length ? Math.round((presentToday / activeUsers.length) * 100) : 0,
      attendanceCount: `${presentToday} of ${activeUsers.length} Present`,
      plannedTime: hours(plannedMinutes),
      outstanding,
      overdueInvoices,
      completedToday: completed,
      completedRate: allTasks.length ? Math.round((completed / allTasks.length) * 100) : 0
    },
    charts: {
      status: Object.entries(byStatus).map(([name, value]) => ({ name, value })),
      aging: invoices.map((invoice) => ({ name: first(invoice, ['Aging Bucket', 'agingBucket'], ''), outstanding: Number(first(invoice, ['Outstanding', 'outstanding'], 0)) || 0 })),
      users: employeeRows.map((row) => ({ name: row.name.split(' ')[0], planned: parseInt(row.plannedTime, 10), completed: row.completed }))
    },
    alerts: [
      ...tickets
        .map((ticket) => normalizeTask(ticket, 'Ticket'))
        .filter((ticket) => !isClosed(ticket.status) && ticket.date < new Date().toISOString().slice(0, 10))
        .map((ticket) => ({ type: 'Overdue Ticket', text: `${ticket.id} - ${ticket.description}`, tone: 'danger' })),
      ...leaves
        .filter((leave) => safe(first(leave, ['Status', 'status'])).toLowerCase() === 'pending')
        .map((leave) => ({ type: 'Approval Pending', text: `${first(leave, ['Employee Name', 'name'])} leave request needs action`, tone: 'warning' })),
      ...invoices
        .filter((invoice) => Number(first(invoice, ['Outstanding', 'outstanding'], 0)) > 0)
        .map((invoice) => ({ type: 'Payment Follow-up', text: `${first(invoice, ['Client Name', 'clientName'])}: ₹${(Number(first(invoice, ['Outstanding', 'outstanding'], 0)) || 0).toLocaleString('en-IN')} outstanding`, tone: 'info' }))
    ],
    employees: employeeRows,
    clients: clientRows,
    tasks: allTasks
  };
}

export async function getClientDashboard(clientId) {
  const [clients, tickets, fmsTasks, invoices] = await Promise.all([
    listRows('Client'),
    listRows('Ticket'),
    listRows('FmsTask'),
    listRows('Invoice')
  ]);
  const client = clients.find((item) => String(first(item, ['Client_Id', 'Client ID', 'clientId'])) === String(clientId));
  const clientTickets = tickets.filter((ticket) => String(first(ticket, ['Client_Id', 'Client ID', 'clientId'])) === String(clientId)).map((row) => normalizeTask(row, 'Ticket'));
  const clientFms = fmsTasks.filter((task) => String(first(task, ['Client_Id', 'Client ID', 'clientId'])) === String(clientId)).map((row) => normalizeTask(row, 'FMS'));
  const clientInvoices = invoices.filter((invoice) => String(first(invoice, ['Client_Id', 'Client ID', 'clientId'])) === String(clientId));
  const allTasks = [...clientTickets, ...clientFms];

  return {
    success: true,
    client,
    summary: {
      openTickets: clientTickets.filter((ticket) => !isClosed(ticket.status)).length,
      completedTasks: allTasks.filter((task) => isClosed(task.status)).length,
      pendingApprovals: allTasks.filter((task) => String(task.status).toLowerCase().includes('approval')).length,
      outstanding: clientInvoices.reduce((sum, invoice) => sum + (Number(first(invoice, ['Outstanding', 'outstanding'], 0)) || 0), 0)
    },
    tasks: allTasks,
    invoices: clientInvoices,
    activity: allTasks.slice(0, 5).map((task) => ({ text: `${task.type} ${task.id} is ${task.status}`, date: task.date }))
  };
}

export async function getEmployeeDashboard(employeeId) {
  const [users, tickets, fmsTasks, todos, leaves] = await Promise.all([
    listRows('User'),
    listRows('Ticket'),
    listRows('FmsTask'),
    listRows('Todo'),
    listRows('Leave')
  ]);
  const user = users.find((item) => String(first(item, ['Employee ID', 'User ID', 'employeeId'])) === String(employeeId));
  const assignedTickets = tickets.filter((ticket) => String(first(ticket, ['Employee ID', 'employeeId'])) === String(employeeId)).map((row) => normalizeTask(row, 'Ticket'));
  const assignedFms = fmsTasks.filter((task) => String(first(task, ['Employee ID', 'employeeId', 'empId'])) === String(employeeId)).map((row) => normalizeTask(row, 'FMS'));
  const myTodos = todos.filter((todo) => String(first(todo, ['Employee ID', 'employeeId'])) === String(employeeId)).map((row) => normalizeTask(row, 'To-Do'));
  const pendingApprovals = leaves.filter((leave) => safe(first(leave, ['Status', 'status'])).toLowerCase() === 'pending');
  return {
    success: true,
    user,
    summary: {
      tickets: assignedTickets.length,
      fms: assignedFms.length,
      todos: myTodos.filter((todo) => !isClosed(todo.status)).length,
      approvals: ['Admin', 'Manager', 'Super Admin', 'HR'].includes(first(user, ['Role', 'role'], '')) ? pendingApprovals.length : 0
    },
    tickets: assignedTickets,
    fmsTasks: assignedFms,
    todos: myTodos,
    approvals: pendingApprovals
  };
}
