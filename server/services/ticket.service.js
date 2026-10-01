import { LegacyModels } from '../models/legacyModels.js';
import { buildRedisKey, getJson, setJson } from './redisCache.service.js';
import {
  findOneRowByFilter,
  findRowsByFilter,
  insertRow,
  listRows,
  registerStoreMutationListener,
  stripInternalMetadata,
  upsertRow,
  deleteRow
} from './legacyStore.service.js';
import { saveBase64File } from './fileStorage.service.js';

const safe = (value) => String(value ?? '').trim();
const eq = (left, right) => safe(left).toLowerCase() === safe(right).toLowerCase();
const first = (row, keys, fallback = '') => keys.map((key) => row?.[key]).find((value) => safe(value)) ?? fallback;
const num = (value) => Number(String(value ?? 0).replace(/[^0-9.-]/g, '')) || 0;
const ok = (payload = {}) => ({ success: true, ...payload });
const fail = (message) => ({ success: false, message });
const splitIds = (value) => safe(value).split(',').map((item) => item.trim().toLowerCase()).filter(Boolean);
const userId = (user = {}) => first(user, ['Employee ID', 'User ID', 'EMP Code', 'employeeId', 'EmpID']);
const userRole = (user = {}) => safe(first(user, ['Role', 'role', 'Designation'], 'User')).toLowerCase();
const TICKET_SUPPORT_CACHE_TTL_MS = Number(process.env.WORKTRACK_TICKET_SUPPORT_CACHE_TTL_MS || 60_000);
const TICKET_WORKSPACE_CACHE_TTL_MS = Number(process.env.WORKTRACK_TICKET_WORKSPACE_CACHE_TTL_MS || 15_000);
const TICKET_WORKSPACE_SCHEMA_VERSION = 3;
const TICKET_OWNER_CHUNK_SIZE = 100;
const ticketSupportCache = new Map();
const ticketWorkspaceCache = new Map();
const ticketSupportInflight = new Map();
const ticketWorkspaceInflight = new Map();
const ticketOwnerFieldCache = new Map();
const ticketRowsCache = new Map();
const ticketRowsInflight = new Map();
let ticketWorkspaceVersion = 0;

registerStoreMutationListener((modelName = '') => {
  if (['Ticket', 'Client', 'User', 'Leave', 'Intimation', 'EmpMaster', 'Message', 'Attendance', 'TicketHistory'].includes(modelName)) {
    ticketWorkspaceVersion += 1;
    ticketSupportCache.clear();
    ticketWorkspaceCache.clear();
    ticketOwnerFieldCache.clear();
    ticketRowsCache.clear();
  }
});

const ticketSupportClientProjection = {
  legacyId: 1,
  'data.Client_Id': 1,
  'data.Client ID': 1,
  'data.CustomerID': 1,
  'data.clientId': 1,
  'data.customerId': 1,
  'data.Client Name': 1,
  'data.CustomerName': 1,
  'data.Name': 1,
  'data.clientName': 1,
  'data.name': 1,
  'data.Services': 1
};

const ticketSupportUserProjection = {
  legacyId: 1,
  'data.Employee ID': 1,
  'data.User ID': 1,
  'data.EMP Code': 1,
  'data.employeeId': 1,
  'data.EmpID': 1,
  'data.Employee Name': 1,
  'data.Name': 1,
  'data.Full Name': 1,
  'data.employeeName': 1,
  'data.name': 1,
  'data.Role': 1,
  'data.role': 1,
  'data.Designation': 1,
  'data.Status': 1,
  'data.status': 1,
  'data.Manager ID': 1,
  'data.Manager': 1,
  'data.managerId': 1,
  'data.Reporting Manager': 1,
  'data.Task Approver': 1,
  'data.taskApprover': 1,
  'data.Approver ID': 1,
  'data.Department': 1,
  'data.department': 1,
  'data.Assign Buddy': 1,
  'data.Buddy': 1,
  'data.assignBuddy': 1
};

const ticketSupportLeaveProjection = {
  legacyId: 1,
  'data.Employee ID': 1,
  'data.User ID': 1,
  'data.EMP Code': 1,
  'data.employeeId': 1,
  'data.EmpID': 1,
  'data.Status': 1,
  'data.status': 1,
  'data.Approval Status': 1,
  'data.Start Date': 1,
  'data.StartDate': 1,
  'data.End Date': 1,
  'data.EndDate': 1,
  'data.Date': 1,
  'data.date': 1
};

const ticketSupportIntimationProjection = {
  legacyId: 1,
  'data.Employee ID': 1,
  'data.User ID': 1,
  'data.EMP Code': 1,
  'data.employeeId': 1,
  'data.EmpID': 1,
  'data.Status': 1,
  'data.status': 1,
  'data.Approval Status': 1,
  'data.Intimation Date': 1,
  'data.Date': 1,
  'data.date': 1
};

const ticketSupportEmpMasterProjection = {
  legacyId: 1,
  'data.Employee ID': 1,
  'data.User ID': 1,
  'data.EMP Code': 1,
  'data.employeeId': 1,
  'data.EmpID': 1,
  'data.Employee Name': 1,
  'data.Name': 1,
  'data.Full Name': 1,
  'data.employeeName': 1,
  'data.name': 1,
  'data.Role': 1,
  'data.role': 1,
  'data.Designation': 1,
  'data.Status': 1,
  'data.status': 1,
  'data.Manager ID': 1,
  'data.Manager': 1,
  'data.managerId': 1,
  'data.Reporting Manager': 1,
  'data.Task Approver': 1,
  'data.taskApprover': 1,
  'data.Approver ID': 1,
  'data.Department': 1,
  'data.department': 1,
  'data.Assign Buddy': 1,
  'data.Buddy': 1,
  'data.assignBuddy': 1
};

const ticketWorkspaceListProjection = {
  legacyId: 1,
  'data.Help Person Name': 1,
  'data.Ticket ID': 1,
  'data.Task ID': 1,
  'data.ID': 1,
  'data.Client_Id': 1,
  'data.Client ID': 1,
  'data.CustomerID': 1,
  'data.Name': 1,
  'data.Client Name': 1,
  'data.Client': 1,
  'data.clientName': 1,
  'data.Employee ID': 1,
  'data.EmpID': 1,
  'data.employeeId': 1,
  'data.Employee Name': 1,
  'data.User': 1,
  'data.employeeName': 1,
  'data.Task Category': 1,
  'data.Category': 1,
  'data.category': 1,
  'data.Priority': 1,
  'data.priority': 1,
  'data.Task Description': 1,
  'data.Description': 1,
  'data.description': 1,
  'data.Status': 1,
  'data.status': 1,
  'data.Timestamp': 1,
  'data.Date': 1,
  'data.Plan Date': 1,
  'data.planDate': 1,
  'data.Last Update Date': 1,
  'data.lastUpdateDate': 1,
  'data.Start Time': 1,
  'data.startTime': 1,
  'data.End Time': 1,
  'data.endTime': 1,
  'data.Total Duration': 1,
  'data.Duration': 1,
  'data.totalDuration': 1,
  'data.duration': 1,
  'data.TAT': 1,
  'data.When': 1,
  'data.tatMinutes': 1,
  'data.Task Approver': 1,
  'data.taskApprover': 1,
  'data.Approver ID': 1,
  'data.Reassigned By': 1,
  'data.reassignedBy': 1,
  'data.Reassigned To': 1,
  'data.reassignedTo': 1,
  'data.Source': 1,
  'data.source': 1,
  'data.Ticket Source': 1,
  'data.ticketSource': 1,
  'data.Origin': 1,
  'data.origin': 1,
  'data.Auto Ticket': 1,
  'data.autoTicket': 1,
  'data.Is Auto Ticket': 1,
  'data.isAutoTicket': 1,
  'data.Automation': 1,
  'data.automation': 1,
  'data.Frequency': 1,
  'data.Frequence': 1,
  'data.frequency': 1,
  'data.Created By': 1,
  'data.Creator ID': 1,
  'data.createdBy': 1,
  'data.Client Ticket': 1,
  'data.clientTicket': 1,
  'data.Is Client Ticket': 1,
  'data.isClientTicket': 1,
  'data.Reference Link': 1,
  'data.Link': 1,
  'data.URL': 1,
  'data.Url': 1,
  'data.link': 1,
  'data.url': 1,
  'data.Attachment': 1,
  'data.Attachments': 1,
  'data.Closing Attachment': 1,
  'data.HasUnreadAdminMessages': 1,
  'data.HasUnreadMessages': 1
};

const ticketWorkspaceDetailProjection = {
  ...ticketWorkspaceListProjection,
  'data.Remarks': 1,
  'data.remarks': 1,
  'data.Created By': 1,
  'data.Creator ID': 1
};

function teamIds(employeeId, users = []) {
  const currentId = safe(employeeId).toLowerCase();
  return users
    .filter((user) => splitIds(first(user, ['Manager ID', 'Manager', 'managerId', 'Reporting Manager'])).includes(currentId) ||
      splitIds(first(user, ['Task Approver', 'taskApprover'])).includes(currentId))
    .map((user) => userId(user).toLowerCase())
    .filter(Boolean);
}

function directTeamIds(employeeId, users = []) {
  const currentId = safe(employeeId).toLowerCase();
  return users
    .filter((user) => splitIds(first(user, ['Manager ID', 'Manager', 'managerId', 'Reporting Manager'])).includes(currentId))
    .map((user) => userId(user).toLowerCase())
    .filter(Boolean);
}

function canSeeTicket(ticket, employeeId, role, users = []) {
  const currentId = safe(employeeId).toLowerCase();
  const ownerId = first(ticket, ['Employee ID', 'EmpID', 'employeeId']).toLowerCase();
  const reassignedBy = first(ticket, ['Reassigned By', 'reassignedBy']).toLowerCase();
  const normalizedRole = safe(role).toLowerCase();
  if (normalizedRole === 'super admin') return true;

  // In Client Ticket tab / for client origin tickets:
  // If ticket is assigned to an employee, only that employee and their reporting manager can see it.
  // Other managers and other employees must not see it.
  if (isClientOriginTicket(ticket)) {
    if (ownerId) {
      if (ownerId === currentId) return true;
      const managerIds = directTeamIds(employeeId, users);
      if ((normalizedRole === 'manager' || normalizedRole === 'admin' || normalizedRole === 'hr') && managerIds.includes(ownerId)) {
        return true;
      }
      return false;
    }
    return false;
  }

  if (ownerId === currentId || reassignedBy === currentId) return true;
  if (normalizedRole === 'admin') return teamIds(employeeId, users).includes(ownerId);
  if (normalizedRole === 'manager') return directTeamIds(employeeId, users).includes(ownerId);
  if (normalizedRole === 'hr') {
    const owner = users.find((user) => userId(user).toLowerCase() === ownerId);
    const ownerDepartment = safe(first(owner, ['Department', 'department'])).toLowerCase();
    return teamIds(employeeId, users).includes(ownerId) || ownerDepartment === 'hr' || ownerDepartment.includes('human resource');
  }
  return false;
}

function employeeIdQuery(ids = []) {
  const normalized = ids.map((value) => safe(value)).filter(Boolean);
  if (!normalized.length) return { legacyId: '__no_ticket_match__' };
  const values = [...new Set(normalized.flatMap((val) => [val, val.toUpperCase(), val.toLowerCase()]))];
  return {
    $or: [
      { 'data.Employee ID': { $in: values } },
      { 'data.EmpID': { $in: values } },
      { 'data.employeeId': { $in: values } }
    ]
  };
}

function fieldValueQuery(fieldName, values = []) {
  const normalizedValues = values.map((value) => safe(value)).filter(Boolean);
  if (!normalizedValues.length) return { legacyId: '__no_ticket_match__' };
  return { [fieldName]: normalizedValues.length === 1 ? normalizedValues[0] : { $in: normalizedValues } };
}

function ticketIdQuery(ticketId = '') {
  const value = safe(ticketId);
  return {
    $or: [
      { legacyId: value },
      { 'data.Ticket ID': value },
      { 'data.Task ID': value },
      { 'data.ID': value }
    ]
  };
}

function userIdentityQuery(employeeId = '') {
  const value = safe(employeeId);
  const values = [...new Set([value, value.toUpperCase(), value.toLowerCase()].filter(Boolean))];
  return {
    $or: [
      { 'data.Employee ID': { $in: values } },
      { 'data.User ID': { $in: values } },
      { 'data.EMP Code': { $in: values } },
      { 'data.employeeId': { $in: values } },
      { 'data.EmpID': { $in: values } }
    ]
  };
}

const ticketAccessProjection = {
  legacyId: 1,
  'data.Ticket ID': 1,
  'data.Task ID': 1,
  'data.ID': 1,
  'data.Employee ID': 1,
  'data.EmpID': 1,
  'data.employeeId': 1,
  'data.Reassigned By': 1,
  'data.reassignedBy': 1
};

const ticketAccessUserProjection = {
  legacyId: 1,
  'data.Employee ID': 1,
  'data.User ID': 1,
  'data.EMP Code': 1,
  'data.employeeId': 1,
  'data.EmpID': 1,
  'data.Department': 1,
  'data.department': 1,
  'data.Manager ID': 1,
  'data.Manager': 1,
  'data.managerId': 1,
  'data.Reporting Manager': 1,
  'data.Task Approver': 1,
  'data.taskApprover': 1
};

function buildVisibleTicketQuery(employeeId, role, users = []) {
  const normalizedRole = safe(role).toLowerCase();
  const currentId = safe(employeeId);
  const currentIdLower = currentId.toLowerCase();
  const selfValues = [...new Set([currentId, currentId.toUpperCase(), currentId.toLowerCase()].filter(Boolean))];
  const selfQuery = {
    $or: [
      { 'data.Employee ID': { $in: selfValues } },
      { 'data.EmpID': { $in: selfValues } },
      { 'data.employeeId': { $in: selfValues } },
      { 'data.Reassigned By': { $in: selfValues } },
      { 'data.reassignedBy': { $in: selfValues } }
    ]
  };

  if (normalizedRole === 'super admin') {
    return {};
  }

  if (normalizedRole === 'admin') {
    const ids = [currentIdLower, ...teamIds(employeeId, users)];
    return {
      $or: [
        selfQuery,
        employeeIdQuery(ids)
      ]
    };
  }

  if (normalizedRole === 'manager') {
    const ids = [currentIdLower, ...directTeamIds(employeeId, users)];
    return {
      $or: [
        selfQuery,
        employeeIdQuery(ids)
      ]
    };
  }

  if (normalizedRole === 'hr') {
    const hrIds = users
      .filter((user) => {
        const department = safe(first(user, ['Department', 'department'])).toLowerCase();
        return department === 'hr' || department.includes('human resource');
      })
      .map((user) => userId(user))
      .filter(Boolean);
    const ids = [currentId, ...teamIds(employeeId, users), ...hrIds];
    return {
      $or: [
        selfQuery,
        employeeIdQuery(ids)
      ]
    };
  }

  return selfQuery;
}

function isClientOriginTicket(ticket = {}) {
  const remarks = safe(first(ticket, ['Remarks', 'remarks']));
  const source = safe(first(ticket, ['Source', 'source', 'Ticket Source', 'ticketSource']));
  const origin = safe(first(ticket, ['Origin', 'origin']));
  const clientTicketFlag = safe(first(ticket, ['Client Ticket', 'clientTicket', 'Is Client Ticket', 'isClientTicket']));
  const normalizedRemarks = remarks.toLowerCase();
  const normalizedSource = source.toLowerCase();
  const normalizedOrigin = origin.toLowerCase();
  const normalizedClientTicketFlag = clientTicketFlag.toLowerCase();
  return normalizedOrigin === 'client'
    || normalizedClientTicketFlag === 'yes'
    || normalizedClientTicketFlag === 'true'
    || normalizedSource.includes('client portal')
    || normalizedSource === 'client'
    || normalizedRemarks.includes('created from client portal')
    || normalizedRemarks.includes('created from mern client portal');
}

function isAutoTicket(ticket = {}) {
  const flag = safe(first(ticket, ['Auto Ticket', 'autoTicket', 'Is Auto Ticket', 'isAutoTicket', 'Automation', 'automation']));
  const marker = [
    flag,
    first(ticket, ['Source', 'source', 'Ticket Source', 'ticketSource']),
    first(ticket, ['Origin', 'origin']),
    first(ticket, ['Created By', 'Creator ID', 'createdBy'])
  ].join(' ').toLowerCase();
  if (['yes', 'true', '1', 'auto', 'automatic'].includes(flag.toLowerCase())) return true;
  return /\b(auto|automatic|automation|scheduler|scheduled|recurring|system)\b/.test(marker);
}

function autoTemplateMongoQuery() {
  return { $or: ['Auto Ticket', 'autoTicket', 'Is Auto Ticket', 'isAutoTicket', 'Automation', 'automation'].map((field) => ({
    [`data.${field}`]: { $in: [/^\s*(yes|true|1|auto|automatic)\s*$/i, true, 1] }
  })) };
}

function isAutoTemplate(ticket) {
  return ['Auto Ticket', 'autoTicket', 'Is Auto Ticket', 'isAutoTicket', 'Automation', 'automation']
    .some((field) => /^(yes|true|1|auto|automatic)$/i.test(safe(ticket[field])));
}

// Keep attachment blobs out of full-scope scans; load them only for displayed rows.
async function queryWorkspaceRows(query) {
  const version = ticketWorkspaceVersion;
  const key = `${version}:${JSON.stringify(query, (_, value) => value instanceof RegExp ? value.toString() : value)}`;
  const cached = ticketRowsCache.get(key);
  if (cached && Date.now() - cached.at < TICKET_WORKSPACE_CACHE_TTL_MS) return cached.rows;
  if (ticketRowsInflight.has(key)) return ticketRowsInflight.get(key);
  const projection = { ...ticketWorkspaceListProjection };
  for (const field of ['Attachment', 'Attachments', 'Closing Attachment']) delete projection[`data.${field}`];
  const pending = queryLegacyRows('Ticket', query, projection).then((rows) => {
    if (version === ticketWorkspaceVersion) {
      if (ticketRowsCache.size >= 100) ticketRowsCache.delete(ticketRowsCache.keys().next().value);
      ticketRowsCache.set(key, { at: Date.now(), rows });
    }
    return rows;
  }).finally(() => ticketRowsInflight.delete(key));
  ticketRowsInflight.set(key, pending);
  return pending;
}

async function hydrateWorkspaceAttachments(rows) {
  if (!rows.length) return rows;
  const ids = rows.map((row) => row['Ticket ID']).filter(Boolean);
  if (!ids.length) return rows;
  const docs = await queryLegacyRows('Ticket', { $or: ids.map(ticketIdQuery) }, {
    legacyId: 1, 'data.Ticket ID': 1, 'data.Task ID': 1, 'data.ID': 1,
    'data.Attachment': 1, 'data.Attachments': 1, 'data.Closing Attachment': 1
  });
  const attachments = new Map(docs.map((row) => [first(row, ['Ticket ID', 'Task ID', 'ID']), row]));
  return rows.map((row) => {
    const stored = attachments.get(row['Ticket ID']) || {};
    return { ...row, Attachment: stored.Attachment, Attachments: stored.Attachments, 'Closing Attachment': stored['Closing Attachment'] };
  });
}

// Sort and paginate the complete My/Team scope in Mongo, before transferring rows.
async function queryDefaultTicketPage(query, options, employeeId, data) {
  const text = (fields, fallback = '') => ({ $reduce: {
    input: fields.map((field) => ({ $trim: { input: { $convert: { input: `$data.${field}`, to: 'string', onError: '', onNull: '' } } } })),
    initialValue: fallback,
    in: { $cond: [{ $ne: ['$$value', ''] }, '$$value', '$$this'] }
  } });
  const modeMatch = options.viewMode === 'team'
    ? { $and: [query, notClientOriginMongoQuery()] } : query;
  const filters = options.filters;
  const matches = [];
  const lowerList = (values) => values.map((value) => safe(value).toLowerCase());
  const lowerText = (fields) => ({ $toLower: text(fields) });
  if (filters.clientIds.length) matches.push({ $in: [lowerText(['Client_Id', 'Client ID', 'CustomerID', 'clientId']), lowerList(filters.clientIds)] });
  if (filters.statuses.length) matches.push({ $or: filters.statuses.map((status) => status === 'Rework / Reassigned'
    ? { $regexMatch: { input: '$_status', regex: 'rework|reassigned' } }
    : { $eq: ['$_status', safe(status).toLowerCase()] }) });
  if (filters.frequencies.length) matches.push({ $in: [lowerText(['Frequency', 'Frequence', 'frequency']), lowerList(filters.frequencies)] });
  const employeeNames = data.users.length ? { $switch: { branches: data.users.map((user) => ({
    case: { $eq: ['$_owner', userId(user).toLowerCase()] }, then: { $literal: first(user, ['Employee Name', 'Name', 'Full Name']) }
  })), default: '$_owner' } } : '$_owner';
  const clientNames = data.clients.length ? { $switch: { branches: data.clients.map((client) => ({
    case: { $eq: [lowerText(['Client_Id', 'Client ID', 'CustomerID', 'clientId']), safe(client.Client_Id || client['Client ID']).toLowerCase()] },
    then: { $literal: first(client, ['Client Name', 'Name']) }
  })), default: '' } } : '';
  const withFallback = (fields, fallback) => ({ $let: { vars: { value: text(fields) }, in: { $cond: [{ $eq: ['$$value', ''] }, fallback, '$$value'] } } });
  const employeeName = withFallback(['Employee Name', 'User', 'employeeName', 'name'], employeeNames);
  if (filters.employeeIds.length) matches.push({ $or: [
    { $in: ['$_owner', lowerList(filters.employeeIds)] },
    { $in: [{ $toLower: employeeName }, lowerList(filters.employeeIds)] },
    { $in: [lowerText(['Help Person Name']), lowerList(filters.employeeIds)] }
  ] });
  if (filters.search) matches.push({ $gte: [{ $indexOfCP: [{ $toLower: { $concat: [
    text(['Ticket ID', 'Task ID', 'ID']), ' ', text(['Task Description', 'Description', 'description']), ' ',
    withFallback(['Name', 'Client Name', 'Client', 'clientName'], clientNames), ' ', employeeName, ' ', '$_status', ' ', text(['Priority', 'priority'])
  ] } }, safe(filters.search).toLowerCase()] }, 0] });
  if (filters.timePeriod !== 'All Time') {
    const now = new Date();
    const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    const week = new Date(today); week.setUTCDate(week.getUTCDate() - ((week.getUTCDay() + 6) % 7));
    let start = new Date(today); let end = new Date(today); end.setUTCDate(end.getUTCDate() + 1);
    if (filters.timePeriod === 'This Week') start = week;
    if (filters.timePeriod === 'Last Week') { end = week; start = new Date(week); start.setUTCDate(start.getUTCDate() - 7); }
    if (filters.timePeriod === 'This Month') start = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
    if (filters.timePeriod === 'Last Month') { start = new Date(Date.UTC(now.getFullYear(), now.getMonth() - 1, 1)); end = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1)); }
    matches.push({ $and: [{ $gte: ['$_date', start] }, { $lt: ['$_date', end] }] });
  }
  const pipeline = [
    { $match: modeMatch },
    { $set: {
      _owner: { $toLower: text(['Employee ID', 'EmpID', 'employeeId']) },
      _status: { $toLower: withFallback(['Status', 'status'], 'Open') },
      _plan: text(['Plan Date', 'Date', 'planDate', 'timestamp']),
      _start: text(['Start Time', 'startTime'])
    } },
    ...(options.viewMode === 'team' ? [{ $match: { _owner: { $ne: safe(employeeId).toLowerCase() } } }] : []),
    { $set: {
      _weight: { $switch: { branches: [
        ...[['in progress', 1], ['open', 2], ['approved', 3], ['paused', 4], ['reassigned', 5]].map(([status, value]) => ({ case: { $eq: ['$_status', status] }, then: value })),
        { case: { $regexMatch: { input: '$_status', regex: 'rework' } }, then: 5 },
        { case: { $regexMatch: { input: '$_status', regex: 'pending' } }, then: 90 },
        { case: { $eq: ['$_status', 'completed'] }, then: 91 },
        { case: { $in: ['$_status', ['closed', 'approved by client', 'cancelled']] }, then: 92 },
        { case: { $regexMatch: { input: '$_status', regex: 'approved' } }, then: 93 }
      ], default: 10 } },
      _date: { $ifNull: [
        { $dateFromString: { dateString: '$_plan', format: '%d-%m-%Y', onError: null, onNull: null } },
        { $convert: { input: '$_plan', to: 'date', onError: new Date(0), onNull: new Date(0) } }
      ] }
    } },
    ...(matches.length ? [{ $match: { $expr: { $and: matches } } }] : []),
    { $sort: { _weight: 1, _date: -1, _start: -1, _id: 1 } },
    { $facet: {
      count: [{ $count: 'total' }],
      rows: [{ $skip: (options.page - 1) * options.pageSize }, { $limit: options.pageSize }, { $project: ticketWorkspaceListProjection }]
    } }
  ];
  const [result] = await LegacyModels.Ticket.collection.aggregate(pipeline).toArray();
  const total = result?.count?.[0]?.total || 0;
  const lastPage = Math.max(1, Math.ceil(total / options.pageSize));
  if (options.page > lastPage) return queryDefaultTicketPage(query, { ...options, page: lastPage }, employeeId, data);
  return { rows: fromLegacyDocs(result?.rows || []), pagination: {
    page: options.page, pageSize: options.pageSize, total, totalPages: lastPage,
    start: total ? (options.page - 1) * options.pageSize + 1 : 0,
    end: Math.min(options.page * options.pageSize, total)
  } };
}

function assignableIdsFor(employeeId, role, users = []) {
  const normalizedRole = safe(role).toLowerCase();
  const activeUsers = users.filter((user) => eq(first(user, ['Status', 'status'], 'Active'), 'Active'));
  if (normalizedRole === 'super admin') return activeUsers.map((user) => userId(user).toLowerCase()).filter(Boolean);
  if (normalizedRole === 'hr') return activeUsers.map((user) => userId(user).toLowerCase()).filter(Boolean);
  if (normalizedRole === 'admin' || normalizedRole === 'manager' || normalizedRole === 'user') {
    return [safe(employeeId).toLowerCase(), ...directTeamIds(employeeId, activeUsers)];
  }
  return [safe(employeeId).toLowerCase()];
}

function fromLegacyDocs(docs = []) {
  return docs.map((doc) => ({
    ...stripInternalMetadata(doc.data || {}),
    _id: String(doc._id),
    _legacyId: doc.legacyId
  }));
}

async function queryLegacyRows(modelName, query = {}, projection = { data: 1, legacyId: 1 }) {
  const docs = await LegacyModels[modelName].collection.find(query, { projection }).toArray();
  return fromLegacyDocs(docs);
}

async function queryLegacyRowsAdvanced(modelName, query = {}, options = {}) {
  const docs = await LegacyModels[modelName].collection.find(query, {
    projection: options.projection || { data: 1, legacyId: 1 },
    sort: options.sort,
    skip: options.skip,
    limit: options.limit
  }).toArray();
  return fromLegacyDocs(docs);
}

async function findLegacyRow(modelName, query = {}, projection = { data: 1, legacyId: 1 }) {
  const doc = await LegacyModels[modelName].collection.findOne(query, { projection });
  return doc ? fromLegacyDocs([doc])[0] : null;
}

function ticketScopeRedisKey(cacheKey) {
  return buildRedisKey('ticket-workspace', `schema${TICKET_WORKSPACE_SCHEMA_VERSION}`, `v${ticketWorkspaceVersion}`, cacheKey);
}

async function readTicketScopeCache(cacheKey) {
  const inMemory = ticketWorkspaceCache.get(cacheKey);
  if (inMemory && Date.now() - inMemory.createdAt < TICKET_WORKSPACE_CACHE_TTL_MS) {
    return inMemory.payload;
  }
  const redisCached = await getJson(ticketScopeRedisKey(cacheKey));
  if (redisCached && Date.now() - Number(redisCached.createdAt || 0) < TICKET_WORKSPACE_CACHE_TTL_MS) {
    ticketWorkspaceCache.set(cacheKey, redisCached);
    return redisCached.payload;
  }
  return null;
}

function writeTicketScopeCache(cacheKey, payload) {
  const entry = { createdAt: Date.now(), payload };
  ticketWorkspaceCache.set(cacheKey, entry);
  void setJson(ticketScopeRedisKey(cacheKey), entry, TICKET_WORKSPACE_CACHE_TTL_MS);
}

function ticketSupportRedisKey(cacheKey) {
  return buildRedisKey('ticket-support', `schema${TICKET_WORKSPACE_SCHEMA_VERSION}`, cacheKey);
}

function buildTicketSupportCacheKey(options = {}) {
  return `support::v${ticketWorkspaceVersion}::${options.includeLeaveSignals === false ? 'lite' : 'full'}`;
}

async function getTicketSupportData(options = {}) {
  const includeLeaveSignals = options.includeLeaveSignals !== false;
  const cacheKey = buildTicketSupportCacheKey({ includeLeaveSignals });
  const cached = ticketSupportCache.get(cacheKey);
  if (cached && Date.now() - cached.createdAt < TICKET_SUPPORT_CACHE_TTL_MS) {
    return cached.payload;
  }
  const redisCached = await getJson(ticketSupportRedisKey(cacheKey));
  if (redisCached && Date.now() - Number(redisCached.createdAt || 0) < TICKET_SUPPORT_CACHE_TTL_MS) {
    ticketSupportCache.set(cacheKey, redisCached);
    return redisCached.payload;
  }
  const inflight = ticketSupportInflight.get(cacheKey);
  if (inflight) return inflight;

  const loadPromise = (async () => {
    const [clients, users, leaves, intimations, empMasters] = await Promise.all([
      queryLegacyRows('Client', {}, ticketSupportClientProjection),
      queryLegacyRows('User', {}, ticketSupportUserProjection),
      includeLeaveSignals ? queryLegacyRows('Leave', {}, ticketSupportLeaveProjection) : Promise.resolve([]),
      includeLeaveSignals ? queryLegacyRows('Intimation', {}, ticketSupportIntimationProjection) : Promise.resolve([]),
      queryLegacyRows('EmpMaster', {}, ticketSupportEmpMasterProjection)
    ]);

    const empMasterById = new Map(empMasters.map((row) => [safe(first(row, ['Employee ID', 'User ID', 'EMP Code', 'employeeId', 'EmpID'])).toLowerCase(), row]));
    const mergedUsers = users.map((user) => {
      const key = safe(first(user, ['Employee ID', 'User ID', 'EMP Code', 'employeeId', 'EmpID'])).toLowerCase();
      return { ...user, ...(empMasterById.get(key) || {}) };
    });
    const payload = {
      clients: clients.map(asClientRow),
      users: mergedUsers.map(asUserRow),
      leaves,
      intimations
    };
    const entry = { createdAt: Date.now(), payload };
    ticketSupportCache.set(cacheKey, entry);
    void setJson(ticketSupportRedisKey(cacheKey), entry, TICKET_SUPPORT_CACHE_TTL_MS);
    return payload;
  })();

  ticketSupportInflight.set(cacheKey, loadPromise);
  try {
    return await loadPromise;
  } finally {
    ticketSupportInflight.delete(cacheKey);
  }
}

function parseWorkspaceOptions(options = {}) {
  const page = Math.max(1, Number(options.page || 1) || 1);
  const pageSize = Math.min(100, Math.max(10, Number(options.pageSize || 10) || 10));
  return {
    page,
    pageSize,
    viewMode: safe(options.viewMode || 'my').toLowerCase(),
    filters: {
      clientIds: Array.isArray(options.filters?.clientIds) ? options.filters.clientIds.map(safe).filter(Boolean) : [],
      statuses: Array.isArray(options.filters?.statuses) ? options.filters.statuses.map(safe).filter(Boolean) : [],
      employeeIds: Array.isArray(options.filters?.employeeIds) ? options.filters.employeeIds.map(safe).filter(Boolean) : [],
      frequencies: Array.isArray(options.filters?.frequencies) ? options.filters.frequencies.map(safe).filter(Boolean) : [],
      search: safe(options.filters?.search).toLowerCase(),
      timePeriod: safe(options.filters?.timePeriod || 'All Time')
    }
  };
}

function isDefaultTicketWorkspaceFilters(filters = {}) {
  return !filters.clientIds?.length
    && !filters.statuses?.length
    && !filters.employeeIds?.length
    && !filters.frequencies?.length
    && !safe(filters.search)
    && safe(filters.timePeriod || 'All Time') === 'All Time';
}

function clientOriginConditions() {
  return [
    { 'data.Origin': /^\s*client\s*$/i },
    { 'data.origin': /^\s*client\s*$/i },
    { 'data.Client Ticket': { $in: [/^\s*(yes|true)\s*$/i, true] } },
    { 'data.clientTicket': { $in: [/^\s*(yes|true)\s*$/i, true] } },
    { 'data.Is Client Ticket': { $in: [/^\s*(yes|true)\s*$/i, true] } },
    { 'data.isClientTicket': { $in: [/^\s*(yes|true)\s*$/i, true] } },
    { 'data.Source': /client portal|^client$/i },
    { 'data.source': /client portal|^client$/i },
    { 'data.Ticket Source': /client portal|^client$/i },
    { 'data.ticketSource': /client portal|^client$/i },
    { 'data.Remarks': /created from client portal|created from mern client portal/i },
    { 'data.remarks': /created from client portal|created from mern client portal/i }
  ];
}

function clientOriginMongoQuery() {
  return { $or: clientOriginConditions() };
}

function notClientOriginMongoQuery() {
  return { $nor: clientOriginConditions() };
}

function ticketDateForPeriod(value) {
  if (!safe(value)) return null;
  const raw = safe(value);
  const ymd = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymd) return new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]));
  const dmy = raw.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (dmy) return new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function ticketMatchesPeriod(ticket, timePeriod) {
  if (!timePeriod || timePeriod === 'All Time') return true;
  const date = ticketDateForPeriod(first(ticket, ['Plan Date', 'Date', 'Timestamp']));
  if (!date) return false;
  const now = new Date();
  const todayValue = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const value = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = todayValue.getDay();
  const mondayOffset = day === 0 ? 6 : day - 1;
  const startThisWeek = new Date(todayValue);
  startThisWeek.setDate(todayValue.getDate() - mondayOffset);
  const startLastWeek = new Date(startThisWeek);
  startLastWeek.setDate(startThisWeek.getDate() - 7);
  const endLastWeek = new Date(startThisWeek);
  endLastWeek.setDate(startThisWeek.getDate() - 1);
  const startThisMonth = new Date(todayValue.getFullYear(), todayValue.getMonth(), 1);
  const startLastMonth = new Date(todayValue.getFullYear(), todayValue.getMonth() - 1, 1);
  const endLastMonth = new Date(todayValue.getFullYear(), todayValue.getMonth(), 0);
  if (timePeriod === 'Today') return value.getTime() === todayValue.getTime();
  if (timePeriod === 'This Week') return value >= startThisWeek && value <= todayValue;
  if (timePeriod === 'Last Week') return value >= startLastWeek && value <= endLastWeek;
  if (timePeriod === 'This Month') return value >= startThisMonth && value <= todayValue;
  if (timePeriod === 'Last Month') return value >= startLastMonth && value <= endLastMonth;
  return true;
}

function statusSortWeight(status) {
  const value = safe(status).toLowerCase();
  if (value === 'in progress') return 1;
  if (value === 'open') return 2;
  if (value === 'approved') return 3;
  if (value === 'paused') return 4;
  if (value === 'rework' || value === 'reassigned' || value.includes('rework')) return 5;
  if (value === 'pending approval' || value.includes('pending')) return 90;
  if (value === 'completed') return 91;
  if (value === 'closed' || value === 'approved by client' || value === 'cancelled') return 92;
  if (value.includes('approved')) return 93;
  return 10;
}

function sortWorkspaceTickets(rows = [], viewMode = 'my') {
  return [...rows].sort((left, right) => {
    const statusDiff = statusSortWeight(left.Status) - statusSortWeight(right.Status);
    if (statusDiff) return statusDiff;
    const leftDate = ticketDateForPeriod(viewMode === 'client' ? left.Timestamp || left.Date : left['Plan Date'])?.getTime() || 0;
    const rightDate = ticketDateForPeriod(viewMode === 'client' ? right.Timestamp || right.Date : right['Plan Date'])?.getTime() || 0;
    if (rightDate !== leftDate) return rightDate - leftDate;
    return safe(right['Start Time']).localeCompare(safe(left['Start Time']));
  });
}

function filterWorkspaceTickets(rows = [], filters = {}) {
  return rows.filter((ticket) => {
    const clientMatch = !filters.clientIds?.length || filters.clientIds.some((clientId) => [ticket.Client_Id, ticket['Client ID']].some((value) => eq(value, clientId)));
    const status = safe(ticket.Status);
    const statusMatch = !filters.statuses?.length || filters.statuses.some((item) => item === 'Rework / Reassigned' ? /rework|reassigned/i.test(status) : eq(item, status));
    const freq = safe(ticket.Frequency || ticket.Frequence);
    const frequencyMatch = !filters.frequencies?.length || filters.frequencies.some((item) => eq(item, freq));
    const empMatch = !filters.employeeIds?.length || filters.employeeIds.some((empIdOrName) => 
      eq(ticket['Employee ID'], empIdOrName) || eq(ticket['Employee Name'], empIdOrName) || eq(ticket['Help Person Name'], empIdOrName)
    );
    const searchMatch = !filters.search || [
      ticket['Ticket ID'],
      ticket['Task Description'],
      ticket.Name,
      ticket['Employee Name'],
      ticket.Status,
      ticket.Priority
    ].join(' ').toLowerCase().includes(filters.search.toLowerCase());
    return clientMatch && statusMatch && frequencyMatch && empMatch && searchMatch && ticketMatchesPeriod(ticket, filters.timePeriod);
  });
}

function paginateRows(rows = [], page = 1, pageSize = 20) {
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  return {
    rows: rows.slice(start, start + pageSize),
    pagination: {
      page: safePage,
      pageSize,
      total,
      totalPages,
      start: total ? start + 1 : 0,
      end: Math.min(start + pageSize, total)
    }
  };
}

async function resolveTicketOwnerField(employeeId) {
  const normalizedId = safe(employeeId).toLowerCase();
  const cacheKey = `${ticketWorkspaceVersion}::${normalizedId}`;
  if (ticketOwnerFieldCache.has(cacheKey)) return ticketOwnerFieldCache.get(cacheKey);

  const exactValue = safe(employeeId);
  const fieldCandidates = ['data.Employee ID', 'data.EmpID', 'data.employeeId'];
  const counts = await Promise.all(
    fieldCandidates.map((fieldName) => LegacyModels.Ticket.collection.countDocuments(fieldValueQuery(fieldName, [exactValue])))
  );
  const bestIndex = counts.reduce((best, current, index, items) => (
    current > items[best] ? index : best
  ), 0);
  const bestField = counts[bestIndex] > 0 ? fieldCandidates[bestIndex] : fieldCandidates[0];
  ticketOwnerFieldCache.set(cacheKey, bestField);
  return bestField;
}

async function queryOwnerTicketChunk(employeeId, projection, { skip = 0, limit = TICKET_OWNER_CHUNK_SIZE } = {}) {
  const ownerField = await resolveTicketOwnerField(employeeId);
  const ownerValue = safe(employeeId);
  const [docs, total] = await Promise.all([
    queryLegacyRowsAdvanced('Ticket', fieldValueQuery(ownerField, [ownerValue]), {
      projection,
      sort: { updatedAt: -1, createdAt: -1 },
      skip,
      limit
    }),
    LegacyModels.Ticket.collection.countDocuments(fieldValueQuery(ownerField, [ownerValue]))
  ]);
  return { docs, total, ownerField };
}

async function queryTeamTicketChunk(employeeId, role, users, projection, { skip = 0, limit = TICKET_OWNER_CHUNK_SIZE } = {}) {
  const normalizedRole = safe(role).toLowerCase();
  const currentId = safe(employeeId);
  let query = { legacyId: '__no_team_match__' };

  if (normalizedRole === 'super admin') {
    query = { 'data.Employee ID': { $ne: currentId } };
  } else if (normalizedRole === 'admin') {
    const ids = teamIds(employeeId, users).map((id) => id.toUpperCase() === currentId.toLowerCase() ? currentId : id);
    query = ids.length ? employeeIdQuery(ids) : { legacyId: '__no_team_match__' };
  } else if (normalizedRole === 'manager') {
    const ids = directTeamIds(employeeId, users).map((id) => id.toUpperCase() === currentId.toLowerCase() ? currentId : id);
    query = ids.length ? employeeIdQuery(ids) : { legacyId: '__no_team_match__' };
  } else if (normalizedRole === 'hr') {
    const hrIds = users
      .filter((user) => {
        const department = safe(first(user, ['Department', 'department'])).toLowerCase();
        return department === 'hr' || department.includes('human resource');
      })
      .map((user) => userId(user))
      .filter(Boolean);
    const ids = [...new Set([...teamIds(employeeId, users), ...hrIds])];
    query = ids.length ? employeeIdQuery(ids) : { legacyId: '__no_team_match__' };
  }

  const [docs, total] = await Promise.all([
    queryLegacyRowsAdvanced('Ticket', query, {
      projection,
      sort: { updatedAt: -1, createdAt: -1 },
      skip,
      limit
    }),
    LegacyModels.Ticket.collection.countDocuments(query)
  ]);

  return { docs, total, query };
}

async function getTicketScope(ticketId, employeeId, role) {
  const supportData = await getTicketSupportData();
  const ticket = await findLegacyRow('Ticket', ticketIdQuery(ticketId));
  if (!ticket) return { error: fail('Ticket not found.') };
  if (!canSeeTicket(ticket, employeeId, role, supportData.users)) return { error: fail('Access denied for this ticket.') };
  const ownerEmployeeId = first(ticket, ['Employee ID', 'EmpID', 'employeeId']);
  const ownerTickets = ownerEmployeeId
    ? await queryLegacyRows('Ticket', employeeIdQuery([ownerEmployeeId]), ticketWorkspaceDetailProjection)
    : [];
  return { data: { ...supportData, tickets: ownerTickets }, ticket };
}

async function getTicketMessageScope(ticketId, employeeId, role) {
  const ticket = await findLegacyRow('Ticket', ticketIdQuery(ticketId), ticketAccessProjection);
  if (!ticket) return { error: fail('Ticket not found.') };

  const normalizedRole = safe(role).toLowerCase();
  const currentId = safe(employeeId).toLowerCase();
  const ownerId = first(ticket, ['Employee ID', 'EmpID', 'employeeId']).toLowerCase();
  const reassignedBy = first(ticket, ['Reassigned By', 'reassignedBy']).toLowerCase();

  if (normalizedRole === 'super admin' || ownerId === currentId || reassignedBy === currentId) {
    return { ticket };
  }

  if (!ownerId) return { error: fail('Access denied for this ticket.') };

  const owner = await findOneRowByFilter(
    'User',
    userIdentityQuery(ownerId.toUpperCase()),
    { projection: ticketAccessUserProjection }
  );
  if (!owner) return { error: fail('Access denied for this ticket.') };

  const ownerManagers = splitIds(first(owner, ['Manager ID', 'Manager', 'managerId', 'Reporting Manager']));
  const ownerApprovers = splitIds(first(owner, ['Task Approver', 'taskApprover']));
  const ownerDepartment = safe(first(owner, ['Department', 'department'])).toLowerCase();

  if (normalizedRole === 'admin' && (ownerManagers.includes(currentId) || ownerApprovers.includes(currentId))) {
    return { ticket };
  }
  if (normalizedRole === 'manager' && ownerManagers.includes(currentId)) {
    return { ticket };
  }
  if (normalizedRole === 'hr' && (ownerManagers.includes(currentId) || ownerApprovers.includes(currentId) || ownerDepartment === 'hr' || ownerDepartment.includes('human resource'))) {
    return { ticket };
  }

  return { error: fail('Access denied for this ticket.') };
}

function parseReferenceNow(value) {
  if (!value) return new Date();
  if (String(value).includes('T')) return new Date(value);
  return new Date(`${value}T12:00:00+05:30`);
}

const referenceNow = () => parseReferenceNow(process.env.WORKTRACK_REFERENCE_DATE);

const TICKET_TIME_ZONE = 'Asia/Kolkata';

function ticketTimeParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TICKET_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).formatToParts(date);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

function localDate(date = new Date()) {
  const { year, month, day } = ticketTimeParts(date);
  return `${year}-${month}-${day}`;
}

function today() {
  return localDate(referenceNow());
}

function nowIso(date = referenceNow()) {
  const { year, month, day, hour, minute, second } = ticketTimeParts(date);
  return `${year}-${month}-${day}T${hour}:${minute}:${second}+05:30`;
}

function localTimeHms(date = referenceNow()) {
  const { hour, minute, second } = ticketTimeParts(date);
  return `${hour}:${minute}:${second}`;
}

function isClosedStatus(status = '') {
  const closedTerms = ['closed', 'approved', 'cancelled', 'completed', 'done', 'resolved', 'paid'];
  return closedTerms.some((term) => String(status).toLowerCase().includes(term));
}

function normalizedDate(value) {
  if (!value) return today();
  const raw = safe(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? raw : parsed.toISOString().slice(0, 10);
}

function timestampForAttendance(dateValue, timeValue, action = 'Punch In') {
  const date = normalizedDate(dateValue);
  const raw = safe(timeValue);
  if (!raw) return '';
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime()) && /T|GMT|UTC|\d{4}-\d{2}-\d{2}/i.test(raw)) return parsed.toISOString();
  const match = raw.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (!match) return raw;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = Number(match[3] || 0);
  const meridian = match[4]?.toLowerCase();
  if (meridian === 'pm' && hour < 12) hour += 12;
  if (meridian === 'am' && hour === 12) hour = 0;
  if (!meridian && /out/i.test(action) && hour > 0 && hour < 9) hour += 12;
  return new Date(`${date}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}+05:30`).toISOString();
}

function attendanceEventTime(row) {
  const date = normalizedDate(first(row, ['Date'], today()));
  const time = first(row, ['Time', 'Punch In', 'Punch Out']);
  const parsed = new Date(time || date);
  if (!Number.isNaN(parsed.getTime()) && /T|GMT|UTC|\d{4}-\d{2}-\d{2}/i.test(String(time || date))) return parsed.getTime();
  const timestamp = timestampForAttendance(date, time || '00:00', row.Action || '');
  const fromTimestamp = new Date(timestamp).getTime();
  return Number.isNaN(fromTimestamp) ? new Date(`${date}T00:00:00+05:30`).getTime() : fromTimestamp;
}

function isAttendanceActive(rowsList, employeeId) {
  if (!safe(employeeId) || eq(employeeId, 'client')) return true;
  const todayRows = rowsList
    .filter((row) => eq(row['Employee ID'] || row.EmpID, employeeId) && normalizedDate(row.Date) === today())
    .sort((left, right) => attendanceEventTime(right) - attendanceEventTime(left));
  const latest = todayRows[0];
  if (!latest) return false;
  const action = safe(latest.Action);
  if (/punch\s*out/i.test(action)) return false;
  if (/punch\s*in/i.test(action)) return true;
  return !!first(latest, ['Punch In', 'Time']) && !first(latest, ['Punch Out']);
}

function attendanceDayQuery(date = today()) {
  return {
    $or: [
      { 'data.Date': date },
      { 'data.Date': { $regex: `^${date}` } },
      { 'data.date': date },
      { 'data.date': { $regex: `^${date}` } }
    ]
  };
}

async function getTodayAttendanceRows(employeeId) {
  if (!safe(employeeId) || eq(employeeId, 'client')) return [];
  return findRowsByFilter(
    'Attendance',
    {
      $and: [
        {
          $or: [
            { 'data.Employee ID': employeeId },
            { 'data.EmpID': employeeId },
            { 'data.employeeId': employeeId }
          ]
        },
        attendanceDayQuery(today())
      ]
    },
    {
      projection: {
        legacyId: 1,
        'data.Employee ID': 1,
        'data.EmpID': 1,
        'data.employeeId': 1,
        'data.Date': 1,
        'data.Action': 1,
        'data.Time': 1,
        'data.Punch In': 1,
        'data.Punch Out': 1
      },
      sort: { 'data.Time': -1, createdAt: -1 }
    }
  );
}

async function requireAttendanceActive(employeeId) {
  if (!safe(employeeId) || eq(employeeId, 'client')) return null;
  const attendance = await getTodayAttendanceRows(employeeId);
  if (isAttendanceActive(attendance, employeeId)) return null;
  return fail('Attendance Required: Aapne aaj ki Attendance (Punch In) mark nahi ki hai ya aap already Punch Out kar chuke hain. Kripya pehle Punch In karein!');
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

function minutesLabel(minutes) {
  const total = Math.max(0, Math.round(minutes));
  return `${Math.floor(total / 60)}h ${total % 60}m`;
}

function parseTicketStartTime(value, referenceDate = referenceNow()) {
  const raw = safe(value);
  if (!raw) return null;
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime()) && /T|GMT|UTC|\d{4}-\d{2}-\d{2}/i.test(raw)) return parsed;
  const match = raw.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = Number(match[3] || 0);
  const meridian = match[4]?.toLowerCase();
  if (meridian === 'pm' && hour < 12) hour += 12;
  if (meridian === 'am' && hour === 12) hour = 0;
  
  const dateRef = Number.isNaN(referenceDate.getTime()) ? referenceNow() : referenceDate;
  const year = dateRef.getFullYear();
  const month = String(dateRef.getMonth() + 1).padStart(2, '0');
  const day = String(dateRef.getDate()).padStart(2, '0');
  const startStr = `${year}-${month}-${day}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}+05:30`;
  const start = new Date(startStr);
  
  const now = referenceNow();
  if (start.getTime() > now.getTime()) start.setTime(start.getTime() - 86400000);
  return start;
}

function addTicketSessionDuration(existingDuration, startTimeStr, endTime = referenceNow()) {
  const start = parseTicketStartTime(startTimeStr, endTime);
  const sessionMins = start ? Math.max(0, Math.round((endTime - start) / 60000)) : 0;
  const totalMins = durationToMinutes(existingDuration) + sessionMins;
  return { sessionMins, totalStr: minutesLabel(totalMins) };
}

function asTicketRow(row = {}, clients = [], users = []) {
  const ticketId = first(row, ['Ticket ID', 'Task ID', 'ID', 'ticketId', 'taskId']);
  const clientId = first(row, ['Client_Id', 'Client ID', 'CustomerID', 'clientId']);
  const clientNameFromMaster =
    clients.find((item) => eq(item.Client_Id || item['Client ID'], clientId))?.['Client Name'] || '';
  const client = first(row, ['Name', 'Client Name', 'Client', 'clientName'], clientNameFromMaster);
  const employeeId = first(row, ['Employee ID', 'EmpID', 'employeeId']);
  const userMatch = users.find((user) => eq(first(user, ['Employee ID', 'User ID', 'EMP Code', 'employeeId', 'EmpID']), employeeId));
  const employeeName = first(
    row,
    ['Employee Name', 'User', 'employeeName', 'name'],
    first(userMatch || {}, ['Employee Name', 'Name', 'Full Name'], employeeId)
  );
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
    'Task Approver': first(row, ['Task Approver', 'taskApprover', 'Approver ID']),
    'Reassigned By': first(row, ['Reassigned By', 'reassignedBy']),
    'Created By': first(row, ['Created By', 'createdBy', 'Creator ID']),
    'Reference Link': first(row, ['Reference Link', 'Link', 'URL', 'Url', 'link', 'url']),
    Link: first(row, ['Link', 'Reference Link', 'URL', 'Url', 'link', 'url']),
    Source: first(row, ['Source', 'source', 'Ticket Source', 'ticketSource']),
    'Ticket Source': first(row, ['Ticket Source', 'ticketSource', 'Source', 'source']),
    Origin: first(row, ['Origin', 'origin']),
    'Auto Ticket': first(row, ['Auto Ticket', 'autoTicket', 'Is Auto Ticket', 'isAutoTicket', 'Automation', 'automation']),
    _isClientOrigin: isClientOriginTicket(row),
    _isAutoTicket: isAutoTicket(row)
  };
}

function compactTicketRow(row = {}) {
  return {
    'Help Person Name': row['Help Person Name'],
    'Ticket ID': row['Ticket ID'],
    ID: row.ID,
    Client_Id: row.Client_Id,
    'Client ID': row['Client ID'],
    Client: row.Client,
    Name: row.Name,
    'Client Name': row['Client Name'],
    'Employee ID': row['Employee ID'],
    EmpID: row.EmpID,
    'Employee Name': row['Employee Name'],
    User: row.User,
    'Task Category': row['Task Category'],
    Category: row.Category,
    Priority: row.Priority,
    'Task Description': row['Task Description'],
    Description: row.Description,
    Status: row.Status,
    Timestamp: row.Timestamp,
    Date: row.Date,
    'Plan Date': row['Plan Date'],
    'Last Update Date': row['Last Update Date'],
    'Start Time': row['Start Time'],
    'End Time': row['End Time'],
    'Total Duration': row['Total Duration'],
    Duration: row.Duration,
    Remarks: row.Remarks,
    TAT: row.TAT,
    When: row.When,
    'Task Approver': row['Task Approver'],
    'Reassigned By': row['Reassigned By'],
    'Created By': row['Created By'],
    'Reference Link': row['Reference Link'],
    Link: row.Link,
    Source: row.Source,
    'Ticket Source': row['Ticket Source'],
    Origin: row.Origin,
    'Auto Ticket': row['Auto Ticket'],
    Frequency: row.Frequency,
    Frequence: row.Frequence,
    Attachment: row.Attachment,
    Attachments: row.Attachments,
    'Closing Attachment': row['Closing Attachment'],
    HasUnreadAdminMessages: row.HasUnreadAdminMessages,
    HasUnreadMessages: row.HasUnreadMessages,
    _isClientOrigin: row._isClientOrigin,
    _isAutoTicket: row._isAutoTicket,
    _canApprove: row._canApprove,
    _isActionableByMe: row._isActionableByMe,
    _canTransferApproval: row._canTransferApproval,
    _canSeeTeam: row._canSeeTeam,
    _isBuddyTicket: row._isBuddyTicket
  };
}

function asClientRow(row = {}) {
  const clientId = first(row, ['Client_Id', 'Client ID', 'CustomerID', 'clientId', 'customerId']);
  const clientName = first(row, ['Client Name', 'CustomerName', 'Name', 'clientName', 'name'], clientId);
  const normalized = {
    ...row,
    Client_Id: clientId,
    'Client ID': first(row, ['Client ID', 'Client_Id', 'CustomerID', 'clientId'], clientId),
    CustomerID: first(row, ['CustomerID', 'Client_Id', 'Client ID', 'clientId'], clientId),
    'Client Name': clientName,
    CustomerName: first(row, ['CustomerName', 'Client Name', 'Name', 'clientName', 'name'], clientName),
    Name: clientName
  };
  delete normalized.Password;
  delete normalized.password;
  return normalized;
}

function asUserRow(row = {}) {
  const employeeId = userId(row);
  const employeeName = first(row, ['Employee Name', 'Name', 'Full Name', 'employeeName', 'name'], employeeId);
  const normalized = {
    ...row,
    'Employee ID': employeeId,
    'User ID': first(row, ['User ID', 'Employee ID', 'EMP Code', 'employeeId'], employeeId),
    'Employee Name': employeeName,
    Name: employeeName,
    Role: first(row, ['Role', 'role', 'Designation'], 'User'),
    Status: first(row, ['Status', 'status'], 'Active'),
    'Manager ID': first(row, ['Manager ID', 'Manager', 'managerId', 'Reporting Manager'], ''),
    'Task Approver': first(row, ['Task Approver', 'taskApprover', 'Approver ID'], '')
  };
  delete normalized.Password;
  delete normalized.password;
  return normalized;
}

async function getRows() {
  const supportData = await getTicketSupportData();
  const tickets = await queryLegacyRows('Ticket', {}, ticketWorkspaceListProjection);
  return {
    tickets,
    ...supportData
  };
}

async function saveTicket(row) {
  return upsertRow('Ticket', 'Ticket ID', row['Ticket ID'], row);
}

export async function getTicketSystemData(employeeId, role, options = {}) {
  const workspaceOptions = parseWorkspaceOptions(options);
  const normalizedRole = safe(role).toLowerCase();
  const cacheKey = [
    safe(employeeId).toLowerCase(),
    normalizedRole,
    workspaceOptions.viewMode,
    workspaceOptions.page,
    workspaceOptions.pageSize,
    workspaceOptions.filters.timePeriod,
    workspaceOptions.filters.search,
    workspaceOptions.filters.clientIds.join(','),
    workspaceOptions.filters.statuses.join(','),
    workspaceOptions.filters.employeeIds.join(','),
    workspaceOptions.filters.frequencies.join(',')
  ].join('::');
  const cached = await readTicketScopeCache(cacheKey);
  if (cached) return cached;

  const inflight = ticketWorkspaceInflight.get(cacheKey);
  if (inflight) return inflight;

  const loadPromise = (async () => {
    const elevated = ['super admin', 'admin', 'manager', 'hr'].includes(normalizedRole);
    const clientView = workspaceOptions.viewMode === 'client';
    const data = await getTicketSupportData({ includeLeaveSignals: workspaceOptions.viewMode === 'buddy' });
    const activeUsers = data.users.filter((user) => eq(first(user, ['Status', 'status'], 'Active'), 'Active'));
    const allowedAssigneeIds = assignableIdsFor(employeeId, role, activeUsers);
    const assignableUsers = activeUsers.filter((user) => allowedAssigneeIds.includes(userId(user).toLowerCase()));
    const visibleTicketQuery = buildVisibleTicketQuery(employeeId, role, data.users);
    const canViewClientTickets = elevated || Boolean(await LegacyModels.Ticket.collection.findOne(
      { $and: [employeeIdQuery([employeeId]), clientOriginMongoQuery()] }, { projection: { _id: 1 } }
    ));
    const mode = workspaceOptions.viewMode;
    const modeQuery = clientView ? clientOriginMongoQuery()
      : mode === 'auto' ? autoTemplateMongoQuery()
      : mode === 'my' ? employeeIdQuery([employeeId])
      : {};
    const ticketQuery = { $and: [visibleTicketQuery, modeQuery] };
    const directPage = ['my', 'team'].includes(mode)
      ? await queryDefaultTicketPage(ticketQuery, workspaceOptions, employeeId, data) : null;
    const visibleTicketDocs = directPage ? directPage.rows : mode === 'buddy' ? [] : await queryWorkspaceRows(ticketQuery);

    const tickets = visibleTicketDocs.filter((ticket) => canSeeTicket(ticket, employeeId, role, data.users));
  const categories = [...new Set([
    'Google Sheet', 'Digital Marketing', 'Recruitment', 'Graphic Design', 'Development',
    ...visibleTicketDocs.map((ticket) => first(ticket, ['Task Category', 'Category']))
  ].filter(Boolean))];
  const clientMap = new Map(data.clients.map((client) => {
    const id = first(client, ['Client_Id', 'Client ID', 'CustomerID', 'clientId']);
    return [safe(id).toLowerCase(), client];
  }));
  visibleTicketDocs.forEach((ticket) => {
    const id = first(ticket, ['Client_Id', 'Client ID', 'CustomerID', 'clientId']);
    if (!safe(id) || clientMap.has(safe(id).toLowerCase())) return;
    const name = first(ticket, ['Name', 'Client Name', 'Client', 'clientName'], id);
    clientMap.set(safe(id).toLowerCase(), { 'Client_Id': id, 'Client ID': id, 'Client Name': name, Services: '' });
  });
  const clients = [...clientMap.values()];
  const dropdowns = {
    clients,
    categories,
    users: assignableUsers,
    allUsers: activeUsers
  };
  const ownerFor = (ticket) => data.users.find((user) => eq(userId(user), first(ticket, ['Employee ID', 'EmpID', 'employeeId'])));
  const approvalFor = (ticket) => {
    const owner = ownerFor(ticket);
    const reassignedTo = first(ticket, ['Reassigned To', 'reassignedTo']);
    const approver = reassignedTo || first(owner, ['Task Approver', 'Manager ID', 'Manager']);
    return safe(approver).split(',')[0].trim();
  };
  const visibleTickets = tickets.map((ticket) => {
    const row = asTicketRow(ticket, data.clients, data.users);
    const isPending = eq(row.Status, 'Pending Approval');
    const isOwner = eq(row['Employee ID'], employeeId);
    const designated = eq(approvalFor(ticket), employeeId);
    const owner = ownerFor(ticket);
    const ownerDepartment = safe(first(owner, ['Department', 'department'])).toLowerCase();
    const superAdminAction = normalizedRole === 'super admin' && !isOwner;
    const hrAction = normalizedRole === 'hr' && (ownerDepartment === 'hr' || ownerDepartment.includes('human resource'));
    const actionable = isPending && !isOwner && (superAdminAction || designated || hrAction);
    return compactTicketRow({
      ...row,
      _canApprove: actionable,
      _isActionableByMe: actionable,
      _canTransferApproval: actionable,
      _canSeeTeam: elevated
    });
  });
  const clientOriginTickets = visibleTickets.filter((ticket) => ticket._isClientOrigin);
  const todayDate = new Date().toISOString().split('T')[0];
  const isApprovedStatus = (status) => ['approved', 'approve', 'accepted'].includes(String(status || '').toLowerCase().trim());
  const onLeaveUserIds = new Set();
  
  function normalizedDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
    const parts = String(dateStr).split(/[-/]/);
    if (parts.length === 3) {
      const d2 = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
      if (!isNaN(d2.getTime())) return d2.toISOString().split('T')[0];
    }
    return '';
  }

  (data.leaves || []).forEach(row => {
    const status = first(row, ['Status', 'status', 'Approval Status']);
    if (isApprovedStatus(status)) {
      const start = normalizedDate(first(row, ['Start Date', 'StartDate', 'Date', 'date']));
      const end = normalizedDate(first(row, ['End Date', 'EndDate', 'Start Date', 'StartDate', 'Date', 'date']));
      if (start && end && start <= todayDate && todayDate <= end) {
        onLeaveUserIds.add(userId(row).toLowerCase());
      }
    }
  });

  (data.intimations || []).forEach(row => {
    const status = first(row, ['Status', 'status', 'Approval Status']);
    if (isApprovedStatus(status)) {
      const date = normalizedDate(first(row, ['Intimation Date', 'Date', 'date']));
      if (date === todayDate) {
        onLeaveUserIds.add(userId(row).toLowerCase());
      }
    }
  });

  const buddyCandidateIds = data.users
    .filter((u) => onLeaveUserIds.has(userId(u).toLowerCase()))
    .map((u) => userId(u))
    .filter(Boolean);
  const buddyTicketDocs = buddyCandidateIds.length
    ? await queryWorkspaceRows(employeeIdQuery(buddyCandidateIds))
    : [];
  const buddyTickets = [];
  data.users.forEach(u => {
    const uId = userId(u).toLowerCase();
    if (!onLeaveUserIds.has(uId)) return;

    const buddyId = String(first(u, ['Assign Buddy', 'Buddy', 'assignBuddy']) || '').trim().toLowerCase();
    if (!buddyId) return;

    let canViewBuddy = false;
    const currentEmpId = String(employeeId).toLowerCase();
    if (buddyId === currentEmpId || buddyId.includes(currentEmpId) || buddyId.includes(`(${currentEmpId})`)) {
      canViewBuddy = true;
    } else if (normalizedRole === 'super admin') {
      canViewBuddy = true;
    } else if (normalizedRole === 'manager' || normalizedRole === 'admin' || normalizedRole === 'hr') {
      const managerIds = splitIds(first(u, ['Manager ID', 'Manager', 'managerId', 'Reporting Manager']));
      if (managerIds.includes(currentEmpId) || managerIds.some(m => m.includes(currentEmpId))) {
        canViewBuddy = true;
      }
    }

    if (!canViewBuddy) return;

    const buddyUser = data.users.find(bu => userId(bu).toLowerCase() === buddyId);
    const buddyName = buddyUser ? (first(buddyUser, ['Employee Name', 'Name']) || buddyId) : buddyId;

    const userTickets = buddyTicketDocs.filter(t => userId(t).toLowerCase() === uId);
    userTickets.forEach(ticket => {
      const row = asTicketRow(ticket, data.clients, data.users);
      buddyTickets.push({
        ...row,
        'Employee Name': `${row['Employee Name'] || row['Employee ID']} (On Leave) ➔ Buddy: ${buddyName}`,
        _isBuddyTicket: true,
        _canApprove: false,
        _isActionableByMe: true,
        _canTransferApproval: false,
        _canSeeTeam: false
      });
    });
  });

  const currentEmployeeId = safe(employeeId).toLowerCase();
  const myRows = visibleTickets.filter((ticket) => safe(ticket['Employee ID']).toLowerCase() === currentEmployeeId);
  const teamRows = visibleTickets.filter((ticket) => !ticket._isClientOrigin && safe(ticket['Employee ID']).toLowerCase() !== currentEmployeeId);
  const clientRows = clientOriginTickets;
  const autoRows = visibleTickets.filter((ticket) => isAutoTemplate(ticket));
  const buddyRows = buddyTickets;
  const scopedRows = workspaceOptions.viewMode === 'team' && elevated
    ? teamRows
    : workspaceOptions.viewMode === 'client' && (elevated || clientRows.length > 0)
      ? clientRows
      : workspaceOptions.viewMode === 'auto'
        ? autoRows
        : workspaceOptions.viewMode === 'buddy'
          ? buddyRows
          : myRows;
  const filteredRows = sortWorkspaceTickets(filterWorkspaceTickets(scopedRows, workspaceOptions.filters), workspaceOptions.viewMode);
  const paged = directPage
    ? { rows: scopedRows, pagination: directPage.pagination }
    : paginateRows(filteredRows, workspaceOptions.page, workspaceOptions.pageSize);
  if (!directPage) paged.rows = await hydrateWorkspaceAttachments(paged.rows);

    const payload = ok({
    clients,
    users: assignableUsers,
    allUsers: activeUsers,
    employees: assignableUsers,
    tickets: ['client', 'auto', 'buddy'].includes(workspaceOptions.viewMode) ? [] : paged.rows,
    autoTickets: workspaceOptions.viewMode === 'auto' ? paged.rows : [],
    buddyTickets: workspaceOptions.viewMode === 'buddy' ? paged.rows : [],
    teamTickets: [],
    clientOriginTickets: workspaceOptions.viewMode === 'client' ? paged.rows : [],
    canViewTeamTickets: elevated,
    canViewClientTickets,
    categories,
    counts: {
      my: directPage && mode === 'my' ? directPage.pagination.total : filterWorkspaceTickets(myRows, workspaceOptions.filters).length,
      team: directPage && mode === 'team' ? directPage.pagination.total : filterWorkspaceTickets(teamRows, workspaceOptions.filters).length,
      client: filterWorkspaceTickets(clientRows, workspaceOptions.filters).length,
      auto: filterWorkspaceTickets(autoRows, workspaceOptions.filters).length,
      buddy: filterWorkspaceTickets(buddyRows, workspaceOptions.filters).length
    },
    pagination: {
      ...paged.pagination,
      viewMode: workspaceOptions.viewMode
    },
    dropdowns
  });
    writeTicketScopeCache(cacheKey, payload);
    return payload;
  })();

  ticketWorkspaceInflight.set(cacheKey, loadPromise);
  try {
    return await loadPromise;
  } finally {
    ticketWorkspaceInflight.delete(cacheKey);
  }
}

export async function getTicketDetails(ticketId, employeeId, role) {
  const [supportData, detailRow] = await Promise.all([
    getTicketSupportData(),
    findLegacyRow('Ticket', ticketIdQuery(ticketId), ticketWorkspaceDetailProjection)
  ]);
  if (!detailRow) return fail('Ticket not found.');
  if (!canSeeTicket(detailRow, employeeId, role, supportData.users)) return fail('Access denied for this ticket.');
  return ok({
    item: compactTicketRow(asTicketRow(detailRow, supportData.clients, supportData.users))
  });
}

function approvalDecision(data, ticket, actorId) {
  const actor = data.users.find((user) => eq(userId(user), actorId));
  const owner = data.users.find((user) => eq(userId(user), first(ticket, ['Employee ID', 'EmpID', 'employeeId'])));
  if (!actor || !owner) return { allowed: false, message: 'User details not found.' };
  if (eq(userId(owner), actorId) && userRole(actor) !== 'super admin') return { allowed: false, message: 'You cannot approve your own ticket.' };
  const role = userRole(actor);
  const ownerDepartment = safe(first(owner, ['Department', 'department'])).toLowerCase();
  const reassignedTo = first(ticket, ['Reassigned To', 'reassignedTo']);
  const designated = safe(reassignedTo || first(owner, ['Task Approver', 'Manager ID', 'Manager'])).split(',')[0].trim();
  if (role === 'super admin') {
    return { allowed: true, actor, owner };
  }
  if (role === 'manager') {
    const directReports = directTeamIds(actorId, data.users);
    return directReports.includes(userId(owner).toLowerCase())
      ? { allowed: true, actor, owner }
      : { allowed: false, message: 'You can only approve tickets for your direct team members.' };
  }
  const allowed = eq(designated, actorId) || (role === 'hr' && (ownerDepartment === 'hr' || ownerDepartment.includes('human resource')));
  return allowed ? { allowed: true, actor, owner } : { allowed: false, message: 'You are not the designated approver for this ticket.' };
}

export async function adminTicketAction(ticketId, action, remarks, actorId, role) {
  const scope = await getTicketScope(ticketId, actorId, role);
  if (scope.error) return scope.error;
  const { data, ticket } = scope;
  if (!eq(ticket.Status, 'Pending Approval')) return fail('Only pending approval tickets can be actioned.');
  const decision = approvalDecision(data, ticket, actorId);
  if (!decision.allowed) return fail(decision.message);
  if (!safe(remarks)) return fail('Remarks are required for this action.');
  const actorName = first(decision.actor, ['Employee Name', 'Name'], actorId);
  const now = nowIso();
  const approved = ['approve', 'approved'].includes(safe(action).toLowerCase());
  const nextStatus = approved ? 'Closed' : 'Rework';
  const row = await upsertRow('Ticket', 'Ticket ID', ticketId, {
    'Ticket ID': ticketId,
    Status: nextStatus,
    'Last Action By': actorName,
    'Last Update Date': now,
    ...(approved ? { 'Close Date': now, 'Completion Date': now } : {}),
    Remarks: `${ticket.Remarks || ''}${ticket.Remarks ? '\n' : ''}[${actorName} - ${now}]: ${approved ? 'Approve' : 'Rework'} - ${remarks}`
  });
  await insertRow('TicketHistory', {
    'History ID': `HIST_${Date.now()}`,
    'Ticket ID': ticketId,
    ActionBy: actorName,
    ActionType: approved ? 'Approved & Closed' : 'Sent for Rework',
    Remarks: remarks,
    Timestamp: now
  });
  return ok({ message: approved ? 'Ticket approved and closed.' : 'Ticket sent for rework.', item: row });
}

export async function transferTicketApproval(ticketId, targetManagerId, remarks, actorId, role) {
  const scope = await getTicketScope(ticketId, actorId, role);
  if (scope.error) return scope.error;
  const { data, ticket } = scope;
  const decision = approvalDecision(data, ticket, actorId);
  if (!decision.allowed) return fail(decision.message);
  if (!safe(targetManagerId) || !safe(remarks)) return fail('Target approver and remarks are required.');
  const target = data.users.find((user) => eq(userId(user), targetManagerId) && eq(first(user, ['Status', 'status'], 'Active'), 'Active'));
  if (!target) return fail('Target approver not found or inactive.');
  const actorName = first(decision.actor, ['Employee Name', 'Name'], actorId);
  const now = nowIso();
  const row = await upsertRow('Ticket', 'Ticket ID', ticketId, {
    'Ticket ID': ticketId,
    'Reassigned To': targetManagerId,
    'Reassigned By': actorId,
    'Last Action By': actorName,
    'Last Update Date': now,
    Remarks: `${ticket.Remarks || ''}${ticket.Remarks ? '\n' : ''}[${actorName} - ${now}]: Approval transferred to ${first(target, ['Employee Name', 'Name'], targetManagerId)} - ${remarks}`
  });
  await insertRow('TicketHistory', {
    'History ID': `HIST_${Date.now()}`,
    'Ticket ID': ticketId,
    ActionBy: actorName,
    ActionType: 'Approval Transferred',
    Remarks: `Transferred to ${targetManagerId}. ${remarks}`,
    Timestamp: now
  });
  return ok({ message: `Approval authority transferred to ${first(target, ['Employee Name', 'Name'], targetManagerId)}.`, item: row });
}

export async function createTicket(ticketData = {}) {
  const creatorId = first(ticketData, ['Creator ID', 'createdBy', 'Created By']);
  if (creatorId) {
    const gate = await requireAttendanceActive(creatorId);
    if (gate) return gate;
  }
  const id = ticketData['Ticket ID'] || ticketData.ID || `TICKET_${Date.now()}`;
  const description = first(ticketData, ['Task Description', 'Description']);
  const data = await getTicketSupportData();
  const clientId = first(ticketData, ['Client_Id', 'Client ID']);
  const client = data.clients.find((item) => eq(item.Client_Id, clientId) || eq(item['Client ID'], clientId));
  let initialAttachments = '';
  if (Array.isArray(ticketData.Attachment)) {
    const attachmentUrls = [];
    for (const item of ticketData.Attachment) {
      if (!item) continue;
      attachmentUrls.push(item?.base64 ? await saveBase64File(item, 'ticket_attachments') : safe(item));
    }
    initialAttachments = attachmentUrls.filter(Boolean).join(',');
  } else {
    initialAttachments = ticketData.Attachment?.base64
      ? await saveBase64File(ticketData.Attachment, 'ticket_attachments')
      : safe(ticketData.Attachment);
  }
  const row = {
    'Ticket ID': id,
    ID: id,
    Timestamp: nowIso(),
    Status: 'Open',
    ...ticketData,
    Attachment: initialAttachments,
    Client_Id: clientId,
    Name: first(ticketData, ['Name', 'Client Name', 'Client'], client?.['Client Name'] || ''),
    'Client Name': first(ticketData, ['Client Name', 'Client', 'Name'], client?.['Client Name'] || ''),
    'Task Description': description,
    Description: description,
    'Plan Date': first(ticketData, ['Plan Date', 'Date'], today()),
    TAT: first(ticketData, ['TAT', 'When'])
  };
  await saveTicket(row);
  return ok({ message: 'Ticket created.', item: row });
}

export async function createBulkTickets(ticketList = []) {
  if (!Array.isArray(ticketList) || !ticketList.length) return fail('At least one ticket is required.');
  const creatorId = first(ticketList[0], ['Creator ID', 'createdBy', 'Created By']);
  if (creatorId) {
    const gate = await requireAttendanceActive(creatorId);
    if (gate) return gate;
  }
  const created = [];
  for (const ticketData of ticketList) {
    const result = await createTicket(ticketData);
    if (!result.success) return result;
    created.push(result.item);
  }
  return ok({ message: `${created.length} tickets created successfully.`, data: created, items: created });
}

export async function updateTicket(ticketId, updateData = {}) {
  const scope = await getTicketScope(ticketId, updateData.updatedBy || updateData['Updated By'], updateData.role);
  if (scope.error) return scope.error;
  const { data, ticket } = scope;

  const newStatus = updateData.newStatus || updateData.Status;
  const updatedBy = safe(updateData.updatedBy || updateData['Updated By'] || updateData.employeeId || '');
  const actor = data.users.find((user) => eq(user['Employee ID'], updatedBy));
  const actorName = actor?.['Employee Name'] || updatedBy || 'System';
  const now = referenceNow();
  const update = {
    'Ticket ID': ticketId,
    'Last Update Date': nowIso(now),
    'Last Action By': actorName
  };
  let finalStatus = newStatus || ticket.Status;
  let historyAction = finalStatus || 'Update';
  const systemRemarks = [];
  let closingAttachments = [];
  if (Array.isArray(updateData.attachment)) {
    for (const item of updateData.attachment) {
      if (!item) continue;
      closingAttachments.push(item?.base64 ? await saveBase64File(item, 'ticket_closing_attachments') : safe(item));
    }
  } else if (updateData.attachment?.base64) {
    closingAttachments = [await saveBase64File(updateData.attachment, 'ticket_closing_attachments')];
  } else if (safe(updateData.attachment)) {
    closingAttachments = [safe(updateData.attachment)];
  }
  if (closingAttachments.length) update['Closing Attachment'] = closingAttachments.join(',');

  if (newStatus === 'In Progress') {
    const gate = await requireAttendanceActive(updatedBy);
    if (gate) return gate;
    const runningTicket = data.tickets.find((item) =>
      eq(item['Employee ID'], updatedBy) && safe(item.Status) === 'In Progress' && !eq(item['Ticket ID'], ticketId)
    );
    if (runningTicket) return fail(`Aapka ek ticket already chal raha hai: [ID: ${runningTicket['Ticket ID']}]. Pehle use Pause ya Complete karein!`);
    update.Status = 'In Progress';
    update['Start Time'] = localTimeHms(now);
    finalStatus = 'In Progress';
    systemRemarks.push(`[System]: Work Resumed at ${update['Start Time']}.`);
  } else if (newStatus === 'Paused') {
    const session = addTicketSessionDuration(ticket['Total Duration'], ticket['Start Time'], now);
    update.Status = 'Paused';
    update['Total Duration'] = session.totalStr;
    finalStatus = 'Paused';
    systemRemarks.push(`[System]: Paused. Session: ${session.sessionMins} mins added.`);
  } else if (newStatus === 'Completed') {
    const session = addTicketSessionDuration(ticket['Total Duration'], ticket['Start Time'], now);
    update['Total Duration'] = session.totalStr;
    update['End Time'] = localTimeHms(now);
    update['Actual Date'] = localDate(now);
    const ticketOwner = data.users.find((user) => eq(user['Employee ID'], ticket['Employee ID']));
    const firstApprover =
      safe(ticketOwner?.['Task Approver'] || ticketOwner?.['Manager ID'] || ticketOwner?.Manager)
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)[0] || '';
    
    const updater = data.users.find((user) => eq(user['Employee ID'], updatedBy));
    const isSuperAdmin = safe(updater?.Role).toLowerCase() === 'super admin';

    if ((!firstApprover || eq(firstApprover, updatedBy)) && !isSuperAdmin) {
      update.Status = 'Closed';
      update['Close Date'] = nowIso(now);
      finalStatus = 'Closed';
      systemRemarks.push(`[System]: Completed. Final Session: ${session.sessionMins} mins.`);
      systemRemarks.push(firstApprover ? '[System]: Auto-Approved & Closed (Action by Approver).' : '[System]: Auto-Approved & Closed (No Approver assigned).');
    } else {
      update.Status = 'Pending Approval';
      finalStatus = 'Pending Approval';
      systemRemarks.push(`[System]: Completed. Final Session: ${session.sessionMins} mins.`);
    }
  } else if (newStatus) {
    update.Status = newStatus;
  }

  const userRemark = updateData.newRemarks || updateData.Remarks || updateData.remarks || '';
  const remarkParts = [];
  if (userRemark) {
    remarkParts.push(`[${actorName} - ${now.toLocaleString('en-IN', { timeZone: TICKET_TIME_ZONE })}]: ${userRemark}`);
  }
  if (systemRemarks.length) remarkParts.push(...systemRemarks);
  if (remarkParts.length) update.Remarks = `${ticket.Remarks || ''}${ticket.Remarks ? '\n' : ''}${remarkParts.join('\n')}`;

  const row = await upsertRow('Ticket', 'Ticket ID', ticketId, update);
  if (newStatus || remarkParts.length) {
    await insertRow('TicketHistory', {
      'History ID': `HIST_${Date.now()}`,
      'Ticket ID': ticketId,
      ActionBy: actorName,
      ActionType: historyAction,
      Remarks: remarkParts.join('\n'),
      Timestamp: nowIso(now)
    });
  }
  return ok({ message: 'Ticket updated.', item: row, finalStatus });
}

export async function updateTicketSchedule(ticketId, newTAT, newPlanDate, reason, empId, role) {
  const gate = await requireAttendanceActive(empId);
  if (gate) return gate;
  const scope = await getTicketScope(ticketId, empId, role);
  if (scope.error) return scope.error;
  const row = await upsertRow('Ticket', 'Ticket ID', ticketId, {
    'Ticket ID': ticketId,
    TAT: newTAT,
    'Plan Date': newPlanDate,
    Remarks: `[[TAT/Date Updated by ${empId}]] ${reason || ''}`,
    'Last Update Date': nowIso()
  });
  return ok({ message: 'Schedule updated.', item: row });
}

export async function reassignTicket(ticketId, reassignToId, reassignById, remarks = '', role) {
  const gate = await requireAttendanceActive(reassignById);
  if (gate) return gate;
  const scope = await getTicketScope(ticketId, reassignById, role);
  if (scope.error) return scope.error;
  const { data, ticket } = scope;
  const targetId = safe(reassignToId);
  if (targetId.toLowerCase() !== 'client') {
    const target = data.users.find((user) => eq(userId(user), targetId) && eq(first(user, ['Status', 'status'], 'Active'), 'Active'));
    if (!target) return fail('User not found or inactive.');
    if (!assignableIdsFor(reassignById, role, data.users).includes(targetId.toLowerCase())) {
      return fail('You can only reassign tickets to yourself or your permitted team members.');
    }
  }
  const preserveClientOrigin = isClientOriginTicket(ticket)
    ? {
        Source: first(ticket, ['Source', 'source', 'Ticket Source', 'ticketSource'], 'Client Portal'),
        'Ticket Source': first(ticket, ['Ticket Source', 'ticketSource', 'Source', 'source'], 'Client Portal'),
        Origin: first(ticket, ['Origin', 'origin'], 'Client'),
        'Client Ticket': first(ticket, ['Client Ticket', 'clientTicket', 'Is Client Ticket', 'isClientTicket'], 'Yes')
      }
    : {};
  const row = await upsertRow('Ticket', 'Ticket ID', ticketId, {
    'Ticket ID': ticketId,
    'Employee ID': safe(reassignToId).toLowerCase() === 'client' ? '' : reassignToId,
    'Reassigned By': reassignById,
    Status: safe(reassignToId).toLowerCase() === 'client' ? 'Pending Client Response' : 'Reassigned',
    Remarks: remarks,
    'Last Update Date': nowIso(),
    ...preserveClientOrigin
  });
  await insertRow('TicketHistory', {
    'History ID': `HIST_${Date.now()}`,
    'Ticket ID': ticketId,
    ActionBy: reassignById,
    ActionType: 'Reassigned',
    Remarks: remarks,
    Timestamp: nowIso()
  });
  return ok({ message: 'Ticket reassigned.', item: row });
}

export async function processClientResponse(ticketId, clientResponse, newPlanDate, attachment, employeeId, role) {
  const scope = await getTicketScope(ticketId, employeeId, role);
  if (scope.error) return scope.error;
  const { ticket } = scope;
  const attachmentUrl = attachment?.base64 ? await saveBase64File(attachment, 'client_responses') : safe(attachment);
  const originalAssignee = first(ticket, ['Reassigned By', 'Employee ID', 'employeeId']);
  const remark = `\n\n[[Client Responded on ${referenceNow().toLocaleString('en-IN', { timeZone: TICKET_TIME_ZONE })}]]\n${clientResponse || ''}${attachmentUrl ? `\nAttachment: ${attachmentUrl}` : ''}`;
  const row = await upsertRow('Ticket', 'Ticket ID', ticketId, {
    'Ticket ID': ticketId,
    Status: 'Client Responded',
    'Employee ID': originalAssignee,
    'Last Action By': 'Client',
    'Plan Date': newPlanDate || '',
    Remarks: `${ticket.Remarks || ''}${remark}`,
    'Closing Attachment': attachmentUrl || first(ticket, ['Closing Attachment']),
    HasUnreadAdminMessages: true,
    'Last Update Date': nowIso()
  });
  await insertRow('TicketHistory', {
    'History ID': `HIST_${Date.now()}`,
    'Ticket ID': ticketId,
    ActionBy: 'Client',
    ActionType: 'Client Response',
    Remarks: clientResponse || '',
    Attachment: attachmentUrl,
    Timestamp: nowIso()
  });
  return ok({ message: 'Client response processed.', item: row });
}

export async function getTaskMessages(taskId, employeeId, role) {
  const scope = await getTicketMessageScope(taskId, employeeId, role);
  if (scope.error) return scope.error;
  const messages = await findRowsByFilter(
    'Message',
    { 'data.TaskID': taskId },
    {
      projection: { data: 1, legacyId: 1 },
      sort: { 'data.Timestamp': 1, createdAt: 1 }
    }
  );
  return ok({ data: messages, messages });
}

export async function postTaskMessage(taskId, messageText, employeeId, role) {
  const scope = await getTicketMessageScope(taskId, employeeId, role);
  if (scope.error) return scope.error;
  const gate = await requireAttendanceActive(employeeId);
  if (gate) return gate;
  const user = await findOneRowByFilter(
    'User',
    userIdentityQuery(employeeId),
    {
      projection: {
        legacyId: 1,
        'data.Employee ID': 1,
        'data.Employee Name': 1,
        'data.Name': 1,
        'data.Full Name': 1
      }
    }
  );
  const row = {
    MessageID: `MSG_${Date.now()}`,
    TaskID: taskId,
    Timestamp: nowIso(),
    Sender: user?.['Employee Name'] || employeeId,
    'Sender Type': 'employee',
    'Sender ID': employeeId,
    Message: messageText
  };
  await insertRow('Message', row);
  await upsertRow('Ticket', 'Ticket ID', taskId, {
    'Ticket ID': taskId,
    HasUnreadMessages: true,
    'Last Update Date': row.Timestamp,
    'Last Action By': row.Sender
  });
  return ok({ item: row });
}

export async function markTicketMessagesAsRead(taskId, clientId = '', employeeId = '', role = '') {
  if (employeeId) {
    const scope = await getTicketMessageScope(taskId, employeeId, role);
    if (scope.error) return scope.error;
  }
  const row = await upsertRow('Ticket', 'Ticket ID', taskId, {
    'Ticket ID': taskId,
    ...(clientId ? { HasUnreadMessages: false } : { HasUnreadAdminMessages: false })
  });
  return ok({ item: row });
}

export function primeTicketWorkspaceCaches(employeeId, role) {
  const normalizedRole = safe(role).toLowerCase();
  const jobs = [
    getTicketSystemData(employeeId, role, {
      viewMode: 'my',
      page: 1,
      pageSize: 10,
      filters: {
        clientIds: [],
        statuses: [],
        search: '',
        timePeriod: 'All Time'
      }
    }).catch(() => null)
  ];

  if (['super admin', 'admin', 'manager', 'hr'].includes(normalizedRole)) {
    jobs.push(
      getTicketSystemData(employeeId, role, {
        viewMode: 'team',
        page: 1,
        pageSize: 10,
        filters: {
          clientIds: [],
          statuses: [],
          search: '',
          timePeriod: 'All Time'
        }
      }).catch(() => null)
    );
  }

  return Promise.allSettled(jobs);
}

export async function saveAutoTicket(payload) {
  const ticketId = payload['Ticket ID'] || payload.legacyId || `TKT_${Date.now()}`;
  const now = referenceNow();
  const finalPayload = {
    ...payload,
    'Ticket ID': ticketId,
    'Last Update Date': nowIso(now)
  };
  if (!payload['Ticket ID'] && !payload.legacyId) {
    finalPayload.Timestamp = nowIso(now);
    finalPayload['Created By'] = payload['Created By'] || 'System';
  }
  const row = await upsertRow('Ticket', 'Ticket ID', ticketId, finalPayload);
  return ok({ message: 'Auto Ticket saved.', item: row });
}

export async function deleteAutoTicket(ticketId) {
  if (!ticketId) return fail('Ticket ID is required to delete an Auto Ticket');
  await deleteRow('Ticket', 'Ticket ID', ticketId);
  return ok({ message: 'Auto Ticket deleted successfully.' });
}
