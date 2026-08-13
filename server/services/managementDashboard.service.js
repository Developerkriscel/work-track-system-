import { LegacyModels } from '../models/legacyModels.js';
import { insertRow, listRows, registerStoreMutationListener } from './legacyStore.service.js';
import { buildRedisKey, getJson, setJson } from './redisCache.service.js';
import { createTicket } from './ticket.service.js';

const safe = (value = '') => String(value ?? '').trim();
const eq = (left, right) => safe(left).toLowerCase() === safe(right).toLowerCase();
const num = (value) => Number(String(value ?? 0).replace(/[^0-9.-]/g, '')) || 0;
const first = (row, keys, fallback = '') => keys.map((key) => row?.[key]).find((value) => safe(value)) ?? fallback;
const ok = (payload = {}) => ({ success: true, ...payload });

const closedTerms = ['closed', 'approved', 'cancelled', 'completed', 'done', 'resolved', 'paid'];
const DASHBOARD_CACHE_TTL_MS = Number(process.env.WORKTRACK_MANAGEMENT_DASHBOARD_CACHE_TTL_MS || 120_000);
const MANAGEMENT_VERSION_KEY = buildRedisKey('management-dashboard', 'version');
const MANAGEMENT_CACHE_PREFIX = 'management-dashboard-cache';
const managementRelevantModels = new Set([
  'User',
  'Client',
  'Ticket',
  'Attendance',
  'Leave',
  'Intimation',
  'FmsTask',
  'Todo',
  'Invoice'
]);
const memoryCache = new Map();
const inflightCache = new Map();
const primeTimers = new Map();
let localDashboardVersion = Date.now();

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

function formatDate(date) {
  return new Date(date).toISOString().slice(0, 10);
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfWeek(date) {
  const next = new Date(date);
  const day = next.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  next.setDate(next.getDate() + diff);
  next.setHours(12, 0, 0, 0);
  return next;
}

function endOfWeek(date) {
  return addDays(startOfWeek(date), 6);
}

function startOfMonth(date) {
  const next = new Date(date.getFullYear(), date.getMonth(), 1, 12);
  return next;
}

function endOfMonth(date) {
  const next = new Date(date.getFullYear(), date.getMonth() + 1, 0, 12);
  return next;
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

function monthFromLabel(label = '') {
  const key = safe(label).slice(0, 3).toLowerCase();
  const months = {
    jan: '01',
    feb: '02',
    mar: '03',
    apr: '04',
    may: '05',
    jun: '06',
    jul: '07',
    aug: '08',
    sep: '09',
    oct: '10',
    nov: '11',
    dec: '12'
  };
  return months[key] || '';
}

function monthLabelFromNumber(month = '') {
  const labels = {
    '01': 'Jan',
    '02': 'Feb',
    '03': 'Mar',
    '04': 'Apr',
    '05': 'May',
    '06': 'Jun',
    '07': 'Jul',
    '08': 'Aug',
    '09': 'Sep',
    '10': 'Oct',
    '11': 'Nov',
    '12': 'Dec'
  };
  return labels[String(month).padStart(2, '0')] || '';
}

function enumerateMonths(startDate, endDate, limit = 12) {
  if (!startDate || !endDate) return [];
  const start = new Date(`${startDate}T12:00:00+05:30`);
  const end = new Date(`${endDate}T12:00:00+05:30`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return [];
  const values = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1, 12);
  const endCursor = new Date(end.getFullYear(), end.getMonth(), 1, 12);
  while (cursor <= endCursor && values.length < limit) {
    const year = String(cursor.getFullYear());
    const shortYear = year.slice(-2);
    const month = String(cursor.getMonth() + 1).padStart(2, '0');
    values.push({
      year,
      shortYear,
      month,
      monthLabel: monthLabelFromNumber(month)
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return values;
}

function resolveFmsDate(task = {}) {
  const explicitPlanDate = safe(first(task, ['Plan Date', 'Date']));
  if (explicitPlanDate && !explicitPlanDate.startsWith('2001-')) {
    return normalizedDate(explicitPlanDate);
  }

  const rawPlanDate = safe(first(task, ['rawPlanDate', 'Raw Plan Date']));
  const match = rawPlanDate.match(/^(\d{1,2})-([A-Za-z]{3})\b/);
  if (match) {
    const day = String(match[1]).padStart(2, '0');
    const month = monthFromLabel(match[2]);
    const sourceYear = new Date(first(task, ['sourceUpdatedAt'], referenceNow().toISOString())).getFullYear();
    if (month && Number.isFinite(sourceYear)) {
      return `${sourceYear}-${month}-${day}`;
    }
  }

  return normalizedDate(explicitPlanDate || today());
}

function dateInRange(value, start, end) {
  if (!start || !end || !value) return true;
  const date = normalizedDate(value);
  return date >= start && date <= end;
}

function enumerateDates(startDate, endDate, limit = 93) {
  if (!startDate || !endDate) return [];
  const start = new Date(`${startDate}T12:00:00+05:30`);
  const end = new Date(`${endDate}T12:00:00+05:30`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return [];

  const dates = [];
  const cursor = new Date(start);
  while (cursor <= end && dates.length < limit) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

function cacheKey(scope, parts = []) {
  return [scope, ...parts.map((part) => safe(part)).filter(Boolean)].join(':').toLowerCase();
}

function projectionFromFields(fields = []) {
  return fields.reduce(
    (acc, field) => {
      acc[`data.${field}`] = 1;
      return acc;
    },
    { legacyId: 1 }
  );
}

const USER_FIELDS = [
  'Employee ID',
  'Employee Name',
  'Role',
  'Status',
  'Manager',
  'Manager ID',
  'Task Approver',
  'Department'
];

const CLIENT_FIELDS = [
  'Client_Id',
  'Client ID',
  'Client Name',
  'Status'
];

const TICKET_FIELDS = [
  'Ticket ID',
  'Task ID',
  'ID',
  'Status',
  'Plan Date',
  'Date',
  'Timestamp',
  'Due Date',
  'Client',
  'Client Name',
  'CustomerName',
  'Client_Id',
  'Client ID',
  'CustomerID',
  'Employee Name',
  'User',
  'Who',
  'Assigned To',
  'Employee ID',
  'EmpID',
  'empId',
  'TAT',
  'When',
  'TAT Minutes',
  'Total Duration',
  'Duration',
  'Actual Duration',
  'Task Description',
  'Description',
  'Task'
];

const FMS_FIELDS = [
  'Task ID',
  'ID',
  'rowId',
  'Status',
  'Plan Date',
  'planDate',
  'Date',
  'date',
  'Done Date',
  'doneDate',
  'actualDate',
  'rawPlanDate',
  'Raw Plan Date',
  'sourceUpdatedAt',
  'Client',
  'Client Name',
  'Client_Id',
  'Client ID',
  'CustomerID',
  'Employee Name',
  'User',
  'Who',
  'Assigned To',
  'Employee ID',
  'EmpID',
  'empId',
  'TAT',
  'When',
  'Duration',
  'Actual Duration',
  'Task Description',
  'Description',
  'Task',
  'Content'
];

const OVERVIEW_TICKET_FIELDS = [
  'Ticket ID',
  'Task ID',
  'ID',
  'Status',
  'Plan Date',
  'Date',
  'Timestamp',
  'Client',
  'Client Name',
  'Client_Id',
  'Client ID',
  'Employee Name',
  'User',
  'Who',
  'Assigned To',
  'Employee ID',
  'EmpID',
  'empId',
  'TAT',
  'When',
  'Task Description',
  'Description',
  'Task'
];

const OVERVIEW_FMS_FIELDS = [
  'Task ID',
  'ID',
  'rowId',
  'Status',
  'Plan Date',
  'planDate',
  'Date',
  'date',
  'Done Date',
  'doneDate',
  'actualDate',
  'rawPlanDate',
  'Raw Plan Date',
  'sourceUpdatedAt',
  'Client',
  'Client Name',
  'Client_Id',
  'Client ID',
  'Employee Name',
  'User',
  'Who',
  'Assigned To',
  'Employee ID',
  'EmpID',
  'empId',
  'TAT',
  'When',
  'Task Description',
  'Description',
  'Task',
  'Content'
];

const OVERVIEW_TODO_FIELDS = [
  'Task ID',
  'TodoID',
  'ID',
  'Status',
  'Due Date',
  'Date',
  'Employee ID',
  'EmpID',
  'empId',
  'Employee Name',
  'User',
  'Who',
  'TAT',
  'When',
  'Task',
  'Description',
  'Task Description'
];

const TODO_FIELDS = [
  'Task ID',
  'TodoID',
  'ID',
  'Status',
  'Due Date',
  'Date',
  'Employee ID',
  'EmpID',
  'empId',
  'Employee Name',
  'User',
  'Who',
  'TAT',
  'When',
  'Task',
  'Description',
  'Task Description'
];

const ATTENDANCE_FIELDS = [
  'AttendanceID',
  'Employee ID',
  'EmpID',
  'Employee Name',
  'Name',
  'Date',
  'Action',
  'Status'
];

const INVOICE_FIELDS = [
  'InvoiceID',
  'ID',
  'Client_Id',
  'Client ID',
  'CustomerID',
  'Client Name',
  'CustomerName',
  'Status',
  'Outstanding',
  'Balance',
  'Due Amount'
];

async function getCached(scope, parts, loader) {
  const key = cacheKey(scope, parts);
  const memory = memoryCache.get(key);
  if (memory && memory.expiresAt > Date.now()) {
    return memory.value;
  }

  if (inflightCache.has(key)) {
    return inflightCache.get(key);
  }

  const promise = (async () => {
    const redisKey = buildRedisKey(MANAGEMENT_CACHE_PREFIX, key);
    const redisValue = await getJson(redisKey).catch(() => null);
    if (redisValue) {
      memoryCache.set(key, { value: redisValue, expiresAt: Date.now() + DASHBOARD_CACHE_TTL_MS });
      return redisValue;
    }

    const value = await loader();
    memoryCache.set(key, { value, expiresAt: Date.now() + DASHBOARD_CACHE_TTL_MS });
    void setJson(redisKey, value, DASHBOARD_CACHE_TTL_MS);
    return value;
  })().finally(() => {
    inflightCache.delete(key);
  });

  inflightCache.set(key, promise);
  return promise;
}

function managementPrimeRanges() {
  const now = referenceNow();
  return [
    { startDate: today(), endDate: today() },
    { startDate: formatDate(startOfWeek(now)), endDate: formatDate(endOfWeek(now)) },
    { startDate: formatDate(startOfMonth(now)), endDate: formatDate(endOfMonth(now)) }
  ];
}

function scheduleManagementPrime(version) {
  const primeKey = String(version || localDashboardVersion);
  if (primeTimers.has(primeKey)) return;
  const timer = setTimeout(() => {
    primeTimers.delete(primeKey);
    managementPrimeRanges().forEach(({ startDate, endDate }) => {
      void getManagementDashboardData(startDate, endDate, 'overview').catch(() => null);
      void getManagementDashboardData(startDate, endDate, 'full').catch(() => null);
    });
  }, 150);
  primeTimers.set(primeKey, timer);
}

function clearManagementDashboardCache() {
  memoryCache.clear();
  inflightCache.clear();
  localDashboardVersion = Date.now();
}

registerStoreMutationListener((modelName) => {
  if (modelName && !managementRelevantModels.has(modelName)) return;
  clearManagementDashboardCache();
  void setJson(MANAGEMENT_VERSION_KEY, { version: localDashboardVersion }, 0);
  scheduleManagementPrime(localDashboardVersion);
});

async function getDashboardVersion() {
  const cached = await getJson(MANAGEMENT_VERSION_KEY).catch(() => null);
  if (cached?.version) {
    localDashboardVersion = Number(cached.version) || localDashboardVersion;
    return String(localDashboardVersion);
  }
  void setJson(MANAGEMENT_VERSION_KEY, { version: localDashboardVersion }, 0);
  return String(localDashboardVersion);
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
  const date = resolveFmsDate(task);
  return {
    ...task,
    ID: first(task, ['Task ID', 'ID', 'rowId']),
    Type: 'FMS',
    Client: clientName(task, clients),
    User: taskOwnerName(task, users),
    Status: status,
    Date: date,
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

function rowsFromDocs(docs = []) {
  return docs.map((doc) => ({
    ...(doc?.data || {}),
    _id: String(doc?._id || ''),
    _legacyId: doc?.legacyId || ''
  }));
}

function rangeQuery(primaryField, startDate, endDate, fallbackFields = []) {
  if (!startDate || !endDate) return {};
  const clauses = [
    { [`data.${primaryField}`]: { $gte: startDate, $lte: endDate } }
  ];

  fallbackFields.forEach((field) => {
    clauses.push({ [`data.${field}`]: { $gte: startDate, $lte: endDate } });
  });

  return clauses.length === 1 ? clauses[0] : { $or: clauses };
}

function fmsRangeQuery(startDate, endDate) {
  if (!startDate || !endDate) return {};
  const monthTokens = enumerateMonths(startDate, endDate);
  const rawPlanDateClauses = monthTokens.flatMap(({ month, shortYear, monthLabel }) => {
    const numericRegex = new RegExp(`^0?${Number(month)}/\\d{1,2}/${shortYear}$`, 'i');
    const labelRegex = new RegExp(`^\\d{1,2}-${monthLabel}\\b`, 'i');
    return [
      { 'data.rawPlanDate': numericRegex },
      { 'data.rawPlanDate': labelRegex },
      { 'data.Raw Plan Date': numericRegex },
      { 'data.Raw Plan Date': labelRegex }
    ];
  });

  const normalizedClauses = [
    rangeQuery('Plan Date', startDate, endDate, ['planDate', 'Date', 'date']),
    rangeQuery('actualDate', startDate, endDate, ['Done Date', 'doneDate'])
  ].filter((clause) => clause && Object.keys(clause).length);

  const orClauses = [...normalizedClauses, ...rawPlanDateClauses];
  return orClauses.length ? { $or: orClauses } : {};
}

async function queryRows(modelName, query = {}, projection = { data: 1, legacyId: 1 }) {
  const docs = await LegacyModels[modelName]
    .find(query)
    .select(projection)
    .lean();
  return rowsFromDocs(docs);
}

async function getUsersAndClients(version) {
  const [users, clients] = await Promise.all([
    getCached('users', [version], () => queryRows('User', {}, projectionFromFields(USER_FIELDS))),
    getCached('clients', [version], () => queryRows('Client', {}, projectionFromFields(CLIENT_FIELDS)))
  ]);
  return { users, clients };
}

async function getScopedCollections(version, startDate, endDate) {
  const attendanceToday = today();
  const attendanceDates = enumerateDates(startDate, endDate);
  const attendanceQuery = attendanceDates.length
    ? {
        $or: attendanceDates.map((date) => ({
          'data.Date': { $regex: `^${date}` }
        }))
      }
    : {};

  const [tickets, fms, todos, attendance, leaves, intimations, invoices] = await Promise.all([
    getCached('tickets', [version, startDate, endDate], () => queryRows('Ticket', rangeQuery('Plan Date', startDate, endDate, ['Date']), projectionFromFields(TICKET_FIELDS))),
    getCached('fms', [version, startDate, endDate], () => queryRows('FmsTask', fmsRangeQuery(startDate, endDate), projectionFromFields(FMS_FIELDS))),
    getCached('todos', [version, startDate, endDate], () => queryRows('Todo', rangeQuery('Due Date', startDate, endDate, ['Date']), projectionFromFields(TODO_FIELDS))),
    getCached('attendance', [version, startDate, endDate], () => queryRows('Attendance', attendanceQuery, projectionFromFields(ATTENDANCE_FIELDS))),
    Promise.resolve([]),
    Promise.resolve([]),
    getCached('invoices', [version], () => queryRows('Invoice', {}, projectionFromFields(INVOICE_FIELDS)))
  ]);

  const attendanceTodayRows = startDate && endDate
    ? attendance.filter((row) => normalizedDate(row.Date) === attendanceToday)
    : await getCached('attendance-today', [version, attendanceToday], () => queryRows('Attendance', { 'data.Date': attendanceToday }, projectionFromFields(ATTENDANCE_FIELDS)));

  return { tickets, fms, todos, attendance, attendanceTodayRows, leaves, intimations, invoices };
}

function sortByDateDesc(rows = []) {
  return [...rows].sort((left, right) => String(right.Date || '').localeCompare(String(left.Date || '')));
}

function buildStatusChart(rows = []) {
  const counts = new Map();
  rows.forEach((row) => {
    const status = first(row, ['Status'], 'Unknown');
    counts.set(status, (counts.get(status) || 0) + 1);
  });
  return Array.from(counts.entries()).map(([name, value]) => ({ name, value }));
}

function buildUserWorkload(tickets = [], fms = [], todo = []) {
  const counts = new Map();
  [...tickets, ...fms, ...todo].forEach((row) => {
    if (isClosedStatus(row.Status)) return;
    const owner = first(row, ['User', 'Employee Name', 'Who', 'Assigned To'], 'Unassigned');
    counts.set(owner, (counts.get(owner) || 0) + 1);
  });
  return Array.from(counts.entries())
    .map(([name, activeTasks]) => ({ name, activeTasks }))
    .sort((left, right) => right.activeTasks - left.activeTasks)
    .slice(0, 8);
}

async function getOverviewScopedCollections(version, startDate, endDate) {
  const attendanceToday = today();
  const [tickets, fms, todos, attendanceTodayRows, invoices] = await Promise.all([
    getCached('overview-tickets', [version, startDate, endDate], () => queryRows('Ticket', rangeQuery('Plan Date', startDate, endDate, ['Date']), projectionFromFields(OVERVIEW_TICKET_FIELDS))),
    getCached('overview-fms', [version, startDate, endDate], () => queryRows('FmsTask', fmsRangeQuery(startDate, endDate), projectionFromFields(OVERVIEW_FMS_FIELDS))),
    getCached('overview-todos', [version, startDate, endDate], () => queryRows('Todo', rangeQuery('Due Date', startDate, endDate, ['Date']), projectionFromFields(OVERVIEW_TODO_FIELDS))),
    getCached('attendance-today', [version, attendanceToday], () => queryRows('Attendance', { 'data.Date': attendanceToday }, projectionFromFields(ATTENDANCE_FIELDS))),
    getCached('overview-invoices', [version], () => queryRows('Invoice', {}, projectionFromFields(['Outstanding', 'Balance', 'Due Amount'])))
  ]);
  return { tickets, fms, todos, attendanceTodayRows, invoices };
}

function employeeScopedQuery(employeeId = '') {
  const value = safe(employeeId);
  if (!value) return { legacyId: '__no_match__' };
  return {
    $or: [
      { 'data.Employee ID': value },
      { 'data.EmpID': value },
      { 'data.empId': value },
      { 'data.User ID': value },
      { 'data.employeeId': value }
    ]
  };
}

function clientScopedQuery(clientId = '') {
  const value = safe(clientId);
  if (!value) return { legacyId: '__no_match__' };
  return {
    $or: [
      { 'data.Client_Id': value },
      { 'data.Client ID': value },
      { 'data.CustomerID': value }
    ]
  };
}

function combineQueries(...clauses) {
  const filtered = clauses.filter((clause) => clause && Object.keys(clause).length);
  if (!filtered.length) return {};
  if (filtered.length === 1) return filtered[0];
  return { $and: filtered };
}

function buildBandwidth(rows = []) {
  const bandwidthMap = new Map();
  rows.forEach((row) => {
    const owner = row.User || row['Employee Name'] || row['Employee ID'] || 'Unassigned';
    const current = bandwidthMap.get(owner) || { owner, count: 0, tat: 0 };
    current.count += 1;
    current.tat += Number(row.TAT || 0);
    bandwidthMap.set(owner, current);
  });
  return Array.from(bandwidthMap.values());
}

async function buildUserExplorerPayload(version, startDate, endDate, selectedUserId) {
  const { users } = await getUsersAndClients(version);
  const activeUsers = users.filter((user) => eq(user.Status || user.status || 'Active', 'Active'));
  const selectedUser = activeUsers.find((user) => eq(user['Employee ID'] || user.id, selectedUserId)) || activeUsers[0] || null;
  if (!selectedUser) {
    return ok({ data: { users: [], attendance: [], tickets: [], fms: [], todo: [] } });
  }

  const selectedId = first(selectedUser, ['Employee ID', 'id']);
  const [attendance, ticketRows, fmsRows, todoRows] = await Promise.all([
    queryRows('Attendance', combineQueries(
      employeeScopedQuery(selectedId),
      {
        $or: enumerateDates(startDate, endDate).map((date) => ({ 'data.Date': { $regex: `^${date}` } }))
      }
    ), projectionFromFields(ATTENDANCE_FIELDS)),
    queryRows('Ticket', combineQueries(
      employeeScopedQuery(selectedId),
      rangeQuery('Plan Date', startDate, endDate, ['Date'])
    ), projectionFromFields(TICKET_FIELDS)),
    queryRows('FmsTask', combineQueries(
      employeeScopedQuery(selectedId),
      fmsRangeQuery(startDate, endDate)
    ), projectionFromFields(FMS_FIELDS)),
    queryRows('Todo', combineQueries(
      employeeScopedQuery(selectedId),
      rangeQuery('Due Date', startDate, endDate, ['Date'])
    ), projectionFromFields(TODO_FIELDS))
  ]);

  const tickets = ticketRows
    .map((ticket) => normalizeTicketForDashboard(ticket, activeUsers))
    .filter((ticket) => dateInRange(ticket.Date, startDate, endDate));
  const fms = fmsRows
    .map((task) => normalizeFmsForDashboard(task, activeUsers))
    .filter((task) => dateInRange(task.Date, startDate, endDate));
  const todo = todoRows
    .map((task) => normalizeTodoForDashboard(task, activeUsers))
    .filter((task) => dateInRange(task.Date, startDate, endDate));

  return ok({
    data: {
      users: activeUsers,
      attendance,
      tickets,
      fms,
      todo,
      kpis: {},
      clients: [],
      invoices: []
    }
  });
}

async function buildClientExplorerPayload(version, startDate, endDate, selectedClientId) {
  const { users, clients } = await getUsersAndClients(version);
  const activeUsers = users.filter((user) => eq(user.Status || user.status || 'Active', 'Active'));
  const activeClients = clients.filter((client) => !eq(client.Status || client.status || 'Active', 'Inactive'));
  const selectedClient = activeClients.find((client) => eq(client.Client_Id || client.id, selectedClientId)) || activeClients[0] || null;
  if (!selectedClient) {
    return ok({ data: { users: [], clients: [], tickets: [], fms: [], todo: [], invoices: [] } });
  }

  const selectedId = first(selectedClient, ['Client_Id', 'id']);
  const [ticketRows, fmsRows, invoices] = await Promise.all([
    queryRows('Ticket', combineQueries(
      clientScopedQuery(selectedId),
      rangeQuery('Plan Date', startDate, endDate, ['Date'])
    ), projectionFromFields(TICKET_FIELDS)),
    queryRows('FmsTask', combineQueries(
      clientScopedQuery(selectedId),
      fmsRangeQuery(startDate, endDate)
    ), projectionFromFields(FMS_FIELDS)),
    queryRows('Invoice', clientScopedQuery(selectedId), projectionFromFields(INVOICE_FIELDS))
  ]);

  const tickets = ticketRows
    .map((ticket) => normalizeTicketForDashboard(ticket, activeUsers))
    .filter((ticket) => dateInRange(ticket.Date, startDate, endDate));
  const fms = fmsRows
    .map((task) => normalizeFmsForDashboard(task, activeUsers))
    .filter((task) => dateInRange(task.Date, startDate, endDate));
  const tasks = [...tickets, ...fms];

  return ok({
    data: {
      users: activeUsers,
      clients: activeClients,
      tickets,
      fms,
      todo: [],
      attendance: [],
      invoices,
      explorer: {
        tasks,
        bandwidth: buildBandwidth(tasks),
        invoices
      },
      kpis: {}
    }
  });
}

async function buildManagementOverviewPayload(version, startDate, endDate) {
  const [{ users, clients }, scoped] = await Promise.all([
    getUsersAndClients(version),
    getOverviewScopedCollections(version, startDate, endDate)
  ]);

  const activeUsers = users.filter((user) => eq(user.Status || user.status || 'Active', 'Active'));
  const activeClients = clients.filter((client) => !eq(client.Status || client.status || 'Active', 'Inactive'));
  const tickets = scoped.tickets
    .map((ticket) => normalizeTicketForDashboard(ticket, users, clients))
    .filter((ticket) => dateInRange(ticket.Date, startDate, endDate));
  const fms = scoped.fms
    .map((task) => normalizeFmsForDashboard(task, users, clients))
    .filter((task) => dateInRange(task.Date, startDate, endDate));
  const todo = scoped.todos
    .map((task) => normalizeTodoForDashboard(task, users))
    .filter((task) => dateInRange(task.Date, startDate, endDate));
  const allTasks = [...tickets, ...fms, ...todo];

  const checkedIn = new Set(
    scoped.attendanceTodayRows
      .filter((attendance) => /in|present/i.test(safe(attendance.Action || attendance.Status)))
      .map((attendance) => attendance.EmpID || attendance['Employee ID'])
      .filter(Boolean)
  );

  const outstanding = scoped.invoices.reduce((sum, invoice) => sum + num(first(invoice, ['Outstanding', 'Balance', 'Due Amount'])), 0);
  const completed = allTasks.filter((task) => isClosedStatus(task.Status)).length;
  const plannedMinutes = allTasks.reduce((sum, task) => sum + num(task.TAT), 0);

  return ok({
    data: {
      activeUsers: activeUsers.map((user) => ({ id: user['Employee ID'], name: user['Employee Name'], role: user.Role })),
      activeClients: activeClients.map((client) => ({ id: client.Client_Id, name: client['Client Name'] })),
      users: activeUsers,
      clients: activeClients,
      tickets: sortByDateDesc(tickets).slice(0, 8),
      fms: sortByDateDesc(fms).slice(0, 8),
      todo: sortByDateDesc(todo).slice(0, 10),
      attendance: [],
      leaves: [],
      intimations: [],
      invoices: [],
      charts: {
        ticketData: buildStatusChart(tickets),
        fmsData: buildStatusChart(fms),
        userWorkload: buildUserWorkload(tickets, fms, todo)
      },
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

export async function getManagementDashboardData(startDate, endDate, scope = 'full', options = {}) {
  const version = await getDashboardVersion();
  if (scope === 'overview') {
    return getCached('payload-overview', [version, startDate, endDate], async () => buildManagementOverviewPayload(version, startDate, endDate));
  }
  if (scope === 'user-explorer') {
    return getCached('payload-user-explorer', [version, startDate, endDate, options.selectedUserId], async () =>
      buildUserExplorerPayload(version, startDate, endDate, options.selectedUserId)
    );
  }
  if (scope === 'client-explorer') {
    return getCached('payload-client-explorer', [version, startDate, endDate, options.selectedClientId], async () =>
      buildClientExplorerPayload(version, startDate, endDate, options.selectedClientId)
    );
  }

  return getCached('payload', [version, startDate, endDate], async () => {
    const [{ users, clients }, scoped] = await Promise.all([
      getUsersAndClients(version),
      getScopedCollections(version, startDate, endDate)
    ]);

    const activeUsers = users.filter((user) => eq(user.Status || user.status || 'Active', 'Active'));
    const activeClients = clients.filter((client) => !eq(client.Status || client.status || 'Active', 'Inactive'));
    const tickets = scoped.tickets
      .map((ticket) => normalizeTicketForDashboard(ticket, users, clients))
      .filter((ticket) => dateInRange(ticket.Date, startDate, endDate));
    const fms = scoped.fms
      .map((task) => normalizeFmsForDashboard(task, users, clients))
      .filter((task) => dateInRange(task.Date, startDate, endDate));
    const todo = scoped.todos
      .map((task) => normalizeTodoForDashboard(task, users))
      .filter((task) => dateInRange(task.Date, startDate, endDate));
    const allTasks = [...tickets, ...fms, ...todo];

    const checkedIn = new Set(
      scoped.attendanceTodayRows
        .filter((attendance) => /in|present/i.test(safe(attendance.Action || attendance.Status)))
        .map((attendance) => attendance.EmpID || attendance['Employee ID'])
        .filter(Boolean)
    );

    const outstanding = scoped.invoices.reduce((sum, invoice) => sum + num(first(invoice, ['Outstanding', 'Balance', 'Due Amount'])), 0);
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
        attendance: scoped.attendance,
        leaves: scoped.leaves,
        intimations: scoped.intimations,
        invoices: scoped.invoices,
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
