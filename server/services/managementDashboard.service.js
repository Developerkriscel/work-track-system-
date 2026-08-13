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

function clearManagementDashboardCache() {
  memoryCache.clear();
  inflightCache.clear();
  localDashboardVersion = Date.now();
}

registerStoreMutationListener((modelName) => {
  if (modelName && !managementRelevantModels.has(modelName)) return;
  clearManagementDashboardCache();
  void setJson(MANAGEMENT_VERSION_KEY, { version: localDashboardVersion }, 0);
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

async function queryRows(modelName, query = {}) {
  const docs = await LegacyModels[modelName]
    .find(query)
    .select({ data: 1, legacyId: 1 })
    .lean();
  return rowsFromDocs(docs);
}

async function getUsersAndClients(version) {
  const [users, clients] = await Promise.all([
    getCached('users', [version], () => queryRows('User')),
    getCached('clients', [version], () => queryRows('Client'))
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
    getCached('tickets', [version, startDate, endDate], () => queryRows('Ticket', rangeQuery('Plan Date', startDate, endDate, ['Date']))),
    getCached('fms', [version], () => queryRows('FmsTask')),
    getCached('todos', [version, startDate, endDate], () => queryRows('Todo', rangeQuery('Due Date', startDate, endDate, ['Date']))),
    getCached('attendance', [version, startDate, endDate], () => queryRows('Attendance', attendanceQuery)),
    getCached('leaves', [version], () => queryRows('Leave')),
    getCached('intimations', [version], () => queryRows('Intimation')),
    getCached('invoices', [version], () => queryRows('Invoice'))
  ]);

  const attendanceTodayRows = startDate && endDate
    ? attendance.filter((row) => normalizedDate(row.Date) === attendanceToday)
    : await getCached('attendance-today', [version, attendanceToday], () => queryRows('Attendance', { 'data.Date': attendanceToday }));

  return { tickets, fms, todos, attendance, attendanceTodayRows, leaves, intimations, invoices };
}

export async function getManagementDashboardData(startDate, endDate) {
  const version = await getDashboardVersion();
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
