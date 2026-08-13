import XLSX from 'xlsx';
import PDFDocument from 'pdfkit-table';
import { LegacyModels } from '../models/legacyModels.js';
import { listRows, registerStoreMutationListener } from './legacyStore.service.js';
import { buildRedisKey, getJson, setJson } from './redisCache.service.js';

const closedTerms = ['closed', 'approved', 'cancelled', 'completed', 'done', 'resolved', 'paid'];
const safe = (value = '') => String(value ?? '').trim();
const eq = (left, right) => safe(left).toLowerCase() === safe(right).toLowerCase();
const first = (row, keys, fallback = '') => keys.map((key) => row?.[key]).find((value) => safe(value)) ?? fallback;
const ok = (payload = {}) => ({ success: true, ...payload });
const isClosedStatus = (status = '') => closedTerms.some((term) => safe(status).toLowerCase().includes(term));
const csvEscape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
const cleanFileName = (value, fallback = 'report') =>
  String(value || fallback).replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, '_');
const normalizedContains = (value, query) => safe(value).toLowerCase().includes(safe(query).toLowerCase());

const REPORT_CACHE_TTL_MS = Number(process.env.WORKTRACK_REPORT_CACHE_TTL_MS || 120_000);
const reportMemoryCache = new Map();
const reportInflight = new Map();
const REPORT_VERSION_KEY = buildRedisKey('reports', 'version');
const REPORT_CACHE_PREFIX = 'reports-cache';
const reportRelevantModels = new Set([
  'Ticket',
  'FmsTask',
  'Attendance',
  'Expense',
  'Todo',
  'Leave',
  'Intimation',
  'User',
  'Client',
  'FormsPortal'
]);
let localReportVersion = Date.now();

function parseReferenceNow(value) {
  if (!value) return new Date();
  if (String(value).includes('T')) return new Date(value);
  return new Date(`${value}T12:00:00+05:30`);
}

const referenceNow = () => parseReferenceNow(process.env.WORKTRACK_REFERENCE_DATE);

function reportCacheKey(scope, parts = []) {
  return [scope, ...parts.map((part) => safe(part).toLowerCase()).filter(Boolean)].join(':');
}

async function getCachedReport(scope, parts, loader) {
  const key = reportCacheKey(scope, parts);
  const memoryEntry = reportMemoryCache.get(key);
  if (memoryEntry && memoryEntry.expiresAt > Date.now()) {
    return memoryEntry.value;
  }

  if (reportInflight.has(key)) {
    return reportInflight.get(key);
  }

  const promise = (async () => {
    const redisKey = buildRedisKey(REPORT_CACHE_PREFIX, key);
    const redisValue = await getJson(redisKey).catch(() => null);
    if (redisValue) {
      reportMemoryCache.set(key, { value: redisValue, expiresAt: Date.now() + REPORT_CACHE_TTL_MS });
      return redisValue;
    }

    const value = await loader();
    reportMemoryCache.set(key, { value, expiresAt: Date.now() + REPORT_CACHE_TTL_MS });
    void setJson(redisKey, value, REPORT_CACHE_TTL_MS);
    return value;
  })().finally(() => {
    reportInflight.delete(key);
  });

  reportInflight.set(key, promise);
  return promise;
}

function clearReportCache() {
  reportMemoryCache.clear();
  reportInflight.clear();
  localReportVersion = Date.now();
}

registerStoreMutationListener((modelName) => {
  if (modelName && !reportRelevantModels.has(modelName)) return;
  clearReportCache();
  void setJson(REPORT_VERSION_KEY, { version: localReportVersion }, 0);
});

async function getReportVersion() {
  const cached = await getJson(REPORT_VERSION_KEY).catch(() => null);
  if (cached?.version) {
    localReportVersion = Number(cached.version) || localReportVersion;
    return String(localReportVersion);
  }
  void setJson(REPORT_VERSION_KEY, { version: localReportVersion }, 0);
  return String(localReportVersion);
}

function normalizedDate(value) {
  if (!value) return '';
  const raw = safe(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const dmy = raw.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (dmy) return `${dmy[3]}-${String(dmy[2]).padStart(2, '0')}-${String(dmy[1]).padStart(2, '0')}`;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? raw : parsed.toISOString().slice(0, 10);
}

function dateInRange(value, start, end) {
  if (!start || !end || !value) return true;
  const d = normalizedDate(value);
  return d >= start && d <= end;
}

function splitIds(value) {
  return safe(value)
    .split(/[,;|]/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function buildUserNameIndex(users = []) {
  const index = new Map();

  users.forEach((user) => {
    const id = safe(first(user, ['Employee ID', 'User ID', 'EMP Code', 'employeeId', 'EmpID'])).toLowerCase();
    const name = safe(first(user, ['Employee Name', 'Name', 'Full Name', 'name'], id));
    if (id) {
      index.set(id, name || id);
    }

    const aliases = [
      first(user, ['Employee Name', 'Name', 'Full Name', 'name']),
      first(user, ['Employee ID', 'User ID', 'EMP Code', 'employeeId', 'EmpID'])
    ]
      .map((value) => safe(value).toLowerCase())
      .filter(Boolean);

    aliases.forEach((alias) => {
      if (!index.has(alias)) {
        index.set(alias, name || id || alias);
      }
    });
  });

  return index;
}

function resolveUserName(value, userIndex, fallback = '') {
  const raw = safe(value);
  if (!raw) return fallback;
  return userIndex.get(raw.toLowerCase()) || fallback || raw;
}

function teamMemberIds(users, managerId, { preserveCase = false } = {}) {
  const target = safe(managerId).toLowerCase();
  return users
    .filter((user) => {
      const managers = splitIds(first(user, ['Manager ID', 'Manager', 'managerId', 'Reporting Manager']));
      const approvers = splitIds(first(user, ['Task Approver', 'Approver ID', 'taskApprover']));
      return managers.includes(target) || approvers.includes(target);
    })
    .map((user) => {
      const value = first(user, ['Employee ID', 'User ID', 'employeeId']);
      return preserveCase ? safe(value) : safe(value).toLowerCase();
    })
    .filter(Boolean);
}

function matchesTicketFilters(ticket = {}, filters = {}) {
  const priority = safe(filters.priority);
  const category = safe(filters.category);
  const status = safe(filters.status);
  const search = safe(filters.search).toLowerCase();
  if (priority && !eq(ticket.Priority, priority)) return false;
  if (category && !eq(ticket['Task Category'] || ticket.Category, category)) return false;
  if (status && !eq(ticket.Status, status)) return false;
  if (!search) return true;
  return [
    ticket['Ticket ID'],
    ticket.Name,
    ticket['Client Name'],
    ticket.Client,
    ticket['Employee Name'],
    ticket.User,
    ticket['Task Description'],
    ticket.Description,
    ticket.Priority,
    ticket.Status,
    ticket['Task Category'],
    ticket.Category
  ].some((value) => normalizedContains(value, search));
}

function matchesFmsFilters(task = {}, filters = {}) {
  const status = safe(filters.status);
  const search = safe(filters.search).toLowerCase();
  if (status && !eq(task.Status, status)) return false;
  if (!search) return true;
  return [
    task['FMS Name'],
    task.Name,
    task['Task Name'],
    task['Task Description'],
    task.Description,
    task.Who,
    task['Assigned To'],
    task.Status
  ].some((value) => normalizedContains(value, search));
}

async function buildTabularPdf(title, headers, sourceRows) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 30, size: 'A4', layout: 'landscape' });
      const buffers = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        resolve(Buffer.concat(buffers));
      });
      doc.on('error', reject);

      doc.fontSize(16).text(String(title || 'Report'), { align: 'center' });
      doc.fontSize(10).text(`Generated: ${referenceNow().toLocaleString('en-IN')}`, { align: 'center' });
      doc.moveDown();

      const safeHeaders = headers.slice(0, 15);
      const tableRows = sourceRows.map((row) => safeHeaders.map((header) => String(row[header] ?? '')));

      doc.table(
        {
          headers: safeHeaders,
          rows: tableRows
        },
        {
          prepareHeader: () => doc.font('Helvetica-Bold').fontSize(8),
          prepareRow: () => {
            doc.font('Helvetica').fontSize(8);
          }
        }
      );

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

function asTicketRow(row = {}, clients = []) {
  const ticketId = first(row, ['Ticket ID', 'Task ID', 'ID', 'ticketId', 'taskId']);
  const clientId = first(row, ['Client_Id', 'Client ID', 'CustomerID', 'clientId']);
  const clientFromMaster = clients.find((item) => eq(item.Client_Id || item['Client ID'], clientId))?.['Client Name'] || '';
  const client = first(row, ['Name', 'Client Name', 'Client', 'clientName'], clientFromMaster);
  const employeeId = first(row, ['Employee ID', 'EmpID', 'employeeId']);
  const employeeName = first(row, ['Employee Name', 'User', 'employeeName'], employeeId);
  const description = first(row, ['Task Description', 'Description', 'description']);
  const planDate = first(row, ['Plan Date', 'Date', 'planDate', 'timestamp']);
  const timestamp = first(row, ['Timestamp', 'timestamp', 'Created At', 'Date'], planDate);
  const totalDuration = first(row, ['Total Duration', 'Duration', 'totalDuration', 'duration']);
  return {
    ...row,
    'Ticket ID': ticketId,
    ID: first(row, ['ID', 'Ticket ID', 'ticketId'], ticketId),
    Client_Id: clientId,
    'Client ID': first(row, ['Client ID', 'Client_Id', 'clientId'], clientId),
    Client: client,
    Name: client,
    'Client Name': client,
    'Employee ID': employeeId,
    EmpID: employeeId,
    'Employee Name': employeeName,
    User: employeeName,
    'Task Category': first(row, ['Task Category', 'Category', 'category'], 'General'),
    Category: first(row, ['Category', 'Task Category', 'category'], 'General'),
    Priority: first(row, ['Priority', 'priority'], 'Normal'),
    'Task Description': description,
    Description: description,
    Status: first(row, ['Status', 'status'], 'Open'),
    Timestamp: timestamp,
    Date: first(row, ['Date', 'Plan Date', 'planDate', 'timestamp'], planDate),
    'Plan Date': planDate,
    'Last Update Date': first(row, ['Last Update Date', 'lastUpdateDate', 'Timestamp', 'timestamp'], timestamp),
    'Start Time': first(row, ['Start Time', 'startTime']),
    'End Time': first(row, ['End Time', 'endTime']),
    'Total Duration': totalDuration,
    Duration: totalDuration,
    Remarks: first(row, ['Remarks', 'remarks']),
    TAT: first(row, ['TAT', 'When', 'tatMinutes']),
    When: first(row, ['When', 'TAT', 'tatMinutes']),
    'Task Approver': first(row, ['Task Approver', 'taskApprover', 'Approver ID'])
  };
}

function asFmsRow(row = {}, userIndex = new Map()) {
  const id = first(row, ['Task ID', 'FMS ID', 'ID', 'rowId', 'taskId']);
  const employeeId = first(row, ['Employee ID', 'EmpID', 'empId', 'employeeId']);
  const employeeName = resolveUserName(
    first(row, ['Employee Name', 'User', 'who', 'employeeName', 'Who', 'Assigned To'], employeeId),
    userIndex,
    employeeId
  );
  const clientId = first(row, ['Client_Id', 'Client ID', 'clientId']);
  const client = first(row, ['Client', 'Client Name', 'fmsName', 'clientName']);
  const description = first(row, ['Task Description', 'Description', 'Task Name', 'taskName', 'description']);
  const planDate = first(row, ['Plan Date', 'Date', 'planDate']);
  const doneDate = first(row, ['Done Date', 'actualDate', 'doneDate']);
  return {
    ...row,
    'Task ID': id,
    ID: id,
    rowId: id,
    Client_Id: clientId,
    Client: client,
    'Client Name': client,
    'Employee ID': employeeId,
    EmpID: employeeId,
    empId: employeeId,
    'Employee Name': employeeName,
    User: employeeName,
    who: employeeName,
    What: first(row, ['what', 'What'], ''),
    When: first(row, ['when', 'When'], ''),
    How: first(row, ['how', 'How'], ''),
    'FMS Name': client,
    fmsName: client,
    'Task Description': description,
    Description: description,
    'Task Name': description,
    taskName: description,
    stepNo: first(row, ['stepNo', 'Step', 'Step No'], ''),
    'Plan Date': planDate,
    Date: planDate,
    planDate,
    Status: first(row, ['Status', 'status'], doneDate ? 'Completed' : 'Pending'),
    'Actual Date': doneDate,
    'Done Date': doneDate,
    actualDate: doneDate,
    Who: employeeName,
    'Assigned To': employeeName,
    formLink: first(row, ['formLink', 'Form Link', 'Form link'], ''),
    TAT: first(row, ['TAT', 'When', 'tatMinutes'], ''),
    delayDays: first(row, ['delayDays', 'Delay Days'], ''),
    onTimeStatus: first(row, ['onTimeStatus', 'On Time Status'], '')
  };
}

async function loadRows() {
  const [tickets, fms, attendance, expenses, todos, leaves, intimations, users, clients, forms] = await Promise.all([
    listRows('Ticket'),
    listRows('FmsTask'),
    listRows('Attendance'),
    listRows('Expense'),
    listRows('Todo'),
    listRows('Leave'),
    listRows('Intimation'),
    listRows('User'),
    listRows('Client'),
    listRows('FormsPortal')
  ]);
  return { tickets, fms, attendance, expenses, todos, leaves, intimations, users, clients, forms };
}

async function loadTicketRows() {
  const [tickets, users, clients] = await Promise.all([
    listRows('Ticket'),
    listRows('User'),
    listRows('Client')
  ]);
  return { tickets, users, clients };
}

async function loadFmsRows() {
  const [fms, users] = await Promise.all([
    listRows('FmsTask'),
    listRows('User')
  ]);
  return { fms, users };
}

function dateClause(field = '', startDate = '', endDate = '') {
  if (!startDate || !endDate || !field) return null;
  return {
    [`data.${field}`]: {
      $gte: startDate,
      $lte: endDate
    }
  };
}

function ownerClause(field = '', ownerIds = []) {
  if (!ownerIds.length || !field) return null;
  return {
    [`data.${field}`]: { $in: ownerIds }
  };
}

async function queryLegacyRows(modelName, { startDate = '', endDate = '', dateField = '', ownerIds = [], ownerField = 'Employee ID' } = {}) {
  const clauses = [];
  const dateFilter = dateClause(dateField, startDate, endDate);
  if (dateFilter) clauses.push(dateFilter);
  const ownersFilter = ownerClause(ownerField, ownerIds);
  if (ownersFilter) clauses.push(ownersFilter);

  const query = clauses.length ? { $and: clauses } : {};
  const docs = await LegacyModels[modelName]
    .find(query)
    .select({ data: 1, legacyId: 1 })
    .lean();

  return docs.map((doc) => ({
    ...(doc?.data || {}),
    _id: String(doc?._id || ''),
    _legacyId: doc?.legacyId || ''
  }));
}

async function getRows(version) {
  return getCachedReport('collections', [version], loadRows);
}

export async function getTicketReportData(employeeId, role, startDate, endDate) {
  const version = await getReportVersion();
  return getCachedReport('tickets', [version, employeeId, role, startDate, endDate], async () => {
    const [users, clients] = await Promise.all([
      getCachedReport('users-source', [version], () => listRows('User')),
      getCachedReport('clients-source', [version], () => listRows('Client'))
    ]);
    const normalizedRole = safe(role).toLowerCase();
    const canSeeAll = normalizedRole === 'super admin';
    const teamIds = canSeeAll ? [] : teamMemberIds(users, employeeId);
    const teamIdsRaw = canSeeAll ? [] : teamMemberIds(users, employeeId, { preserveCase: true });
    const ownerIds = canSeeAll
      ? []
      : Array.from(
          new Set([
            safe(employeeId),
            ...(['admin', 'manager', 'hr'].includes(normalizedRole) ? teamIdsRaw : [])
          ].filter(Boolean))
        );
    const tickets = await getCachedReport(
      'ticket-source',
      [version, startDate, endDate, canSeeAll ? 'all' : ownerIds.join('|')],
      () => queryLegacyRows('Ticket', { startDate, endDate, dateField: 'Plan Date', ownerIds, ownerField: 'Employee ID' })
    );
    const items = tickets
      .filter((ticket) => {
        const ownerId = first(ticket, ['Employee ID', 'EmpID', 'employeeId']).toLowerCase();
        const visible = canSeeAll || ownerId === safe(employeeId).toLowerCase() || (['admin', 'manager', 'hr'].includes(normalizedRole) && teamIds.includes(ownerId));
        return visible && dateInRange(first(ticket, ['Plan Date', 'Date', 'Timestamp', 'Close Date']), startDate, endDate);
      })
      .map((ticket) => asTicketRow(ticket, clients));
    return ok({
      data: items,
      summary: {
        total: items.length,
        open: items.filter((item) => !isClosedStatus(item.Status)).length,
        closed: items.filter((item) => isClosedStatus(item.Status)).length
      }
    });
  });
}

export async function getFmsReportData(employeeId, role, startDate, endDate) {
  const version = await getReportVersion();
  return getCachedReport('fms', [version, employeeId, role, startDate, endDate], async () => {
    const users = await getCachedReport('users-source', [version], () => listRows('User'));
    const userIndex = buildUserNameIndex(users);
    const normalizedRole = safe(role).toLowerCase();
    const canSeeAll = ['super admin', 'hr'].includes(normalizedRole);
    const teamIds = canSeeAll ? [] : teamMemberIds(users, employeeId);
    const teamIdsRaw = canSeeAll ? [] : teamMemberIds(users, employeeId, { preserveCase: true });
    const ownerIds = canSeeAll
      ? []
      : Array.from(
          new Set([
            safe(employeeId),
            ...(['admin', 'manager'].includes(normalizedRole) ? teamIdsRaw : [])
          ].filter(Boolean))
        );
    const fmsRows = await getCachedReport(
      'fms-source',
      [version, startDate, endDate, canSeeAll ? 'all' : ownerIds.join('|')],
      () => queryLegacyRows('FmsTask', { startDate, endDate, dateField: 'Plan Date', ownerIds, ownerField: 'Employee ID' })
    );
    const items = fmsRows
      .filter((task) => {
        const ownerId = safe(first(task, ['Employee ID', 'EmpID', 'empId'])).toLowerCase();
        const visible = canSeeAll || ownerId === safe(employeeId).toLowerCase() || (['admin', 'manager'].includes(normalizedRole) && teamIds.includes(ownerId));
        return visible && dateInRange(first(task, ['Plan Date', 'Date']), startDate, endDate);
      })
      .map((task) => asFmsRow(task, userIndex));
    return ok({
      data: items,
      summary: {
        total: items.length,
        completed: items.filter((item) => isClosedStatus(item.Status)).length
      }
    });
  });
}

export async function exportReportForWeb(format = 'csv', sheetName = 'Report', employeeId = '', role = '', startDate = '', endDate = '', filters = {}) {
  const version = await getReportVersion();
  return getCachedReport('export', [version, format, sheetName, employeeId, role, startDate, endDate, JSON.stringify(filters || {})], async () => {
    const data = await getRows(version);
    const userIndex = buildUserNameIndex(data.users);
    const normalizedRole = safe(role).toLowerCase();
    const ticketTeamIds = teamMemberIds(data.users, employeeId);
    const fmsTeamIds = teamMemberIds(data.users, employeeId);
    const canSeeAllTickets = normalizedRole === 'super admin';
    const canSeeAllFms = ['super admin', 'hr'].includes(normalizedRole);

    const tickets = data.tickets
      .filter((ticket) => {
        const ownerId = safe(first(ticket, ['Employee ID', 'EmpID', 'employeeId'])).toLowerCase();
        const visible =
          canSeeAllTickets ||
          ownerId === safe(employeeId).toLowerCase() ||
          (['admin', 'manager', 'hr'].includes(normalizedRole) && ticketTeamIds.includes(ownerId));
        return visible && dateInRange(first(ticket, ['Plan Date', 'Date', 'Timestamp']), startDate, endDate);
      })
      .map((ticket) => asTicketRow(ticket, data.clients))
      .filter((ticket) => matchesTicketFilters(ticket, filters));

    const fms = data.fms
      .filter((task) => {
        const ownerId = safe(first(task, ['Employee ID', 'EmpID', 'empId'])).toLowerCase();
        const visible =
          canSeeAllFms ||
          ownerId === safe(employeeId).toLowerCase() ||
          (['admin', 'manager'].includes(normalizedRole) && fmsTeamIds.includes(ownerId));
        return visible && dateInRange(first(task, ['Plan Date', 'Date']), startDate, endDate);
      })
      .map((task) => asFmsRow(task, userIndex))
      .filter((task) => matchesFmsFilters(task, filters));

    const sheetKey = safe(sheetName).toLowerCase();
    const source =
      /ticket/.test(sheetKey) ? tickets :
      /fms/.test(sheetKey) ? fms :
      /attendance/.test(sheetKey) ? data.attendance :
      /expense/.test(sheetKey) ? data.expenses :
      /todo|to-do|to do/.test(sheetKey) ? data.todos :
      /leave/.test(sheetKey) ? data.leaves :
      /intimation/.test(sheetKey) ? data.intimations :
      /user|employee/.test(sheetKey) ? data.users :
      /client/.test(sheetKey) ? data.clients :
      /form/.test(sheetKey) ? data.forms :
      tickets;
    const headers = [...new Set(source.flatMap((row) => Object.keys(row)))];
    const normalizedFormat = safe(format).toLowerCase();
    const fileBase = cleanFileName(sheetName, 'report');

    if (normalizedFormat === 'xlsx') {
      const worksheet = XLSX.utils.json_to_sheet(source, { header: headers });
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, fileBase.slice(0, 31) || 'Report');
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      return ok({
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        fileName: `${fileBase}.xlsx`,
        base64Data: buffer.toString('base64')
      });
    }

    if (normalizedFormat === 'pdf') {
      const buffer = await buildTabularPdf(String(sheetName || 'Report'), headers, source);
      return ok({
        mimeType: 'application/pdf',
        fileName: `${fileBase}.pdf`,
        base64Data: buffer.toString('base64')
      });
    }

    const csv = [headers.map(csvEscape).join(','), ...source.map((row) => headers.map((header) => csvEscape(row[header])).join(','))].join('\n');
    return ok({ mimeType: 'text/csv', fileName: `${fileBase}.csv`, base64Data: Buffer.from(csv).toString('base64') });
  });
}
