import { listRows } from './legacyStore.service.js';

const closedTerms = ['closed', 'approved', 'cancelled', 'completed', 'done', 'resolved', 'paid'];
const safe = (value = '') => String(value ?? '').trim();
const eq = (left, right) => safe(left).toLowerCase() === safe(right).toLowerCase();
const num = (value) => Number(String(value ?? 0).replace(/[^0-9.-]/g, '')) || 0;
const first = (row, keys, fallback = '') => keys.map((key) => row?.[key]).find((value) => safe(value)) ?? fallback;
const isClosedStatus = (status = '') => closedTerms.some((term) => safe(status).toLowerCase().includes(term));
const isUserCompletedStatus = (status) => isClosedStatus(status) || /pending approval/i.test(safe(status));
const isDashboardActionableStatus = (status) => !isClosedStatus(status) && !/pending approval/i.test(safe(status));
const ok = (payload = {}) => ({ success: true, ...payload });

function parseReferenceNow(value) {
  if (!value) return new Date();
  if (String(value).includes('T')) return new Date(value);
  return new Date(`${value}T12:00:00+05:30`);
}

const referenceNow = () => parseReferenceNow(process.env.WORKTRACK_REFERENCE_DATE);

function localDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function today() {
  return localDate(referenceNow());
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

function addDays(date, days) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function workingDaysBetween(start, end) {
  if (!start || !end) return 0;
  const from = new Date(`${start}T00:00:00`);
  const to = new Date(`${end}T00:00:00`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) return 0;
  let count = 0;
  for (const cursor = new Date(from); cursor <= to; cursor.setDate(cursor.getDate() + 1)) {
    if (cursor.getDay() !== 0) count++;
  }
  return count;
}

function ymd(date) {
  return localDate(date);
}

function rangeForFilter(range = 'today') {
  const now = referenceNow();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const key = safe(range).toLowerCase().replace(/-/g, '_');
  if (key === 'yesterday') {
    const date = addDays(startOfToday, -1);
    return { start: ymd(date), end: ymd(date) };
  }
  if (key === 'week' || key === 'this_week') {
    const day = startOfToday.getDay();
    const diff = startOfToday.getDate() - day + (day === 0 ? -6 : 1);
    return { start: ymd(new Date(startOfToday.getFullYear(), startOfToday.getMonth(), diff)), end: ymd(startOfToday) };
  }
  if (key === 'last_week') {
    const day = startOfToday.getDay();
    const thisMonday = new Date(startOfToday);
    thisMonday.setDate(startOfToday.getDate() - day + (day === 0 ? -6 : 1));
    const lastMonday = addDays(thisMonday, -7);
    return { start: ymd(lastMonday), end: ymd(addDays(lastMonday, 6)) };
  }
  if (key === 'month' || key === 'this_month') {
    return { start: ymd(new Date(startOfToday.getFullYear(), startOfToday.getMonth(), 1)), end: ymd(startOfToday) };
  }
  if (key === 'last_month') {
    return {
      start: ymd(new Date(startOfToday.getFullYear(), startOfToday.getMonth() - 1, 1)),
      end: ymd(new Date(startOfToday.getFullYear(), startOfToday.getMonth(), 0))
    };
  }
  if (key === 'all' || key === 'all_time') return { start: '', end: '' };
  return { start: ymd(startOfToday), end: ymd(startOfToday) };
}

function minutesLabel(minutes) {
  const total = Math.max(0, Math.round(minutes));
  return `${Math.floor(total / 60)}h ${total % 60}m`;
}

function durationToMinutes(value) {
  const raw = safe(value);
  if (!raw || raw === '-') return 0;
  const hours = raw.match(/(\d+(?:\.\d+)?)\s*h/i);
  const minutes = raw.match(/(\d+(?:\.\d+)?)\s*m/i);
  if (hours || minutes) return Math.round(num(hours?.[1]) * 60 + num(minutes?.[1]));
  const colon = raw.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (colon) return Number(colon[1]) * 60 + Number(colon[2]);
  return num(raw);
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
    Description: first(task, ['Task Description', 'Description', 'Content'])
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

async function getRows() {
  const [users, clients, tickets, expenses, fms, todos, leaves, ticketHistory] = await Promise.all([
    listRows('User'),
    listRows('Client'),
    listRows('Ticket'),
    listRows('Expense'),
    listRows('FmsTask'),
    listRows('Todo'),
    listRows('Leave'),
    listRows('TicketHistory')
  ]);
  return { users, clients, tickets, expenses, fms, todos, leaves, ticketHistory };
}

export async function getDashboardData(employeeId, filterRange) {
  const data = await getRows();
  const user = data.users.find((item) => eq(item['Employee ID'], employeeId));
  const allMyTickets = data.tickets
    .filter((ticket) => eq(ticket['Employee ID'], employeeId) || eq(ticket['Task Approver'], employeeId))
    .map((ticket) => normalizeTicketForDashboard(ticket, data.users, data.clients));
  const allMyFms = data.fms
    .filter((task) => eq(task['Employee ID'], employeeId) || eq(task.empId, employeeId))
    .map((task) => normalizeFmsForDashboard(task, data.users, data.clients));
  const allMyTodos = data.todos
    .filter((todo) => eq(todo['Employee ID'], employeeId))
    .map((todo) => normalizeTodoForDashboard(todo, data.users));

  const { start, end } = rangeForFilter(filterRange);
  const myTickets = allMyTickets.filter((task) => dateInRange(task.Date, start, end));
  const myFms = allMyFms.filter((task) => dateInRange(task.Date, start, end));
  const myTodos = allMyTodos.filter((task) => dateInRange(task.Date, start, end));

  const allTasks = [...allMyTickets, ...allMyFms, ...allMyTodos];
  const todaysTasks = allTasks.filter((task) => task.Date === today());
  const dashboardTickets = myTickets;
  const dashboardFms = myFms;
  const dashboardTodos = myTodos;
  const dashboardTasks = [...dashboardTickets, ...dashboardFms, ...dashboardTodos];
  const upcomingTasks = dashboardTasks.filter((task) => isDashboardActionableStatus(task.Status));
  const pendingTickets = dashboardTickets.filter((task) => isDashboardActionableStatus(task.Status)).length;
  const doneTickets = dashboardTickets.filter((task) => isUserCompletedStatus(task.Status)).length;
  const pendingFms = dashboardFms.filter((task) => isDashboardActionableStatus(task.Status)).length;
  const doneFms = dashboardFms.filter((task) => isClosedStatus(task.Status)).length;
  const pendingTodos = dashboardTodos.filter((task) => isDashboardActionableStatus(task.Status)).length;
  const plannedMinutes = dashboardTasks.reduce((sum, task) => sum + num(task.TAT), 0);
  const productiveMinutes = [...dashboardTickets, ...dashboardFms].reduce((sum, task) => {
    if (isUserCompletedStatus(task.Status) || /in progress/i.test(task.Status)) {
      return sum + (durationToMinutes(task.Duration) || num(task.TAT));
    }
    return sum;
  }, 0);
  const occupied = plannedMinutes ? Math.min(100, Math.round((productiveMinutes / Math.max(plannedMinutes, 1)) * 100)) : 0;
  const bandwidthDelta = Math.abs(plannedMinutes - productiveMinutes);
  const hasShortfall = productiveMinutes < plannedMinutes;

  const assumedMinutes = workingDaysBetween(start, end) * 8 * 60;
  const totalGapMinutes = data.ticketHistory
    .filter((entry) => {
      const actionBy = first(entry, ['Action By', 'Employee ID', 'Employee Name']);
      const timestamp = first(entry, ['Timestamp', 'Date', 'Created At']);
      return (eq(actionBy, employeeId) || eq(actionBy, user?.['Employee Name'])) && dateInRange(timestamp, start, end);
    })
    .sort((left, right) => new Date(first(left, ['Timestamp', 'Date', 'Created At'])) - new Date(first(right, ['Timestamp', 'Date', 'Created At'])))
    .reduce((gap, entry, index, history) => {
      if (index === 0) return gap;
      const currentType = safe(first(entry, ['Action Type', 'Action', 'Status'])).toLowerCase();
      const previousType = safe(first(history[index - 1], ['Action Type', 'Action', 'Status'])).toLowerCase();
      const startsWork = /in progress|work resumed|reopen/.test(currentType);
      const endedWork = /paused|completed|closed/.test(previousType);
      if (!startsWork || !endedWork) return gap;
      const currentTime = new Date(first(entry, ['Timestamp', 'Date', 'Created At']));
      const previousTime = new Date(first(history[index - 1], ['Timestamp', 'Date', 'Created At']));
      const minutes = Math.floor((currentTime - previousTime) / 60000);
      return minutes > 0 && minutes < 480 ? gap + minutes : gap;
    }, 0);

  const lastSevenLabels = [];
  const lastSevenCompleted = [];
  for (let i = 6; i >= 0; i -= 1) {
    const date = referenceNow();
    date.setDate(date.getDate() - i);
    const ymdValue = localDate(date);
    lastSevenLabels.push(date.toLocaleDateString('en-US', { weekday: 'short' }));
    lastSevenCompleted.push(
      [...allMyTickets, ...allMyFms].filter((task) => task.Date === ymdValue && isUserCompletedStatus(task.Status)).length
    );
  }

  return ok({
    data: {
      currentUser: user,
      user,
      tickets: myTickets,
      fmsTasks: myFms,
      todos: myTodos,
      todaysTasks,
      upcomingTasks,
      kpis: {
        pendingTickets,
        doneTickets,
        completedTickets: doneTickets,
        pendingFms,
        doneFms,
        pendingTodos,
        overdueTasks: upcomingTasks.filter((task) => task.Date && task.Date < today()).length,
        totalExpenses: data.expenses
          .filter((expense) => eq(expense['Employee ID'], employeeId))
          .reduce((sum, expense) => sum + num(first(expense, ['Amount', 'Expense Amount'])), 0)
          .toFixed(2),
        assumedBandwidthHours: minutesLabel(assumedMinutes),
        plannedBandwidthHours: minutesLabel(plannedMinutes),
        actualBandwidthHours: minutesLabel(productiveMinutes),
        totalGapTime: minutesLabel(totalGapMinutes),
        occupiedBandwidth: occupied,
        bandwidthDifference: `${hasShortfall ? '+' : '-'}${Math.floor(bandwidthDelta / 60)}h ${bandwidthDelta % 60}m`,
        differenceColor: hasShortfall ? 'text-red-600' : 'text-green-600',
        adminPendingApprovals: data.leaves.filter((row) => /pending/i.test(first(row, ['Status'], 'Pending'))).length
      },
      chartData: {
        lineChart: {
          labels: lastSevenLabels,
          data: lastSevenCompleted
        },
        barChart: {
          labels: ['Tickets', 'FMS'],
          data: [pendingTickets, pendingFms]
        }
      }
    }
  });
}
