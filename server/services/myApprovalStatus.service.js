import { LegacyModels } from '../models/legacyModels.js';
import { registerStoreMutationListener, stripInternalMetadata } from './legacyStore.service.js';
import { buildRedisKey, deleteByPrefix, getJson, setJson } from './redisCache.service.js';

const MY_APPROVAL_STATUS_CACHE_TTL_MS = Number(process.env.MY_APPROVAL_STATUS_CACHE_TTL_MS || 15000);
const myApprovalStatusCache = new Map();
let myApprovalStatusCacheVersion = 0;

function safe(value) {
  return String(value ?? '').trim();
}

function eq(left, right) {
  return safe(left).toUpperCase() === safe(right).toUpperCase();
}

function first(row = {}, keys = [], fallback = '') {
  for (const key of keys) {
    const value = row?.[key];
    if (safe(value)) return value;
  }
  return fallback;
}

function parseDateValue(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  const direct = new Date(value);
  if (!Number.isNaN(direct.getTime())) return direct;

  const text = safe(value);
  const parts = text.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/);
  if (!parts) return null;
  let year = Number(parts[3]);
  if (year < 100) year += 2000;
  const parsed = new Date(year, Number(parts[2]) - 1, Number(parts[1]));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDateLabel(value) {
  const parsed = parseDateValue(value);
  if (!parsed) return safe(value) || '-';
  return parsed.toLocaleDateString('en-GB');
}

function statusTone(status = '') {
  const value = safe(status).toLowerCase();
  if (!value || value === '-') return 'neutral';
  if (/(approved|closed|hr approved)/i.test(value)) return 'success';
  if (/(rejected|rework)/i.test(value)) return 'danger';
  if (/(pending|submitted|need approval|waiting)/i.test(value)) return 'warning';
  return 'info';
}

function statusSortValue(status = '') {
  const value = safe(status).toLowerCase();
  if (/(pending|submitted|need approval|waiting)/i.test(value)) return 0;
  if (/(approved|closed|hr approved)/i.test(value)) return 1;
  if (/(rejected|rework)/i.test(value)) return 2;
  return 3;
}

function sortStamp(row) {
  return parseDateValue(row.sortDate)?.getTime() || 0;
}

function stableId(prefix, row, keys) {
  return safe(first(row, keys)) || `${prefix}_${safe(first(row, ['employeeId', 'Employee ID', 'EmpID'], 'UNKNOWN'))}_${safe(first(row, ['date', 'Date', 'startDate', 'Start Date', 'planDate', 'Plan Date'], 'NO_DATE'))}`;
}

function fromLegacyDocs(docs = []) {
  return docs.map((doc) => ({
    ...stripInternalMetadata(doc.data || {}),
    _id: String(doc._id),
    _legacyId: doc.legacyId
  }));
}

async function listDataRows(modelName, query = {}, projection = { data: 1, legacyId: 1 }, options = {}) {
  const cursor = LegacyModels[modelName].collection.find(query, { projection });
  if (options.sort) cursor.sort(options.sort);
  if (Number.isFinite(options.skip) && options.skip > 0) cursor.skip(options.skip);
  if (Number.isFinite(options.limit) && options.limit > 0) cursor.limit(options.limit);
  const docs = await cursor.toArray();
  return fromLegacyDocs(docs);
}

function employeeQuery(employeeId) {
  return {
    $or: [
      { 'data.Employee ID': employeeId },
      { 'data.EmpID': employeeId },
      { 'data.employeeId': employeeId },
      { 'data.User ID': employeeId }
    ]
  };
}

function andQuery(...parts) {
  const filtered = parts.filter(Boolean);
  if (!filtered.length) return {};
  if (filtered.length === 1) return filtered[0];
  return { $and: filtered };
}

function orRegexQuery(fields = [], pattern = '') {
  if (!safe(pattern) || !fields.length) return null;
  return {
    $or: fields.map((field) => ({
      [field]: { $regex: pattern, $options: 'i' }
    }))
  };
}

function dateRangeQuery(fields = [], startDate = '', endDate = '') {
  const start = safe(startDate);
  const end = safe(endDate);
  if ((!start && !end) || !fields.length) return null;
  const lowerBound = start || '0000-01-01';
  const upperDate = end || '9999-12-31';
  const upperBound = `${upperDate}T23:59:59.999Z`;
  return {
    $or: fields.map((field) => ({
      [field]: { $gte: lowerBound, $lte: upperBound }
    }))
  };
}

function countStatusQuery(fields = [], pattern = '') {
  return orRegexQuery(fields, pattern);
}

function clearExpiredCache() {
  const now = Date.now();
  for (const [cacheKey, entry] of myApprovalStatusCache.entries()) {
    if (now - entry.createdAt >= MY_APPROVAL_STATUS_CACHE_TTL_MS) {
      myApprovalStatusCache.delete(cacheKey);
    }
  }
}

function getCachedPayload(cacheKey) {
  clearExpiredCache();
  const entry = myApprovalStatusCache.get(cacheKey);
  if (!entry) return null;
  if (Date.now() - entry.createdAt >= MY_APPROVAL_STATUS_CACHE_TTL_MS) {
    myApprovalStatusCache.delete(cacheKey);
    return null;
  }
  return entry.payload;
}

function setCachedPayload(cacheKey, payload) {
  const entry = { createdAt: Date.now(), payload };
  myApprovalStatusCache.set(cacheKey, entry);
  void setJson(myApprovalRedisKey(cacheKey), entry, MY_APPROVAL_STATUS_CACHE_TTL_MS);
}

function myApprovalRedisKey(cacheKey) {
  return buildRedisKey('my-approval-status', `v${myApprovalStatusCacheVersion}`, cacheKey);
}

async function getCachedPayloadWithRedis(cacheKey) {
  clearExpiredCache();
  const entry = myApprovalStatusCache.get(cacheKey);
  if (entry && Date.now() - entry.createdAt < MY_APPROVAL_STATUS_CACHE_TTL_MS) {
    return entry.payload;
  }
  const redisCached = await getJson(myApprovalRedisKey(cacheKey));
  if (redisCached && Date.now() - Number(redisCached.createdAt || 0) < MY_APPROVAL_STATUS_CACHE_TTL_MS) {
    myApprovalStatusCache.set(cacheKey, redisCached);
    return redisCached.payload;
  }
  return null;
}

export function clearMyApprovalStatusCache(employeeId = '') {
  if (employeeId) {
    const prefix = `${safe(employeeId).toLowerCase()}::`;
    for (const key of myApprovalStatusCache.keys()) {
      if (key.startsWith(prefix)) myApprovalStatusCache.delete(key);
    }
    void deleteByPrefix(buildRedisKey('my-approval-status', `v${myApprovalStatusCacheVersion}`, prefix));
    return;
  }
  myApprovalStatusCacheVersion += 1;
  myApprovalStatusCache.clear();
}

registerStoreMutationListener(() => {
  clearMyApprovalStatusCache();
});

const statusFields = ['data.Status', 'data.status', 'data.Admin Approval', 'data.adminApproval'];

const leaveProjection = {
  legacyId: 1,
  'data.LeaveID': 1,
  'data.Leave ID': 1,
  'data.ID': 1,
  'data.leaveId': 1,
  'data.Employee ID': 1,
  'data.employeeId': 1,
  'data.EmpID': 1,
  'data.User ID': 1,
  'data.Leave Type': 1,
  'data.type': 1,
  'data.leaveType': 1,
  'data.Start Date': 1,
  'data.startDate': 1,
  'data.date': 1,
  'data.Reason': 1,
  'data.reason': 1,
  'data.Status': 1,
  'data.status': 1,
  'data.Admin Approval': 1,
  'data.adminApproval': 1,
  'data.Admin Remarks': 1,
  'data.adminRemarks': 1,
  'data.remarks': 1
};

const intimationProjection = {
  legacyId: 1,
  'data.IntimationID': 1,
  'data.Intimation ID': 1,
  'data.ID': 1,
  'data.intimationId': 1,
  'data.Employee ID': 1,
  'data.employeeId': 1,
  'data.EmpID': 1,
  'data.User ID': 1,
  'data.Intimation Type': 1,
  'data.type': 1,
  'data.intimationType': 1,
  'data.Intimation Date': 1,
  'data.date': 1,
  'data.intimationDate': 1,
  'data.Reason': 1,
  'data.reason': 1,
  'data.Status': 1,
  'data.status': 1,
  'data.Admin Approval': 1,
  'data.adminApproval': 1,
  'data.Admin Remarks': 1,
  'data.adminRemarks': 1,
  'data.remarks': 1
};

const attendanceProjection = {
  legacyId: 1,
  'data.AttendanceID': 1,
  'data.attendanceId': 1,
  'data.ID': 1,
  'data.Employee ID': 1,
  'data.employeeId': 1,
  'data.EmpID': 1,
  'data.User ID': 1,
  'data.Action': 1,
  'data.action': 1,
  'data.Date': 1,
  'data.date': 1,
  'data.Status': 1,
  'data.status': 1,
  'data.Admin Approval': 1,
  'data.adminApproval': 1,
  'data.Admin Remarks': 1,
  'data.adminRemarks': 1,
  'data.Remarks': 1,
  'data.remarks': 1
};

const ticketProjection = {
  legacyId: 1,
  'data.Ticket ID': 1,
  'data.Task ID': 1,
  'data.ticketId': 1,
  'data.taskId': 1,
  'data.ID': 1,
  'data.Employee ID': 1,
  'data.employeeId': 1,
  'data.EmpID': 1,
  'data.User ID': 1,
  'data.Task Category': 1,
  'data.Category': 1,
  'data.category': 1,
  'data.Plan Date': 1,
  'data.planDate': 1,
  'data.Date': 1,
  'data.date': 1,
  'data.Timestamp': 1,
  'data.timestamp': 1,
  'data.Task Description': 1,
  'data.Description': 1,
  'data.description': 1,
  'data.Status': 1,
  'data.status': 1,
  'data.Remarks': 1,
  'data.remarks': 1
};

const tabSpecs = {
  leaves: {
    modelName: 'Leave',
    projection: leaveProjection,
    sort: { 'data.Start Date': -1, 'data.startDate': -1, 'data.date': -1, createdAt: -1 },
    dateFields: ['data.Start Date', 'data.startDate', 'data.date'],
    searchFields: ['data.Leave Type', 'data.type', 'data.leaveType', 'data.Reason', 'data.reason', 'data.Status', 'data.status', 'data.Admin Approval', 'data.adminApproval', 'data.Admin Remarks', 'data.adminRemarks', 'data.remarks'],
    pendingQuery: countStatusQuery(statusFields, 'pending'),
    approvedQuery: countStatusQuery(statusFields, 'approved|closed|hr approved'),
    rejectedQuery: countStatusQuery(statusFields, 'rejected|rework'),
    relevanceQuery: null,
    mapRow: (row) => ({
      id: stableId('leave', row, ['LeaveID', 'Leave ID', 'leaveId', 'ID']),
      Type: 'Leave',
      SubType: safe(first(row, ['Leave Type', 'type', 'leaveType'])) || '-',
      Date: formatDateLabel(first(row, ['Start Date', 'startDate', 'date'])),
      Reason: safe(first(row, ['Reason', 'reason'])) || '-',
      Status: safe(first(row, ['Status', 'status', 'Admin Approval', 'adminApproval'])) || 'Pending',
      Remarks: safe(first(row, ['Admin Remarks', 'adminRemarks', 'remarks'])) || '-',
      tone: statusTone(first(row, ['Status', 'status', 'Admin Approval', 'adminApproval'])),
      sortDate: first(row, ['Start Date', 'startDate', 'date'])
    })
  },
  intimations: {
    modelName: 'Intimation',
    projection: intimationProjection,
    sort: { 'data.Intimation Date': -1, 'data.intimationDate': -1, 'data.date': -1, createdAt: -1 },
    dateFields: ['data.Intimation Date', 'data.intimationDate', 'data.date'],
    searchFields: ['data.Intimation Type', 'data.type', 'data.intimationType', 'data.Reason', 'data.reason', 'data.Status', 'data.status', 'data.Admin Approval', 'data.adminApproval', 'data.Admin Remarks', 'data.adminRemarks', 'data.remarks'],
    pendingQuery: countStatusQuery(statusFields, 'pending|submitted|waiting'),
    approvedQuery: countStatusQuery(statusFields, 'approved|closed|hr approved'),
    rejectedQuery: countStatusQuery(statusFields, 'rejected|rework'),
    relevanceQuery: null,
    mapRow: (row) => ({
      id: stableId('intimation', row, ['IntimationID', 'Intimation ID', 'intimationId', 'ID']),
      Type: 'Intimation',
      SubType: safe(first(row, ['Intimation Type', 'type', 'intimationType'])) || '-',
      Date: formatDateLabel(first(row, ['Intimation Date', 'date', 'intimationDate'])),
      Reason: safe(first(row, ['Reason', 'reason'])) || '-',
      Status: safe(first(row, ['Status', 'status', 'Admin Approval', 'adminApproval'])) || 'Submitted',
      Remarks: safe(first(row, ['Admin Remarks', 'adminRemarks', 'remarks'])) || '-',
      tone: statusTone(first(row, ['Status', 'status', 'Admin Approval', 'adminApproval'])),
      sortDate: first(row, ['Intimation Date', 'date', 'intimationDate'])
    })
  },
  attendance: {
    modelName: 'Attendance',
    projection: attendanceProjection,
    sort: { 'data.Date': -1, 'data.date': -1, createdAt: -1 },
    dateFields: ['data.Date', 'data.date'],
    searchFields: ['data.Action', 'data.action', 'data.Status', 'data.status', 'data.Admin Approval', 'data.adminApproval', 'data.Admin Remarks', 'data.adminRemarks', 'data.Remarks', 'data.remarks'],
    pendingQuery: countStatusQuery(statusFields, 'need approval|pending|waiting'),
    approvedQuery: countStatusQuery(statusFields, 'approved|closed|hr approved'),
    rejectedQuery: countStatusQuery(statusFields, 'rejected|rework'),
    relevanceQuery: countStatusQuery(statusFields, 'need approval|pending|approved|rejected'),
    mapRow: (row) => ({
      id: stableId('attendance', row, ['AttendanceID', 'attendanceId', 'ID']),
      Type: 'Attendance',
      SubType: safe(first(row, ['Action', 'action'])) || 'Punch Approval',
      Date: formatDateLabel(first(row, ['Date', 'date'])),
      Reason: 'Punch Approval',
      Status: safe(first(row, ['Admin Approval', 'adminApproval', 'Status', 'status'])) || 'Pending',
      Remarks: safe(first(row, ['Admin Remarks', 'adminRemarks', 'Remarks', 'remarks'])) || '-',
      tone: statusTone(first(row, ['Admin Approval', 'adminApproval', 'Status', 'status'])),
      sortDate: first(row, ['Date', 'date'])
    })
  },
  tickets: {
    modelName: 'Ticket',
    projection: ticketProjection,
    sort: { 'data.Plan Date': -1, 'data.planDate': -1, 'data.Date': -1, 'data.Timestamp': -1, createdAt: -1 },
    dateFields: ['data.Plan Date', 'data.planDate', 'data.Date', 'data.date', 'data.Timestamp', 'data.timestamp'],
    searchFields: ['data.Task Category', 'data.Category', 'data.category', 'data.Task Description', 'data.Description', 'data.description', 'data.Status', 'data.status', 'data.Remarks', 'data.remarks'],
    pendingQuery: countStatusQuery(statusFields, 'pending approval|waiting'),
    approvedQuery: countStatusQuery(statusFields, 'approved|closed|hr approved'),
    rejectedQuery: countStatusQuery(statusFields, 'rejected|rework'),
    relevanceQuery: countStatusQuery(statusFields, 'pending approval|approved|closed|hr approved|rejected|rework|reassign|reassigned'),
    mapRow: (row) => ({
      id: stableId('ticket', row, ['Ticket ID', 'Task ID', 'ticketId', 'taskId', 'ID']),
      Type: 'Ticket',
      SubType: safe(first(row, ['Task Category', 'Category', 'category'])) || '-',
      Date: formatDateLabel(first(row, ['Plan Date', 'planDate', 'Date', 'date', 'Timestamp', 'timestamp'])),
      Reason: safe(first(row, ['Task Description', 'Description', 'description'])) || '-',
      Status: safe(first(row, ['Status', 'status'])) || '-',
      Remarks: safe(first(row, ['Remarks', 'remarks'])) || '-',
      tone: statusTone(first(row, ['Status', 'status'])),
      sortDate: first(row, ['Plan Date', 'planDate', 'Date', 'date', 'Timestamp', 'timestamp'])
    })
  }
};

function tableStatusQuery(tab, status = '') {
  const normalized = safe(status).toLowerCase();
  if (!normalized) return null;
  const spec = tabSpecs[tab];
  if (!spec) return null;
  if (normalized === 'pending') return spec.pendingQuery;
  if (normalized === 'approved') return spec.approvedQuery;
  if (normalized === 'rejected') return spec.rejectedQuery;
  return null;
}

function buildRowsQuery(employeeId, tab, filters = {}) {
  const spec = tabSpecs[tab] || tabSpecs.tickets;
  return andQuery(
    employeeQuery(employeeId),
    spec.relevanceQuery,
    tableStatusQuery(tab, filters.status),
    dateRangeQuery(spec.dateFields, filters.startDate, filters.endDate),
    orRegexQuery(spec.searchFields, safe(filters.search))
  );
}

function cacheKeyForSummary(employeeId) {
  return `${safe(employeeId).toLowerCase()}::summary`;
}

function cacheKeyForRows(employeeId, tab, filters, page, pageSize) {
  return `${safe(employeeId).toLowerCase()}::rows::${safe(tab)}::${JSON.stringify(filters || {})}::${page}::${pageSize}`;
}

async function countForSpec(employeeId, tab) {
  const spec = tabSpecs[tab];
  const base = andQuery(employeeQuery(employeeId), spec.relevanceQuery);
  const [total, pending, approved, rejected] = await Promise.all([
    LegacyModels[spec.modelName].countDocuments(base),
    LegacyModels[spec.modelName].countDocuments(andQuery(base, spec.pendingQuery)),
    LegacyModels[spec.modelName].countDocuments(andQuery(base, spec.approvedQuery)),
    LegacyModels[spec.modelName].countDocuments(andQuery(base, spec.rejectedQuery))
  ]);
  return { total, pending, approved, rejected };
}

async function getMyApprovalSummary(employeeId) {
  const cacheKey = cacheKeyForSummary(employeeId);
  const cached = await getCachedPayloadWithRedis(cacheKey);
  if (cached) return cached;

  const [tickets, leaves, intimations, attendance] = await Promise.all([
    countForSpec(employeeId, 'tickets'),
    countForSpec(employeeId, 'leaves'),
    countForSpec(employeeId, 'intimations'),
    countForSpec(employeeId, 'attendance')
  ]);

  const payload = {
    success: true,
    data: {
      summary: {
        total: tickets.total + leaves.total + intimations.total + attendance.total,
        pending: tickets.pending + leaves.pending + intimations.pending + attendance.pending,
        approved: tickets.approved + leaves.approved + intimations.approved + attendance.approved,
        actionNeeded: tickets.rejected + leaves.rejected + intimations.rejected + attendance.rejected
      },
      counts: {
        tickets: tickets.total,
        leaves: leaves.total,
        intimations: intimations.total,
        attendance: attendance.total
      }
    }
  };

  setCachedPayload(cacheKey, payload);
  return payload;
}

async function getLegacyMyApprovalStatusList(employeeId) {
  const cacheKey = `${safe(employeeId).toLowerCase()}::legacy`;
  const cached = await getCachedPayloadWithRedis(cacheKey);
  if (cached) return cached;

  const tabs = ['tickets', 'leaves', 'intimations', 'attendance'];
  const tabRows = await Promise.all(
    tabs.map(async (tab) => {
      const spec = tabSpecs[tab];
      const query = andQuery(employeeQuery(employeeId), spec.relevanceQuery);
      const sourceRows = await listDataRows(spec.modelName, query, spec.projection, { sort: spec.sort });
      return sourceRows
        .filter((row) => eq(first(row, ['Employee ID', 'EmpID', 'employeeId', 'User ID']), employeeId))
        .map(spec.mapRow);
    })
  );

  const payload = {
    success: true,
    data: tabRows
      .flat()
      .sort((left, right) => {
        const dateDelta = sortStamp(right) - sortStamp(left);
        if (dateDelta !== 0) return dateDelta;
        return statusSortValue(left.Status) - statusSortValue(right.Status);
      })
  };

  setCachedPayload(cacheKey, payload);
  return payload;
}

async function getMyApprovalRows(employeeId, options = {}) {
  const tab = ['tickets', 'leaves', 'intimations', 'attendance'].includes(safe(options.tab).toLowerCase())
    ? safe(options.tab).toLowerCase()
    : 'tickets';
  const page = Math.max(1, Number(options.page || 1) || 1);
  const pageSize = Math.min(50, Math.max(20, Number(options.pageSize || 20) || 20));
  const filters = {
    status: safe(options.filters?.status),
    startDate: safe(options.filters?.startDate),
    endDate: safe(options.filters?.endDate),
    search: safe(options.filters?.search)
  };

  const cacheKey = cacheKeyForRows(employeeId, tab, filters, page, pageSize);
  const cached = await getCachedPayloadWithRedis(cacheKey);
  if (cached) return cached;

  const spec = tabSpecs[tab];
  const query = buildRowsQuery(employeeId, tab, filters);
  const total = await LegacyModels[spec.modelName].countDocuments(query);
  const skip = (page - 1) * pageSize;
  const sourceRows = await listDataRows(spec.modelName, query, spec.projection, {
    sort: spec.sort,
    skip,
    limit: pageSize
  });

  const rows = sourceRows
    .filter((row) => eq(first(row, ['Employee ID', 'EmpID', 'employeeId', 'User ID']), employeeId))
    .map(spec.mapRow)
    .sort((left, right) => {
      const dateDelta = sortStamp(right) - sortStamp(left);
      if (dateDelta !== 0) return dateDelta;
      return statusSortValue(left.Status) - statusSortValue(right.Status);
    });

  const payload = {
    success: true,
    data: {
      tab,
      rows,
      pagination: {
        page,
        pageSize,
        total,
        hasMore: skip + rows.length < total
      }
    }
  };

  setCachedPayload(cacheKey, payload);
  return payload;
}

export async function getMyApprovalStatus(employeeId, options = {}) {
  const targetEmployeeId = safe(employeeId);
  if (!targetEmployeeId) {
    return { success: false, message: 'Employee ID is required.' };
  }

  const mode = safe(options.mode).toLowerCase();
  if (!mode) {
    return getLegacyMyApprovalStatusList(targetEmployeeId);
  }
  if (mode === 'rows') {
    return getMyApprovalRows(targetEmployeeId, options);
  }
  if (mode === 'all') {
    const [summaryResult, rowsResult] = await Promise.all([
      getMyApprovalSummary(targetEmployeeId),
      getMyApprovalRows(targetEmployeeId, options)
    ]);
    return {
      success: true,
      data: {
        ...(summaryResult.data || {}),
        ...(rowsResult.data || {})
      }
    };
  }
  return getMyApprovalSummary(targetEmployeeId);
}
