import { LegacyModels } from '../models/legacyModels.js';
import { listRows, registerStoreMutationListener, stripInternalMetadata } from './legacyStore.service.js';
import { buildRedisKey, getJson, setJson } from './redisCache.service.js';

const closedTerms = ['closed', 'approved', 'cancelled', 'completed', 'done', 'resolved', 'paid'];
const DASHBOARD_CACHE_TTL_MS = Number(process.env.WORKTRACK_DASHBOARD_CACHE_TTL_MS || 10000);
const DASHBOARD_SNAPSHOT_TTL_MS = Number(process.env.WORKTRACK_DASHBOARD_SNAPSHOT_TTL_MS || 60000);
const dashboardCache = new Map();
const dashboardSnapshotCache = new Map();
const dashboardSnapshotRefreshes = new Map();
const dashboardPrimeJobs = new Map();
let dashboardCacheVersion = 0;
const safe = (value = '') => String(value ?? '').trim();
const eq = (left, right) => safe(left).toLowerCase() === safe(right).toLowerCase();
const num = (value) => Number(String(value ?? 0).replace(/[^0-9.-]/g, '')) || 0;
const first = (row, keys, fallback = '') => keys.map((key) => row?.[key]).find((value) => safe(value)) ?? fallback;
const isClosedStatus = (status = '') => closedTerms.some((term) => safe(status).toLowerCase().includes(term));
const isUserCompletedStatus = (status) => isClosedStatus(status) || /pending approval/i.test(safe(status));
const isDashboardActionableStatus = (status) => !isClosedStatus(status) && !/pending approval/i.test(safe(status));
const ok = (payload = {}) => ({ success: true, ...payload });
const splitIds = (value) => safe(value).split(/[,;|]/).map((item) => item.trim().toLowerCase()).filter(Boolean);
const userId = (row = {}) => first(row, ['Employee ID', 'User ID', 'EMP Code', 'employeeId', 'EmpID']);
const userName = (row = {}) => first(row, ['Employee Name', 'Name', 'name'], userId(row));
const userRole = (row = {}) => safe(first(row, ['Role', 'role', 'Designation'], 'User')).toLowerCase();
const teamDashboardRoles = new Set(['super admin', 'admin', 'hr', 'manager']);
const DEFAULT_DASHBOARD_TASKS_PAGE_SIZE = 20;

function clearDashboardCaches() {
  dashboardCacheVersion += 1;
  dashboardCache.clear();
  dashboardSnapshotCache.clear();
}

registerStoreMutationListener(() => {
  clearDashboardCaches();
});

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

function buildEmployeeQuery(employeeIds = []) {
  const ids = employeeIds.map((value) => safe(value)).filter(Boolean);
  if (!ids.length) return { $or: [{ legacyId: '__no_match__' }] };
  return {
    $or: [
      { 'data.Employee ID': { $in: ids } },
      { 'data.User ID': { $in: ids } },
      { 'data.EMP Code': { $in: ids } },
      { 'data.employeeId': { $in: ids } },
      { 'data.EmpID': { $in: ids } },
      { legacyId: { $in: ids } }
    ]
  };
}

function selfTicketQuery(employeeId = '') {
  const value = safe(employeeId);
  return {
    $or: [
      { 'data.Employee ID': value },
      { 'data.EmpID': value },
      { 'data.employeeId': value },
      { 'data.User ID': value },
      { 'data.Task Approver': value }
    ]
  };
}

function escapeRegex(value = '') {
  return safe(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function csvContainsQuery(field, value) {
  const normalized = escapeRegex(value);
  return { [field]: { $regex: `(^|\\s*[,;|]\\s*)${normalized}(\\s*[,;|]\\s*|$)`, $options: 'i' } };
}

function scopedDateQuery(fields = [], start, end) {
  if (!start || !end || !fields.length) return null;
  const inclusiveEnd = `${end}T23:59:59.999Z`;
  return {
    $or: fields.map((field) => ({
      [field]: { $gte: start, $lte: inclusiveEnd }
    }))
  };
}

function combineAndQueries(...clauses) {
  return {
    $and: clauses.filter(Boolean)
  };
}

function teamUsersQuery(employeeId = '') {
  const value = safe(employeeId);
  return {
    $or: [
      csvContainsQuery('data.Manager ID', value),
      csvContainsQuery('data.Manager', value),
      csvContainsQuery('data.managerId', value),
      csvContainsQuery('data.Reporting Manager', value),
      csvContainsQuery('data.Task Approver', value),
      csvContainsQuery('data.Approver ID', value),
      csvContainsQuery('data.taskApprover', value)
    ]
  };
}

function teamMemberRows(users = [], employeeId = '') {
  const target = safe(employeeId).toLowerCase();
  return users.filter((user) => {
    if (!eq(first(user, ['Status', 'status'], 'Active'), 'Active')) return false;
    const memberId = safe(userId(user)).toLowerCase();
    if (!memberId || memberId === target) return false;
    const managers = splitIds(first(user, ['Manager ID', 'Manager', 'managerId', 'Reporting Manager']));
    const approvers = splitIds(first(user, ['Task Approver', 'Approver ID', 'taskApprover']));
    return managers.includes(target) || approvers.includes(target);
  });
}

function taskOwnerName(task, users = []) {
  const explicit = first(task, ['Employee Name', 'User', 'Who', 'Assigned To']);
  if (explicit) return explicit;
  const empId = first(task, ['Employee ID', 'EmpID', 'empId']);
  const user = users.find((item) => eq(item['Employee ID'], empId));
  return user?.['Employee Name'] || empId || 'Unassigned';
}

function normalizeTicketForDashboard(ticket, users) {
  const status = first(ticket, ['Status'], 'Open');
  const date = first(ticket, ['Plan Date', 'Date', 'Timestamp', 'Due Date'], today());
  return {
    ID: first(ticket, ['Ticket ID', 'Task ID', 'ID']),
    Type: 'Ticket',
    User: taskOwnerName(ticket, users),
    Status: status,
    Date: normalizedDate(date),
    TAT: first(ticket, ['TAT', 'When', 'TAT Minutes'], '0'),
    Duration: first(ticket, ['Total Duration', 'Duration', 'Actual Duration'], '0h 0m'),
    Description: first(ticket, ['Task Description', 'Description', 'Task'])
  };
}

function normalizeFmsForDashboard(task, users) {
  const status = first(task, ['Status'], first(task, ['Done Date', 'actualDate']) ? 'Completed' : 'Pending');
  const date = first(task, ['Plan Date', 'Date'], today());
  return {
    ID: first(task, ['Task ID', 'ID', 'rowId']),
    Type: 'FMS',
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
    ID: first(todo, ['Task ID', 'TodoID', 'ID']),
    Type: 'To-Do',
    User: taskOwnerName(todo, users),
    Status: first(todo, ['Status'], 'Pending'),
    Date: normalizedDate(date),
    TAT: first(todo, ['TAT', 'When'], '0'),
    Description: first(todo, ['Task', 'Description', 'Task Description'])
  };
}

function fromLegacyDocs(docs = []) {
  return docs.map((doc) => ({
    ...stripInternalMetadata(doc.data || {}),
    _id: String(doc._id),
    _legacyId: doc.legacyId
  }));
}

async function listDataRows(modelName, query = {}, projection = { data: 1, legacyId: 1 }) {
  const docs = await LegacyModels[modelName].collection.find(query, { projection }).toArray();
  return fromLegacyDocs(docs);
}

async function findDataRow(modelName, query = {}, projection = { data: 1, legacyId: 1 }) {
  const doc = await LegacyModels[modelName].collection.findOne(query, { projection });
  return doc ? fromLegacyDocs([doc])[0] : null;
}

function sortDashboardTasks(rows = []) {
  return [...rows].sort((left, right) => {
    const leftDate = normalizedDate(left.Date || left['Plan Date'] || '');
    const rightDate = normalizedDate(right.Date || right['Plan Date'] || '');
    if (leftDate !== rightDate) return rightDate.localeCompare(leftDate);
    const leftStatus = safe(left.Status);
    const rightStatus = safe(right.Status);
    if (leftStatus !== rightStatus) return leftStatus.localeCompare(rightStatus);
    return safe(left.ID).localeCompare(safe(right.ID));
  });
}

function paginateDashboardTasks(rows = [], page = 1, pageSize = DEFAULT_DASHBOARD_TASKS_PAGE_SIZE) {
  const normalizedPage = Math.max(1, Number(page || 1) || 1);
  const normalizedPageSize = Math.min(50, Math.max(10, Number(pageSize || DEFAULT_DASHBOARD_TASKS_PAGE_SIZE) || DEFAULT_DASHBOARD_TASKS_PAGE_SIZE));
  const total = rows.length;
  const pageCount = Math.max(1, Math.ceil(total / normalizedPageSize));
  const safePage = Math.min(normalizedPage, pageCount);
  const startIndex = (safePage - 1) * normalizedPageSize;
  return {
    rows: rows.slice(startIndex, startIndex + normalizedPageSize),
    pagination: {
      page: safePage,
      pageSize: normalizedPageSize,
      total,
      pageCount
    }
  };
}

function buildDashboardSnapshotKey(employeeId = '', filterRange = 'today', viewMode = 'my') {
  return `${safe(employeeId).toLowerCase()}::${safe(filterRange || 'today').toLowerCase()}::${safe(viewMode || 'my').toLowerCase()}`;
}

function dashboardPayloadRedisKey(cacheKey) {
  return buildRedisKey('dashboard', `v${dashboardCacheVersion}`, 'payload', cacheKey);
}

function dashboardSnapshotRedisKey(snapshotKey) {
  return buildRedisKey('dashboard', `v${dashboardCacheVersion}`, 'snapshot', snapshotKey);
}

async function readRedisDashboardPayload(cacheKey) {
  const cached = await getJson(dashboardPayloadRedisKey(cacheKey));
  if (cached && Date.now() - Number(cached.createdAt || 0) < DASHBOARD_CACHE_TTL_MS) {
    return cached;
  }
  return null;
}

async function readRedisDashboardSnapshot(snapshotKey) {
  const cached = await getJson(dashboardSnapshotRedisKey(snapshotKey));
  if (cached && Date.now() - Number(cached.createdAt || 0) < DASHBOARD_SNAPSHOT_TTL_MS) {
    return cached;
  }
  return null;
}

function writeDashboardPayload(cacheKey, payload) {
  const entry = { createdAt: Date.now(), payload };
  dashboardCache.set(cacheKey, entry);
  void setJson(dashboardPayloadRedisKey(cacheKey), entry, DASHBOARD_CACHE_TTL_MS);
}

function writeDashboardSnapshot(snapshotKey, snapshot) {
  const entry = { createdAt: Date.now(), snapshot };
  dashboardSnapshotCache.set(snapshotKey, entry);
  void setJson(dashboardSnapshotRedisKey(snapshotKey), entry, DASHBOARD_SNAPSHOT_TTL_MS);
}

function buildDashboardSnapshotData({
  scopeUser,
  visibleUsers,
  tickets,
  fms,
  todos,
  expenses,
  pendingLeaveCount,
  ticketHistory,
  chartTickets,
  chartFms,
  start,
  end,
  scopeLabel = 'my'
}) {
  const scopeEmployeeId = userId(scopeUser);
  const scopeUserName = userName(scopeUser);
  const allTickets = tickets.map((ticket) => normalizeTicketForDashboard(ticket, visibleUsers));
  const allFms = fms.map((task) => normalizeFmsForDashboard(task, visibleUsers));
  const allTodos = todos.map((todo) => normalizeTodoForDashboard(todo, visibleUsers));

  const scopedTickets = allTickets.filter((task) => dateInRange(task.Date, start, end));
  const scopedFms = allFms.filter((task) => dateInRange(task.Date, start, end));
  const scopedTodos = allTodos.filter((task) => dateInRange(task.Date, start, end));

  const allTasks = [...allTickets, ...allFms, ...allTodos];
  const dashboardTickets = scopedTickets;
  const dashboardFms = scopedFms;
  const dashboardTodos = scopedTodos;
  const normalizedChartTickets = (chartTickets || tickets).map((ticket) => normalizeTicketForDashboard(ticket, visibleUsers));
  const normalizedChartFms = (chartFms || fms).map((task) => normalizeFmsForDashboard(task, visibleUsers));
  const dashboardTasks = sortDashboardTasks([...dashboardTickets, ...dashboardFms, ...dashboardTodos]);
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
  const totalGapMinutes = ticketHistory
    .filter((entry) => {
      const actionBy = first(entry, ['Action By', 'Employee ID', 'Employee Name']);
      const timestamp = first(entry, ['Timestamp', 'Date', 'Created At']);
      return (
        visibleUsers.some((user) => eq(userId(user), actionBy) || eq(userName(user), actionBy))
        || eq(actionBy, scopeEmployeeId)
        || eq(actionBy, scopeUserName)
      ) && dateInRange(timestamp, start, end);
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
      [...normalizedChartTickets, ...normalizedChartFms]
        .filter((task) => task.Date === ymdValue && isUserCompletedStatus(task.Status)).length
    );
  }

  return {
    currentUser: scopeUser,
    user: scopeUser,
    tickets: scopedTickets,
    fmsTasks: scopedFms,
    todos: scopedTodos,
    allTasks: dashboardTasks,
    upcomingTasks,
    scope: scopeLabel,
    taskTotals: {
      tickets: scopedTickets.length,
      fms: scopedFms.length,
      todos: scopedTodos.length,
      all: dashboardTasks.length
    },
    teamMembers: visibleUsers.filter((user) => !eq(userId(user), scopeEmployeeId)).map((user) => ({
      employeeId: userId(user),
      name: userName(user),
      role: first(user, ['Role', 'role'], 'User'),
      department: first(user, ['Department', 'department'], '')
    })),
    kpis: {
      pendingTickets,
      doneTickets,
      completedTickets: doneTickets,
      pendingFms,
      doneFms,
      pendingTodos,
      overdueTasks: upcomingTasks.filter((task) => task.Date && task.Date < today()).length,
      totalExpenses: expenses.reduce((sum, expense) => sum + num(first(expense, ['Amount', 'Expense Amount'])), 0)
        .toFixed(2),
      assumedBandwidthHours: minutesLabel(assumedMinutes),
      plannedBandwidthHours: minutesLabel(plannedMinutes),
      actualBandwidthHours: minutesLabel(productiveMinutes),
      totalGapTime: minutesLabel(totalGapMinutes),
      occupiedBandwidth: occupied,
      bandwidthDifference: `${hasShortfall ? '+' : '-'}${Math.floor(bandwidthDelta / 60)}h ${bandwidthDelta % 60}m`,
      differenceColor: hasShortfall ? 'text-red-600' : 'text-green-600',
      adminPendingApprovals: pendingLeaveCount,
      teamMembers: Math.max(0, visibleUsers.filter((user) => !eq(userId(user), scopeEmployeeId)).length)
    },
    chartData: {
      lineChart: {
        labels: lastSevenLabels,
        data: lastSevenCompleted
      },
      barChart: {
        labels: ['Tickets', 'FMS', 'To-Do'],
        data: [pendingTickets, pendingFms, pendingTodos]
      }
    }
  };
}

async function computeDashboardSnapshot(employeeId, filterRange, normalizedViewMode) {
  const { start, end } = rangeForFilter(filterRange);
  const lastSevenEnd = today();
  const lastSevenStart = normalizedDate(addDays(referenceNow(), -6));
  const userQuery = {
    $or: [
      { 'data.Employee ID': employeeId },
      { 'data.User ID': employeeId },
      { 'data.EMP Code': employeeId }
    ]
  };
  const userProjection = {
    legacyId: 1,
    'data.Employee ID': 1,
    'data.User ID': 1,
    'data.EMP Code': 1,
    'data.employeeId': 1,
    'data.EmpID': 1,
    'data.Employee Name': 1,
    'data.Name': 1,
    'data.name': 1,
    'data.Role': 1,
    'data.role': 1,
    'data.Department': 1,
    'data.department': 1,
    'data.Status': 1,
    'data.status': 1,
    'data.Manager ID': 1,
    'data.Manager': 1,
    'data.managerId': 1,
    'data.Reporting Manager': 1,
    'data.Task Approver': 1,
    'data.Approver ID': 1,
    'data.taskApprover': 1
  };
  const dashboardTaskProjection = {
    legacyId: 1,
    'data.Ticket ID': 1,
    'data.Task ID': 1,
    'data.TodoID': 1,
    'data.ID': 1,
    'data.Employee ID': 1,
    'data.EmpID': 1,
    'data.empId': 1,
    'data.Employee Name': 1,
    'data.User': 1,
    'data.Who': 1,
    'data.Assigned To': 1,
    'data.Status': 1,
    'data.Plan Date': 1,
    'data.Date': 1,
    'data.Timestamp': 1,
    'data.Due Date': 1,
    'data.TAT': 1,
    'data.When': 1,
    'data.TAT Minutes': 1,
    'data.Duration': 1,
    'data.Total Duration': 1,
    'data.Actual Duration': 1,
    'data.Task Description': 1,
    'data.Description': 1,
    'data.Task': 1,
    'data.Content': 1,
    'data.Done Date': 1,
    'data.actualDate': 1
  };
  const historyProjection = {
    legacyId: 1,
    'data.Action By': 1,
    'data.Employee ID': 1,
    'data.Employee Name': 1,
    'data.Timestamp': 1,
    'data.Date': 1,
    'data.Created At': 1,
    'data.Action Type': 1,
    'data.Action': 1,
    'data.Status': 1
  };
  const expenseProjection = {
    legacyId: 1,
    'data.Employee ID': 1,
    'data.employeeId': 1,
    'data.EmpID': 1,
    'data.Amount': 1,
    'data.Expense Amount': 1
  };
  const [user, initialTeamMembers] = await Promise.all([
    findDataRow('User', userQuery, userProjection),
    normalizedViewMode === 'team' ? listDataRows('User', teamUsersQuery(employeeId), userProjection) : Promise.resolve([])
  ]);

  const normalizedRole = userRole(user);
  const canViewTeamDashboard = teamDashboardRoles.has(normalizedRole);
  const isTeamMode = normalizedViewMode === 'team' && canViewTeamDashboard;
  const teamMembers = isTeamMode ? teamMemberRows(initialTeamMembers, employeeId) : [];
  const scopedEmployeeIds = isTeamMode ? teamMembers.map((member) => userId(member)).filter(Boolean) : [employeeId];
  const scopedUserRows = isTeamMode ? teamMembers : (user ? [user] : []);
  const ticketHistoryUserNames = scopedUserRows.map((item) => userName(item)).filter(Boolean);
  const ticketHistoryQuery = isTeamMode
    ? {
      $or: [
        { 'data.Action By': { $in: scopedEmployeeIds } },
        { 'data.Employee ID': { $in: scopedEmployeeIds } },
        { 'data.Employee Name': { $in: ticketHistoryUserNames } },
        { 'data.Action By': { $in: ticketHistoryUserNames } }
      ]
    }
    : {
      $or: [
        { 'data.Action By': employeeId },
        { 'data.Employee ID': employeeId },
        { 'data.Employee Name': userName(user) || employeeId }
      ]
    };

  const taskRangeClause = scopedDateQuery(['data.Plan Date', 'data.Date', 'data.Timestamp', 'data.Due Date'], start, end);
  const chartRangeClause = scopedDateQuery(['data.Plan Date', 'data.Date', 'data.Timestamp', 'data.Due Date'], lastSevenStart, lastSevenEnd);
  const historyRangeClause = scopedDateQuery(['data.Timestamp', 'data.Date', 'createdAt'], start, end);
  const expenseRangeClause = scopedDateQuery(['data.Date', 'createdAt'], start, end);
  const chartTicketBaseQuery = isTeamMode ? buildEmployeeQuery(scopedEmployeeIds) : selfTicketQuery(employeeId);
  const chartFmsBaseQuery = buildEmployeeQuery(scopedEmployeeIds);
  const selectedTicketQuery = combineAndQueries(isTeamMode ? buildEmployeeQuery(scopedEmployeeIds) : selfTicketQuery(employeeId), taskRangeClause);
  const selectedFmsQuery = combineAndQueries(buildEmployeeQuery(scopedEmployeeIds), taskRangeClause);
  const selectedTodoQuery = combineAndQueries(buildEmployeeQuery(scopedEmployeeIds), taskRangeClause);
  const selectedExpenseQuery = combineAndQueries(buildEmployeeQuery(scopedEmployeeIds), expenseRangeClause);
  const selectedHistoryQuery = combineAndQueries(ticketHistoryQuery, historyRangeClause);
  const chartTicketQuery = combineAndQueries(chartTicketBaseQuery, chartRangeClause);
  const chartFmsQuery = combineAndQueries(chartFmsBaseQuery, chartRangeClause);

  const [tickets, fms, todos, expenses, pendingLeaveCount, ticketHistory] = await Promise.all([
    listDataRows('Ticket', selectedTicketQuery, dashboardTaskProjection),
    listDataRows('FmsTask', selectedFmsQuery, dashboardTaskProjection),
    listDataRows('Todo', selectedTodoQuery, dashboardTaskProjection),
    listDataRows('Expense', selectedExpenseQuery, expenseProjection),
    LegacyModels.Leave.collection.countDocuments({
      $and: [
        buildEmployeeQuery(scopedEmployeeIds),
        { $or: [{ 'data.Status': /pending/i }, { 'data.status': /pending/i }, { 'data.Admin Approval': /pending/i }] }
      ]
    }),
    listDataRows('TicketHistory', selectedHistoryQuery, historyProjection)
  ]);

  const [chartTickets, chartFms] = await Promise.all([
    listDataRows('Ticket', chartTicketQuery, dashboardTaskProjection),
    listDataRows('FmsTask', chartFmsQuery, dashboardTaskProjection)
  ]);

  return {
    ...buildDashboardSnapshotData({
      scopeUser: user,
      visibleUsers: scopedUserRows,
      tickets,
      fms,
      todos,
      expenses,
      pendingLeaveCount,
      ticketHistory,
      chartTickets,
      chartFms,
      start,
      end,
      scopeLabel: isTeamMode ? 'team' : 'my'
    }),
    canViewTeamDashboard
  };
}

export async function primeDashboardSnapshotsForAllEmployees() {
  const users = await listRows('User');
  const activeUsers = users.filter((user) => eq(first(user, ['Status', 'status'], 'Active'), 'Active'));
  for (const user of activeUsers) {
    await primeDashboardSnapshots(userId(user), first(user, ['Role', 'role'], 'User'));
  }
}

function materializeDashboardPayload(snapshot, options = {}) {
  const includeTasks = options.includeTasks !== false;
  const includeCollections = options.includeCollections !== false;
  const taskPage = Math.max(1, Number(options.taskPage || options.page || 1) || 1);
  const taskPageSize = Math.min(50, Math.max(10, Number(options.taskPageSize || options.pageSize || DEFAULT_DASHBOARD_TASKS_PAGE_SIZE) || DEFAULT_DASHBOARD_TASKS_PAGE_SIZE));
  const pagedTasks = paginateDashboardTasks(snapshot.allTasks || [], taskPage, taskPageSize);
  const {
    allTasks,
    ...publicSnapshot
  } = snapshot;

  return ok({
    data: {
      ...publicSnapshot,
      tickets: includeCollections ? (publicSnapshot.tickets || []) : [],
      fmsTasks: includeCollections ? (publicSnapshot.fmsTasks || []) : [],
      todos: includeCollections ? (publicSnapshot.todos || []) : [],
      todaysTasks: includeTasks ? pagedTasks.rows : [],
      upcomingTasks: includeTasks ? (publicSnapshot.upcomingTasks || []) : [],
      taskPagination: pagedTasks.pagination
    }
  });
}

function scheduleSnapshotRefresh(snapshotKey, employeeId, filterRange, normalizedViewMode) {
  if (dashboardSnapshotRefreshes.has(snapshotKey)) return;
  const cacheVersion = dashboardCacheVersion;
  const refreshPromise = Promise.resolve()
    .then(async () => {
      const snapshot = await computeDashboardSnapshot(employeeId, filterRange, normalizedViewMode);
      if (cacheVersion === dashboardCacheVersion) {
        writeDashboardSnapshot(snapshotKey, snapshot);
      }
    })
    .catch(() => null)
    .finally(() => {
      dashboardSnapshotRefreshes.delete(snapshotKey);
    });
  dashboardSnapshotRefreshes.set(snapshotKey, refreshPromise);
}

function trackPrimeJob(snapshotKey, job) {
  if (dashboardPrimeJobs.has(snapshotKey)) return dashboardPrimeJobs.get(snapshotKey);
  const tracked = Promise.resolve(job)
    .catch(() => null)
    .finally(() => {
      dashboardPrimeJobs.delete(snapshotKey);
    });
  dashboardPrimeJobs.set(snapshotKey, tracked);
  return tracked;
}

export async function getDashboardData(employeeId, filterRange, viewMode = 'my', options = {}) {
  const normalizedViewMode = safe(viewMode || 'my').toLowerCase() === 'team' ? 'team' : 'my';
  const includeTasks = options.includeTasks !== false;
  const includeCollections = options.includeCollections !== false;
  const taskPage = Math.max(1, Number(options.taskPage || options.page || 1) || 1);
  const taskPageSize = Math.min(50, Math.max(10, Number(options.taskPageSize || options.pageSize || DEFAULT_DASHBOARD_TASKS_PAGE_SIZE) || DEFAULT_DASHBOARD_TASKS_PAGE_SIZE));
  const cacheKey = `${buildDashboardSnapshotKey(employeeId, filterRange, normalizedViewMode)}::${includeTasks ? 'tasks' : 'summary'}::${includeCollections ? 'collections' : 'compact'}::${taskPage}::${taskPageSize}`;
  const cacheVersion = dashboardCacheVersion;
  const cached = dashboardCache.get(cacheKey);
  if (cached && Date.now() - cached.createdAt < DASHBOARD_CACHE_TTL_MS) {
    return cached.payload;
  }

  const redisPayload = await readRedisDashboardPayload(cacheKey);
  if (redisPayload) {
    dashboardCache.set(cacheKey, redisPayload);
    return redisPayload.payload;
  }

  const snapshotKey = buildDashboardSnapshotKey(employeeId, filterRange, normalizedViewMode);
  const primeJob = dashboardPrimeJobs.get(snapshotKey);
  if (primeJob) {
    await primeJob.catch(() => null);
    const primedSnapshotEntry = dashboardSnapshotCache.get(snapshotKey);
    if (primedSnapshotEntry) {
      const primedPayload = materializeDashboardPayload(primedSnapshotEntry.snapshot, {
        includeTasks,
        includeCollections,
        taskPage,
        taskPageSize
      });
      writeDashboardPayload(cacheKey, primedPayload);
      return primedPayload;
    }
  }
  const snapshotEntry = dashboardSnapshotCache.get(snapshotKey);
  if (snapshotEntry) {
    if (Date.now() - snapshotEntry.createdAt >= DASHBOARD_SNAPSHOT_TTL_MS) {
      scheduleSnapshotRefresh(snapshotKey, employeeId, filterRange, normalizedViewMode);
    }
    const payload = materializeDashboardPayload(snapshotEntry.snapshot, {
      includeTasks,
      includeCollections,
      taskPage,
      taskPageSize
    });
    writeDashboardPayload(cacheKey, payload);
    return payload;
  }

  const redisSnapshot = await readRedisDashboardSnapshot(snapshotKey);
  if (redisSnapshot) {
    const payload = materializeDashboardPayload(redisSnapshot.snapshot, {
      includeTasks,
      includeCollections,
      taskPage,
      taskPageSize
    });
    writeDashboardSnapshot(snapshotKey, redisSnapshot.snapshot);
    writeDashboardPayload(cacheKey, payload);
    return payload;
  }

  const snapshot = await computeDashboardSnapshot(employeeId, filterRange, normalizedViewMode);
  if (cacheVersion === dashboardCacheVersion) {
    writeDashboardSnapshot(snapshotKey, snapshot);
  }
  const payload = materializeDashboardPayload(snapshot, {
    includeTasks,
    includeCollections,
    taskPage,
    taskPageSize
  });
  writeDashboardPayload(cacheKey, payload);
  return payload;
}

export function primeDashboardSnapshots(employeeId, role) {
  const normalizedRole = safe(role).toLowerCase();
  const tasksPageSize = DEFAULT_DASHBOARD_TASKS_PAGE_SIZE;
  const cacheVersion = dashboardCacheVersion;
  const jobs = [
    trackPrimeJob(
      buildDashboardSnapshotKey(employeeId, 'today', 'my'),
      computeDashboardSnapshot(employeeId, 'today', 'my').then((snapshot) => {
        if (cacheVersion !== dashboardCacheVersion) return;
        const snapshotKey = buildDashboardSnapshotKey(employeeId, 'today', 'my');
        writeDashboardSnapshot(snapshotKey, snapshot);
        writeDashboardPayload(
          `${snapshotKey}::summary::compact::1::${DEFAULT_DASHBOARD_TASKS_PAGE_SIZE}`,
          materializeDashboardPayload(snapshot, {
            includeTasks: false,
            includeCollections: false,
            taskPage: 1,
            taskPageSize: DEFAULT_DASHBOARD_TASKS_PAGE_SIZE
          })
        );
      })
    )
  ];
  if (teamDashboardRoles.has(normalizedRole)) {
    jobs.push(
      trackPrimeJob(
        buildDashboardSnapshotKey(employeeId, 'today', 'team'),
        computeDashboardSnapshot(employeeId, 'today', 'team').then((snapshot) => {
          if (cacheVersion !== dashboardCacheVersion) return;
          const snapshotKey = buildDashboardSnapshotKey(employeeId, 'today', 'team');
          writeDashboardSnapshot(snapshotKey, snapshot);
          writeDashboardPayload(
            `${snapshotKey}::tasks::compact::1::${tasksPageSize}`,
            materializeDashboardPayload(snapshot, {
              includeTasks: true,
              includeCollections: false,
              taskPage: 1,
              taskPageSize: tasksPageSize
            })
          );
        })
      )
    );
  }
  return Promise.allSettled(jobs);
}
