import { attendance, clients, fmsTasks, invoices, leaves, tickets, todos, users } from '../data/seed.js';

const closedTerms = ['closed', 'approved', 'cancelled', 'completed', 'done', 'resolved', 'paid'];
const isClosed = (status = '') => closedTerms.some((term) => status.toLowerCase().includes(term));
const inRange = (date, start, end) => {
  if (!start || !end || !date) return true;
  return date >= start && date <= end;
};
const hours = (mins) => `${Math.floor(mins / 60)}h ${mins % 60}m`;

export function getAdminReports(startDate, endDate) {
  const activeUsers = users.filter((user) => user.status === 'Active');
  const scopedTickets = tickets.filter((item) => inRange(item.planDate || item.timestamp, startDate, endDate));
  const scopedFms = fmsTasks.filter((item) => inRange(item.planDate, startDate, endDate));
  const scopedTodos = todos.filter((item) => inRange(item.dueDate, startDate, endDate));
  const allTasks = [
    ...scopedTickets.map((task) => ({ ...task, type: 'Ticket', id: task.ticketId, date: task.planDate, planned: task.tatMinutes })),
    ...scopedFms.map((task) => ({ ...task, type: 'FMS', id: task.taskId, date: task.planDate, planned: task.tatMinutes })),
    ...scopedTodos.map((task) => ({ ...task, type: 'To-Do', id: task.todoId, date: task.dueDate, description: task.task, planned: task.tatMinutes }))
  ];

  const presentToday = attendance.filter((row) => row.status === 'Present').length;
  const plannedMinutes = allTasks.reduce((sum, task) => sum + (Number(task.planned) || 0), 0);
  const completed = allTasks.filter((task) => isClosed(task.status)).length;
  const outstanding = invoices.reduce((sum, invoice) => sum + invoice.outstanding, 0);
  const overdueInvoices = invoices.filter((invoice) => invoice.outstanding > 0 && invoice.dueDate < new Date().toISOString().slice(0, 10)).length;

  const byStatus = allTasks.reduce((acc, task) => {
    acc[task.status || 'Unknown'] = (acc[task.status || 'Unknown'] || 0) + 1;
    return acc;
  }, {});

  const employeeRows = activeUsers.map((user) => {
    const mine = allTasks.filter((task) => task.employeeId === user.employeeId);
    const planned = mine.reduce((sum, task) => sum + (task.planned || 0), 0);
    const done = mine.filter((task) => isClosed(task.status)).length;
    return {
      employeeId: user.employeeId,
      name: user.name,
      role: user.role,
      department: user.department,
      total: mine.length,
      completed: done,
      pending: mine.length - done,
      plannedTime: hours(planned),
      efficiency: mine.length ? Math.round((done / mine.length) * 100) : 0
    };
  });

  const clientRows = clients.map((client) => {
    const clientTasks = allTasks.filter((task) => task.clientId === client.clientId);
    const clientInvoices = invoices.filter((invoice) => invoice.clientId === client.clientId);
    return {
      clientId: client.clientId,
      name: client.name,
      status: client.status,
      openTasks: clientTasks.filter((task) => !isClosed(task.status)).length,
      completedTasks: clientTasks.filter((task) => isClosed(task.status)).length,
      outstanding: clientInvoices.reduce((sum, invoice) => sum + invoice.outstanding, 0)
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
      aging: invoices.map((invoice) => ({ name: invoice.agingBucket, outstanding: invoice.outstanding })),
      users: employeeRows.map((row) => ({ name: row.name.split(' ')[0], planned: parseInt(row.plannedTime, 10), completed: row.completed }))
    },
    alerts: [
      ...tickets.filter((ticket) => !isClosed(ticket.status) && ticket.planDate < new Date().toISOString().slice(0, 10)).map((ticket) => ({ type: 'Overdue Ticket', text: `${ticket.ticketId} - ${ticket.description}`, tone: 'danger' })),
      ...leaves.filter((leave) => leave.status === 'Pending').map((leave) => ({ type: 'Approval Pending', text: `${leave.employeeName} leave request needs action`, tone: 'warning' })),
      ...invoices.filter((invoice) => invoice.outstanding > 0).map((invoice) => ({ type: 'Payment Follow-up', text: `${invoice.clientName}: ₹${invoice.outstanding.toLocaleString('en-IN')} outstanding`, tone: 'info' }))
    ],
    employees: employeeRows,
    clients: clientRows,
    tasks: allTasks
  };
}

export function getClientDashboard(clientId) {
  const client = clients.find((item) => item.clientId === clientId);
  const clientTickets = tickets.filter((ticket) => ticket.clientId === clientId);
  const clientFms = fmsTasks.filter((task) => task.clientId === clientId);
  const clientInvoices = invoices.filter((invoice) => invoice.clientId === clientId);
  const allTasks = [
    ...clientTickets.map((ticket) => ({ ...ticket, id: ticket.ticketId, type: 'Ticket', date: ticket.planDate })),
    ...clientFms.map((task) => ({ ...task, id: task.taskId, type: 'FMS', date: task.planDate }))
  ];

  return {
    success: true,
    client,
    summary: {
      openTickets: clientTickets.filter((ticket) => !isClosed(ticket.status)).length,
      completedTasks: allTasks.filter((task) => isClosed(task.status)).length,
      pendingApprovals: allTasks.filter((task) => String(task.status).toLowerCase().includes('approval')).length,
      outstanding: clientInvoices.reduce((sum, invoice) => sum + invoice.outstanding, 0)
    },
    tasks: allTasks,
    invoices: clientInvoices,
    activity: allTasks.slice(0, 5).map((task) => ({ text: `${task.type} ${task.id} is ${task.status}`, date: task.date }))
  };
}

export function getEmployeeDashboard(employeeId) {
  const user = users.find((item) => item.employeeId === employeeId);
  const assignedTickets = tickets.filter((ticket) => ticket.employeeId === employeeId);
  const assignedFms = fmsTasks.filter((task) => task.employeeId === employeeId);
  const myTodos = todos.filter((todo) => todo.employeeId === employeeId);
  const pendingApprovals = leaves.filter((leave) => leave.status === 'Pending');
  return {
    success: true,
    user,
    summary: {
      tickets: assignedTickets.length,
      fms: assignedFms.length,
      todos: myTodos.filter((todo) => todo.status !== 'Completed').length,
      approvals: ['Admin', 'Manager', 'Super Admin', 'HR'].includes(user?.role) ? pendingApprovals.length : 0
    },
    tickets: assignedTickets,
    fmsTasks: assignedFms,
    todos: myTodos,
    approvals: pendingApprovals
  };
}
