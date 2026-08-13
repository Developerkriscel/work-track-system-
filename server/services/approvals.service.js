import { insertRow, listRows, registerStoreMutationListener, sheetAttendance, upsertRow } from './legacyStore.service.js';
import { checkUserAttendanceActive } from './attendance.service.js';
import { LegacyModels } from '../models/legacyModels.js';
import { stripInternalMetadata } from './legacyStore.service.js';
import { buildRedisKey, getJson, setJson } from './redisCache.service.js';

const APPROVAL_QUEUE_CACHE_TTL_MS = Number(process.env.WORKTRACK_APPROVAL_QUEUE_CACHE_TTL_MS || 10000);
const approvalQueueCache = new Map();
let approvalQueueCacheVersion = 0;
let taskApproversCache = null;
const safe = (value = '') => String(value ?? '').trim();
const eq = (left, right) => safe(left).toLowerCase() === safe(right).toLowerCase();
const first = (row, keys, fallback = '') => keys.map((key) => row?.[key]).find((value) => safe(value)) ?? fallback;
const ok = (payload = {}) => ({ success: true, ...payload });
const fail = (message) => ({ success: false, message });

function parseReferenceNow(value) {
  if (!value) return new Date();
  if (String(value).includes('T')) return new Date(value);
  return new Date(`${value}T12:00:00+05:30`);
}

const referenceNow = () => parseReferenceNow(process.env.WORKTRACK_REFERENCE_DATE);

function localDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function today() {
  return localDate(referenceNow());
}

function nowIso() {
  return referenceNow().toISOString();
}

function normalizedDate(value) {
  if (!value) return today();
  const raw = safe(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const dmy = raw.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);
  if (dmy) return `${dmy[3]}-${String(dmy[2]).padStart(2, '0')}-${String(dmy[1]).padStart(2, '0')}`;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? raw : parsed.toISOString().slice(0, 10);
}

const elevatedRoles = new Set(['admin', 'super admin', 'hr', 'manager']);

function clearApprovalQueueCache() {
  approvalQueueCacheVersion += 1;
  approvalQueueCache.clear();
  taskApproversCache = null;
}

registerStoreMutationListener(() => {
  clearApprovalQueueCache();
});

function approvalQueueRedisKey(cacheKey) {
  return buildRedisKey('approvals', `v${approvalQueueCacheVersion}`, cacheKey);
}

function clearExpiredApprovalCache() {
  const now = Date.now();
  for (const [cacheKey, entry] of approvalQueueCache.entries()) {
    if (now - entry.createdAt >= APPROVAL_QUEUE_CACHE_TTL_MS) {
      approvalQueueCache.delete(cacheKey);
    }
  }
}

async function getCachedApprovalPayload(cacheKey) {
  clearExpiredApprovalCache();
  const entry = approvalQueueCache.get(cacheKey);
  if (entry && Date.now() - entry.createdAt < APPROVAL_QUEUE_CACHE_TTL_MS) {
    return entry.payload;
  }
  const redisCached = await getJson(approvalQueueRedisKey(cacheKey));
  if (redisCached && Date.now() - Number(redisCached.createdAt || 0) < APPROVAL_QUEUE_CACHE_TTL_MS) {
    approvalQueueCache.set(cacheKey, redisCached);
    return redisCached.payload;
  }
  return null;
}

function setCachedApprovalPayload(cacheKey, payload) {
  const entry = { createdAt: Date.now(), payload };
  approvalQueueCache.set(cacheKey, entry);
  void setJson(approvalQueueRedisKey(cacheKey), entry, APPROVAL_QUEUE_CACHE_TTL_MS);
}

function userId(user = {}) {
  return first(user, ['Employee ID', 'employeeId', 'User ID', 'EmpID']);
}

function userRole(user = {}) {
  return safe(first(user, ['Role', 'role'], 'User')).toLowerCase();
}

function assignedIds(value) {
  return safe(value).split(',').map((item) => item.trim().toLowerCase()).filter(Boolean);
}

function isHigherRoleProtected(admin, employee) {
  const adminRole = userRole(admin);
  const employeeRole = userRole(employee);
  return employeeRole === 'super admin' && adminRole !== 'super admin';
}

function canReviewEmployee(admin, employee, users) {
  const adminId = userId(admin).toUpperCase();
  const role = userRole(admin);
  const employeeRole = userRole(employee);
  if (!elevatedRoles.has(role)) return false;
  if (isHigherRoleProtected(admin, employee)) return false;
  if (role === 'super admin') return true;
  if (role === 'hr') return employeeRole !== 'super admin';
  const team = users.filter((user) => {
    const managers = assignedIds(first(user, ['Manager ID', 'Manager', 'managerId', 'Reporting Manager']));
    const approvers = assignedIds(first(user, ['Task Approver', 'taskApprover']));
    return managers.includes(adminId.toLowerCase()) || approvers.includes(adminId.toLowerCase());
  });
  return team.some((user) => eq(userId(user), userId(employee)));
}

function isPendingTicketStatus(status = '') {
  return /pending approval|hr approved/i.test(safe(status));
}

function isApprovalRelevantTicketStatus(status = '') {
  return /pending approval|hr approved|approved|closed|rework|reject|completed/i.test(safe(status));
}

function isPendingLeaveStatus(status = '') {
  return /^pending$/i.test(safe(status));
}

function isPendingIntimationStatus(status = '') {
  return /submitted|pending/i.test(safe(status));
}

function isPendingAttendanceStatus(status = '') {
  return /need approval|pending/i.test(safe(status));
}

function requestApprovalDecision(admin, row, users, type) {
  const role = userRole(admin);
  const employeeId = first(row, ['Employee ID', 'employeeId', 'EmpID']);
  const employee = users.find((user) => eq(userId(user), employeeId));
  const status = safe(first(row, ['Status', 'status']));
  if (employee && isHigherRoleProtected(admin, employee)) {
    return { visible: false, actionable: false, canApprove: false };
  }
  const canSeeEmployee =
    role === 'super admin' ||
    role === 'admin' ||
    (role === 'hr' && userRole(employee) !== 'super admin') ||
    (role === 'manager' && employee ? canReviewEmployee(admin, employee, users) : false);

  let pending = false;
  if (/leave/i.test(type)) pending = isPendingLeaveStatus(status);
  else if (/intimation/i.test(type)) pending = isPendingIntimationStatus(status);
  else if (/attendance/i.test(type)) pending = isPendingAttendanceStatus(status);

  if (/leave|intimation|attendance/i.test(type)) {
    if (!canSeeEmployee) {
      return { visible: false, actionable: false, canApprove: false };
    }

    if (pending) {
      return { visible: true, actionable: true, canApprove: true };
    }

    return { visible: true, actionable: false, canApprove: false };
  }

  if (!pending) {
    return { visible: false, actionable: false, canApprove: false };
  }

  if (role === 'super admin' || role === 'hr' || role === 'admin') {
    return { visible: true, actionable: true, canApprove: true };
  }

  if (role === 'manager') {
    const canSeeEmployee = employee ? canReviewEmployee(admin, employee, users) : false;
    if (!canSeeEmployee) {
      return { visible: false, actionable: false, canApprove: false };
    }
    return { visible: true, actionable: true, canApprove: true };
  }

  return { visible: false, actionable: false, canApprove: false };
}

function ticketApprovalDecision(admin, ticket, users) {
  const adminId = userId(admin).toUpperCase();
  const role = userRole(admin);
  const ownerId = safe(first(ticket, ['Employee ID', 'employeeId', 'EmpID'])).toUpperCase();
  const owner = users.find((user) => userId(user).toUpperCase() === ownerId);
  if (!owner) return { visible: false, actionable: false, canApprove: false };
  if (isHigherRoleProtected(admin, owner)) {
    return { visible: false, actionable: false, canApprove: false };
  }
  const ownTicket = ownerId === adminId;
  const taskApprover = safe(first(owner, ['Task Approver', 'taskApprover']));
  const managerId = safe(first(owner, ['Manager ID', 'Manager', 'managerId', 'Reporting Manager']));
  const designated = safe(taskApprover || managerId).split(',')[0].trim().toUpperCase();
  const reassignedTo = safe(first(ticket, ['Reassigned To', 'reassignedTo'])).toUpperCase();
  const isDesignated = (reassignedTo || designated) === adminId;
  const teamIds = users
    .filter((user) => assignedIds(first(user, ['Manager ID', 'Manager', 'managerId', 'Reporting Manager'])).includes(adminId.toLowerCase()) ||
      assignedIds(first(user, ['Task Approver', 'taskApprover'])).includes(adminId.toLowerCase()))
    .map((user) => userId(user).toUpperCase());
  const isTeamTicket = teamIds.includes(ownerId);
  const ownerDepartment = safe(first(owner, ['Department', 'department'])).toLowerCase();
  const isHrTicket = ownerDepartment === 'hr' || ownerDepartment.includes('hr intern') || ownerDepartment.includes('human resource');

  if (role === 'super admin') {
    // Super Admin is the global approval authority in the MERN panel. 
    return { visible: true, actionable: true, canApprove: true };
  }
  if (role === 'hr') {
    const actionable = !ownTicket && (isDesignated || isHrTicket);
    return { visible: true, actionable, canApprove: actionable };
  }
  if (role === 'manager' || role === 'admin') {
    const visible = isDesignated || isTeamTicket;
    const actionable = isDesignated && !ownTicket;
    return { visible, actionable, canApprove: actionable };
  }
  return { visible: false, actionable: false, canApprove: false };
}

function formatApprovalTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (!Number.isNaN(date.getTime()) && /T|GMT|UTC|\d{4}-\d{2}-\d{2}/i.test(String(value))) {
    return date.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false });
  }
  return safe(value) || '-';
}

function attendanceTimestamp(dateValue, timeValue) {
  const date = normalizedDate(dateValue);
  const raw = safe(timeValue);
  if (!raw) return '';
  const iso = new Date(raw);
  if (!Number.isNaN(iso.getTime()) && /T|GMT|UTC|\d{4}-\d{2}-\d{2}/i.test(raw)) return iso.toISOString();
  const match = raw.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (!match) return raw;
  let hour = Number(match[1]);
  if (match[4]?.toLowerCase() === 'pm' && hour < 12) hour += 12;
  if (match[4]?.toLowerCase() === 'am' && hour === 12) hour = 0;
  return new Date(`${date}T${String(hour).padStart(2, '0')}:${match[2]}:${match[3] || '00'}+05:30`).toISOString();
}

function durationBetween(inValue, outValue, dateValue) {
  const start = new Date(attendanceTimestamp(dateValue, inValue));
  const end = new Date(attendanceTimestamp(dateValue, outValue));
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) return '';
  const minutes = Math.floor((end - start) / 60000);
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function previewText(value, limit = 500) {
  const text = safe(value);
  if (text.length <= limit) return text;
  return `${text.slice(0, limit).trim()}...`;
}

function attendanceEventTime(row) {
  const date = normalizedDate(first(row, ['Date'], today()));
  const time = first(row, ['Time', 'Punch In', 'Punch Out']);
  const parsed = new Date(time || date);
  if (!Number.isNaN(parsed.getTime()) && /T|GMT|UTC|\d{4}-\d{2}-\d{2}/i.test(String(time || date))) return parsed.getTime();
  return new Date(`${date}T00:00:00+05:30`).getTime();
}

function leaveSignature(row = {}) {
  return [
    safe(first(row, ['Employee ID', 'employeeId', 'EmpID'])).toUpperCase(),
    safe(first(row, ['Leave Type', 'leaveType', 'type'])).toLowerCase(),
    safe(first(row, ['Day Type', 'dayType'])).toLowerCase(),
    safe(first(row, ['Reason', 'reason'])).toLowerCase(),
    safe(first(row, ['Status', 'status'])).toLowerCase(),
    safe(first(row, ['Timestamp', 'Last Update Date', 'timestamp'])).toLowerCase(),
    safe(first(row, ['Admin Remarks', 'Admin Approval', 'remarks'])).toLowerCase()
  ].join('|');
}

function leaveSortTime(row = {}) {
  const start = normalizedDate(first(row, ['Start Date', 'startDate']));
  const end = normalizedDate(first(row, ['End Date', 'endDate', 'Start Date', 'startDate']));
  const stamp = safe(first(row, ['Timestamp', 'Last Update Date', 'timestamp']));
  return new Date(`${start || end || '1970-01-01'}T00:00:00Z`).getTime() || new Date(stamp || 0).getTime();
}

function groupLeaveRows(rows = []) {
  const sorted = [...rows].sort((left, right) => {
    const startDiff = leaveSortTime(left) - leaveSortTime(right);
    if (startDiff) return startDiff;
    return safe(first(left, ['LeaveID', 'Leave ID', 'ID', 'leaveId'])).localeCompare(safe(first(right, ['LeaveID', 'Leave ID', 'ID', 'leaveId'])));
  });

  const groups = [];
  for (const row of sorted) {
    const startDate = normalizedDate(first(row, ['Start Date', 'startDate']));
    const endDate = normalizedDate(first(row, ['End Date', 'endDate', 'Start Date', 'startDate'])) || startDate;
    const key = leaveSignature(row);
    const last = groups[groups.length - 1];
    const lastEndDate = last ? normalizedDate(last['End Date'] || last.endDate || last.startDate) : '';
    const contiguous =
      last &&
      last._signature === key &&
      startDate &&
      lastEndDate &&
      new Date(`${startDate}T00:00:00Z`).getTime() <= new Date(`${lastEndDate}T00:00:00Z`).getTime() + 24 * 60 * 60 * 1000;

    if (contiguous) {
      last['End Date'] = endDate > lastEndDate ? endDate : lastEndDate;
      last.endDate = last['End Date'];
      last._leaveIds.push(safe(first(row, ['LeaveID', 'Leave ID', 'ID', 'leaveId'])));
      continue;
    }

    const leaveId = safe(first(row, ['LeaveID', 'Leave ID', 'ID', 'leaveId']));
    groups.push({
      ...row,
      LeaveID: leaveId,
      'Leave ID': leaveId,
      startDate,
      endDate,
      'Start Date': startDate,
      'End Date': endDate,
      _signature: key,
      _leaveIds: leaveId ? [leaveId] : []
    });
  }

  return groups.map((row) => {
    const groupedLeaveIds = row._leaveIds || [];
    const firstLeaveId = groupedLeaveIds[0] || safe(first(row, ['LeaveID', 'Leave ID', 'ID', 'leaveId']));
    return {
      ...row,
      LeaveID: firstLeaveId,
      'Leave ID': firstLeaveId,
      LeaveIDs: groupedLeaveIds,
      _groupedLeaveIds: groupedLeaveIds
    };
  });
}

function leaveApprovalMatchKey(row = {}) {
  return leaveSignature(row);
}

function findLeaveRowsForAction(leaveRows = [], targetRow = {}) {
  const targetId = safe(first(targetRow, ['LeaveID', 'Leave ID', 'ID', 'leaveId']));
  const targetKey = leaveApprovalMatchKey(targetRow);
  return leaveRows.filter((row) => {
    const rowId = safe(first(row, ['LeaveID', 'Leave ID', 'ID', 'leaveId']));
    return rowId === targetId || leaveApprovalMatchKey(row) === targetKey;
  });
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

async function requireAttendanceActive(employeeId) {
  if (!safe(employeeId) || eq(employeeId, 'client')) return null;
  const attendanceState = await checkUserAttendanceActive(employeeId);
  if (attendanceState.active) return null;
  return fail('Attendance Required: Aapne aaj ki Attendance (Punch In) mark nahi ki hai ya aap already Punch Out kar chuke hain. Kripya pehle Punch In karein!');
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
    Remarks: previewText(first(row, ['Remarks', 'remarks'])),
    TAT: first(row, ['TAT', 'When', 'tatMinutes']),
    When: first(row, ['When', 'TAT', 'tatMinutes']),
    'Task Approver': first(row, ['Task Approver', 'taskApprover', 'Approver ID']),
    'Reassigned By': first(row, ['Reassigned By', 'reassignedBy']),
    _remarksTruncated: safe(first(row, ['Remarks', 'remarks'])).length > 500
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

async function listDataRowsPaginated(
  modelName,
  query = {},
  {
    projection = { data: 1, legacyId: 1 },
    sort = { createdAt: -1 },
    skip = 0,
    limit = 20
  } = {}
) {
  const docs = await LegacyModels[modelName].collection
    .find(query, { projection })
    .sort(sort)
    .skip(Math.max(0, Number(skip) || 0))
    .limit(Math.max(0, Number(limit) || 0))
    .toArray();
  return fromLegacyDocs(docs);
}

async function countDataRows(modelName, query = {}) {
  return LegacyModels[modelName].countDocuments(query);
}

async function distinctDataValues(modelName, field, query = {}) {
  return LegacyModels[modelName].distinct(field, query);
}

function approvalTicketStatusRegex(status = '') {
  const normalized = safe(status).toLowerCase();
  if (normalized === 'pending') return /pending approval|hr approved/i;
  if (normalized === 'approved') return /approved|completed/i;
  if (normalized === 'rejected') return /reject|rework|closed/i;
  return /pending approval|hr approved|approved|completed|reject|rework|closed/i;
}

function fastVisibleTicketQuery(admin, users = [], filters = {}) {
  const role = userRole(admin);
  const adminId = safe(userId(admin));
  const statusRegex = approvalTicketStatusRegex(filters.status);
  const clauses = [
    {
      $or: [
        { 'data.Status': statusRegex },
        { 'data.status': statusRegex }
      ]
    }
  ];

  if (safe(filters.category)) {
    clauses.push({
      $or: [
        { 'data.Task Category': safe(filters.category) },
        { 'data.Category': safe(filters.category) },
        { 'data.category': safe(filters.category) }
      ]
    });
  }

  if (safe(filters.employee)) {
    const employeeNeedle = safe(filters.employee).toLowerCase();
    const employeeIds = activeVisibleApprovalUsers(admin, users)
      .filter((user) => {
        const employeeText = `${first(user, ['Employee Name', 'employeeName', 'Name'], '')} ${userId(user)}`.toLowerCase();
        return employeeText.includes(employeeNeedle);
      })
      .map((user) => safe(userId(user)))
      .filter(Boolean);
    if (!employeeIds.length) {
      return { $or: [{ legacyId: '__no_match__' }] };
    }
    clauses.push(employeeIdsQuery(employeeIds));
  }

  if (safe(filters.search)) {
    const textRegex = new RegExp(safe(filters.search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    clauses.push({
      $or: [
        { 'data.Ticket ID': textRegex },
        { 'data.Task ID': textRegex },
        { 'data.ID': textRegex },
        { 'data.Task Description': textRegex },
        { 'data.Description': textRegex },
        { 'data.description': textRegex },
        { 'data.Remarks': textRegex },
        { 'data.remarks': textRegex },
        { 'data.Name': textRegex },
        { 'data.Client Name': textRegex },
        { 'data.Client': textRegex },
        { 'data.Client_Id': textRegex },
        { 'data.Client ID': textRegex }
      ]
    });
  }

  if (role === 'super admin') {
    return { $and: clauses };
  }

  const visibleUsers = activeVisibleApprovalUsers(admin, users);
  const visibleUserIds = visibleUsers.map((user) => safe(userId(user))).filter(Boolean);

  if (role === 'hr') {
    clauses.push(employeeIdsQuery(visibleUserIds));
    return { $and: clauses };
  }

  if (role === 'admin' || role === 'manager') {
    const teamUserIds = visibleUsers
      .filter((user) => !eq(userId(user), adminId))
      .map((user) => safe(userId(user)))
      .filter(Boolean);
    clauses.push({
      $or: [
        employeeIdsQuery(teamUserIds),
        { 'data.Task Approver': adminId },
        { 'data.taskApprover': adminId },
        { 'data.Reassigned To': adminId },
        { 'data.reassignedTo': adminId }
      ]
    });
    return { $and: clauses };
  }

  return { $or: [{ legacyId: '__no_match__' }] };
}

function fastActionableTicketQuery(admin, users = [], filters = {}) {
  const role = userRole(admin);
  const adminId = safe(userId(admin));
  const visibleQuery = fastVisibleTicketQuery(admin, users, { ...filters, status: 'pending' });
  if (!adminId) return { $or: [{ legacyId: '__no_match__' }] };

  if (role === 'super admin') {
    return visibleQuery;
  }

  if (role === 'hr') {
    const hrEmployeeIds = users
      .filter((user) => {
        const ownerDepartment = safe(first(user, ['Department', 'department'])).toLowerCase();
        return ownerDepartment === 'hr' || ownerDepartment.includes('hr intern') || ownerDepartment.includes('human resource');
      })
      .map((user) => safe(userId(user)))
      .filter(Boolean);
    return {
      $and: [
        visibleQuery,
        {
          $or: [
            { 'data.Task Approver': adminId },
            { 'data.taskApprover': adminId },
            { 'data.Reassigned To': adminId },
            { 'data.reassignedTo': adminId },
            employeeIdsQuery(hrEmployeeIds)
          ]
        },
        {
          $nor: [
            { 'data.Employee ID': adminId },
            { 'data.employeeId': adminId },
            { 'data.EmpID': adminId },
            { 'data.User ID': adminId }
          ]
        }
      ]
    };
  }

  if (role === 'admin' || role === 'manager') {
    return {
      $and: [
        visibleQuery,
        {
          $or: [
            { 'data.Task Approver': adminId },
            { 'data.taskApprover': adminId },
            { 'data.Reassigned To': adminId },
            { 'data.reassignedTo': adminId }
          ]
        },
        {
          $nor: [
            { 'data.Employee ID': adminId },
            { 'data.employeeId': adminId },
            { 'data.EmpID': adminId },
            { 'data.User ID': adminId }
          ]
        }
      ]
    };
  }

  return { $or: [{ legacyId: '__no_match__' }] };
}

async function getFastPendingTicketRows(adminId, options = {}) {
  const page = Math.max(1, Number(options.page || 1) || 1);
  const pageSize = Math.min(50, Math.max(20, Number(options.pageSize || 20) || 20));
  const filters = {
    employee: safe(options.filters?.employee),
    category: safe(options.filters?.category),
    startDate: safe(options.filters?.startDate),
    endDate: safe(options.filters?.endDate),
    search: safe(options.filters?.search),
    status: safe(options.filters?.status)
  };
  const cacheKey = `${safe(adminId).toLowerCase()}::rows::tickets::fast::${JSON.stringify(filters)}::${page}::${pageSize}`;
  const cached = await getCachedApprovalPayload(cacheKey);
  if (cached) return cached;

  const userProjection = {
    legacyId: 1,
    'data.Employee ID': 1,
    'data.User ID': 1,
    'data.EmpID': 1,
    'data.employeeId': 1,
    'data.Employee Name': 1,
    'data.Name': 1,
    'data.name': 1,
    'data.Role': 1,
    'data.role': 1,
    'data.Department': 1,
    'data.department': 1,
    'data.Manager ID': 1,
    'data.Manager': 1,
    'data.managerId': 1,
    'data.Reporting Manager': 1,
    'data.Task Approver': 1,
    'data.taskApprover': 1,
    'data.Status': 1,
    'data.status': 1
  };
  const ticketProjection = {
    legacyId: 1,
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
    'data.timestamp': 1,
    'data.Created At': 1,
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
    'data.Remarks': 1,
    'data.remarks': 1,
    'data.TAT': 1,
    'data.When': 1,
    'data.tatMinutes': 1,
    'data.Task Approver': 1,
    'data.taskApprover': 1,
    'data.Approver ID': 1,
    'data.Reassigned By': 1,
    'data.reassignedBy': 1,
    'data.Reassigned To': 1,
    'data.reassignedTo': 1
  };
  const clientProjection = {
    legacyId: 1,
    'data.Client_Id': 1,
    'data.Client ID': 1,
    'data.CustomerID': 1,
    'data.Client Name': 1,
    'data.Name': 1
  };

  const users = await listDataRows('User', {}, userProjection);
  const admin = users.find((user) => eq(userId(user), adminId));
  if (!admin || !elevatedRoles.has(userRole(admin))) return fail('Access Denied');

  const visibleQuery = fastVisibleTicketQuery(admin, users, filters);
  const actionableQuery = fastActionableTicketQuery(admin, users, filters);
  const passiveQuery = { $and: [visibleQuery, { $nor: [fastActionableTicketQuery(admin, users, { ...filters, status: 'pending' })] }] };
  const startIndex = (page - 1) * pageSize;

  const [actionableTotal, total, clients, taskCategories, categories, normalizedCategories] = await Promise.all([
    countDataRows('Ticket', actionableQuery),
    countDataRows('Ticket', visibleQuery),
    listDataRows('Client', {}, clientProjection),
    distinctDataValues('Ticket', 'data.Task Category', visibleQuery),
    distinctDataValues('Ticket', 'data.Category', visibleQuery),
    distinctDataValues('Ticket', 'data.category', visibleQuery)
  ]);

  const actionableSkip = Math.min(startIndex, actionableTotal);
  const actionableLimit = Math.max(0, Math.min(pageSize, actionableTotal - actionableSkip));
  const actionableRows = actionableLimit
    ? await listDataRowsPaginated('Ticket', actionableQuery, {
        projection: ticketProjection,
        sort: { createdAt: -1 },
        skip: actionableSkip,
        limit: actionableLimit
      })
    : [];

  const passiveSkip = Math.max(0, startIndex - actionableTotal);
  const passiveLimit = Math.max(0, pageSize - actionableRows.length);
  const passiveRows = passiveLimit
    ? await listDataRowsPaginated('Ticket', passiveQuery, {
        projection: ticketProjection,
        sort: { createdAt: -1 },
        skip: passiveSkip,
        limit: passiveLimit
      })
    : [];

  const rows = [...actionableRows, ...passiveRows].map((row) => {
    const decision = ticketApprovalDecision(admin, row, users);
    const isPending = isPendingTicketStatus(first(row, ['Status']));
    return {
      ...asTicketRow(row, clients),
      _canApprove: decision.canApprove && isPending,
      _isActionableByMe: decision.actionable && isPending,
      _canTransferApproval: decision.actionable && isPending
    };
  });

  const payload = ok({
    tab: 'tickets',
    rows,
    ticketCategories: Array.from(
      new Set([...taskCategories, ...categories, ...normalizedCategories].map((value) => safe(value)).filter(Boolean))
    ).sort((left, right) => left.localeCompare(right)),
    pagination: {
      page,
      pageSize,
      total,
      hasMore: startIndex + rows.length < total
    }
  });
  setCachedApprovalPayload(cacheKey, payload);
  return payload;
}

async function getApprovalQueueRows(adminId, options = {}) {
  const requestedTabs = Array.isArray(options.tabs) && options.tabs.length
    ? new Set(options.tabs.map((value) => safe(value).toLowerCase()))
    : new Set(['tickets', 'leaves', 'intimations', 'attendance']);
  const includeClients = options.includeClients !== false;
  const userProjection = {
    legacyId: 1,
    'data.Employee ID': 1,
    'data.User ID': 1,
    'data.EmpID': 1,
    'data.employeeId': 1,
    'data.Employee Name': 1,
    'data.Name': 1,
    'data.name': 1,
    'data.Role': 1,
    'data.role': 1,
    'data.Department': 1,
    'data.department': 1,
    'data.Manager ID': 1,
    'data.Manager': 1,
    'data.managerId': 1,
    'data.Reporting Manager': 1,
    'data.Task Approver': 1,
    'data.taskApprover': 1,
    'data.Status': 1
  };
  const users = await listDataRows('User', {}, userProjection);
  const admin = users.find((user) => eq(userId(user), adminId));
  if (!admin || !elevatedRoles.has(userRole(admin))) return { admin, users, denied: true };

  const ticketProjection = {
    legacyId: 1,
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
    'data.timestamp': 1,
    'data.Created At': 1,
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
    'data.Remarks': 1,
    'data.remarks': 1,
    'data.TAT': 1,
    'data.When': 1,
    'data.tatMinutes': 1,
    'data.Task Approver': 1,
    'data.taskApprover': 1,
    'data.Approver ID': 1,
    'data.Reassigned By': 1,
    'data.reassignedBy': 1,
    'data.Reassigned To': 1,
    'data.reassignedTo': 1
  };
  const leaveProjection = {
    legacyId: 1,
    'data.LeaveID': 1,
    'data.Leave ID': 1,
    'data.ID': 1,
    'data.leaveId': 1,
    'data.Employee ID': 1,
    'data.employeeId': 1,
    'data.EmpID': 1,
    'data.Employee Name': 1,
    'data.employeeName': 1,
    'data.Name': 1,
    'data.Leave Type': 1,
    'data.leaveType': 1,
    'data.type': 1,
    'data.Day Type': 1,
    'data.dayType': 1,
    'data.Start Date': 1,
    'data.startDate': 1,
    'data.End Date': 1,
    'data.endDate': 1,
    'data.Reason': 1,
    'data.reason': 1,
    'data.Status': 1,
    'data.status': 1,
    'data.Timestamp': 1,
    'data.timestamp': 1,
    'data.Last Update Date': 1,
    'data.Admin Remarks': 1,
    'data.Admin Approval': 1,
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
    'data.Employee Name': 1,
    'data.employeeName': 1,
    'data.Name': 1,
    'data.Intimation Type': 1,
    'data.Type': 1,
    'data.type': 1,
    'data.Intimation Date': 1,
    'data.Date': 1,
    'data.date': 1,
    'data.Reason': 1,
    'data.reason': 1,
    'data.Status': 1,
    'data.status': 1,
    'data.Timestamp': 1,
    'data.Last Update Date': 1,
    'data.Admin Remarks': 1,
    'data.Admin Approval': 1,
    'data.remarks': 1
  };
  const attendanceProjection = {
    legacyId: 1,
    'data.AttendanceID': 1,
    'data.ID': 1,
    'data.attendanceId': 1,
    'data.Employee ID': 1,
    'data.employeeId': 1,
    'data.EmpID': 1,
    'data.Employee Name': 1,
    'data.employeeName': 1,
    'data.Name': 1,
    'data.Date': 1,
    'data.date': 1,
    'data.Action': 1,
    'data.action': 1,
    'data.Time': 1,
    'data.Punch In': 1,
    'data.InTime': 1,
    'data.Punch Out': 1,
    'data.OutTime': 1,
    'data.Total Working Hours': 1,
    'data.Duration': 1,
    'data.Status': 1,
    'data.status': 1,
    'data.Remarks': 1,
    'data.Admin Remarks': 1
  };
  const clientProjection = {
    legacyId: 1,
    'data.Client_Id': 1,
    'data.Client ID': 1,
    'data.CustomerID': 1,
    'data.Client Name': 1,
    'data.Name': 1
  };
  const filters = options.filters || {};
  const [leaves, intimations, attendance, tickets, clients] = await Promise.all([
    requestedTabs.has('leaves') ? listDataRows('Leave', approvalTabQuery('leaves', admin, users, filters), leaveProjection) : Promise.resolve([]),
    requestedTabs.has('intimations') ? listDataRows('Intimation', approvalTabQuery('intimations', admin, users, filters), intimationProjection) : Promise.resolve([]),
    requestedTabs.has('attendance') ? listDataRows('Attendance', approvalTabQuery('attendance', admin, users, filters), attendanceProjection) : Promise.resolve([]),
    requestedTabs.has('tickets') ? listDataRows('Ticket', approvalTabQuery('tickets', admin, users, filters), ticketProjection) : Promise.resolve([]),
    requestedTabs.has('tickets') && includeClients ? listDataRows('Client', {}, clientProjection) : Promise.resolve([])
  ]);
  return { admin, users, leaves, intimations, attendance, tickets, clients };
}

async function getRows() {
  const [leaves, intimations, attendance, tickets, users, clients] = await Promise.all([
    listRows('Leave'),
    listRows('Intimation'),
    listRows('Attendance'),
    listRows('Ticket'),
    listRows('User'),
    listRows('Client')
  ]);
  return { leaves, intimations, attendance, tickets, users, clients };
}

export async function getPendingApprovals(adminId, options = {}) {
  const mode = safe(options.mode).toLowerCase();
  if (mode === 'summary') return getPendingApprovalsSummary(adminId);
  if (mode === 'rows') return getPendingApprovalsRows(adminId, options);

  const cacheKey = safe(adminId).toLowerCase();
  const cached = await getCachedApprovalPayload(cacheKey);
  if (cached) {
    return cached;
  }

  const data = await getApprovalQueueRows(adminId);
  const admin = data.users.find((user) => eq(userId(user), adminId));
  if (!admin || !elevatedRoles.has(userRole(admin))) return fail('Access Denied');

  const attendanceGroups = new Map();
  data.attendance
    .filter((row) => requestApprovalDecision(admin, row, data.users, 'Attendance').visible)
    .forEach((row) => {
      const employee = first(row, ['Employee ID', 'employeeId', 'EmpID']);
      const date = normalizedDate(first(row, ['Date', 'date']));
      const key = `${safe(employee).toUpperCase()}|${date}`;
      const group = attendanceGroups.get(key) || {
        'Employee ID': employee,
        'Employee Name': first(row, ['Employee Name', 'employeeName', 'Name'], employee),
        DateStr: date,
        PunchIn: '-',
        PunchOut: '-',
        Duration: '-',
        Status: first(row, ['Status', 'status'], 'Need Approval'),
        AttendanceID: key,
        AttendanceIDs: [],
        _canApprove: false,
        _isActionableByMe: false
      };
      const decision = requestApprovalDecision(admin, row, data.users, 'Attendance');
      group.AttendanceIDs.push(first(row, ['AttendanceID', 'ID', 'attendanceId']));
      group._canApprove = group._canApprove || decision.canApprove;
      group._isActionableByMe = group._isActionableByMe || decision.actionable;
      if (/punch\s*in/i.test(first(row, ['Action', 'action']))) {
        group.PunchIn = formatApprovalTime(first(row, ['Time', 'Punch In', 'InTime']));
      }
      if (/punch\s*out/i.test(first(row, ['Action', 'action']))) {
        group.PunchOut = formatApprovalTime(first(row, ['Time', 'Punch Out', 'OutTime']));
        group.Duration = first(row, ['Total Working Hours', 'Duration'], group.Duration) || group.Duration;
      }
      attendanceGroups.set(key, group);
    });

  const payload = ok({
    leaves: groupLeaveRows(
      data.leaves
        .map((row) => {
        const decision = requestApprovalDecision(admin, row, data.users, 'Leave');
        return decision.visible ? { ...row, _canApprove: decision.canApprove, _isActionableByMe: decision.actionable } : null;
        })
        .filter(Boolean)
    ),
    intimations: data.intimations
      .map((row) => {
        const decision = requestApprovalDecision(admin, row, data.users, 'Intimation');
        return decision.visible ? { ...row, _canApprove: decision.canApprove, _isActionableByMe: decision.actionable } : null;
      })
      .filter(Boolean),
    attendance: Array.from(attendanceGroups.values()),
    tickets: data.tickets
      .filter((row) => ticketApprovalDecision(admin, row, data.users).visible && isApprovalRelevantTicketStatus(first(row, ['Status'])))
      .map((row) => {
        const decision = ticketApprovalDecision(admin, row, data.users);
        const isPending = isPendingTicketStatus(first(row, ['Status']));
        return { 
          ...asTicketRow(row, data.clients), 
          _canApprove: decision.canApprove && isPending, 
          _isActionableByMe: decision.actionable && isPending, 
          _canTransferApproval: decision.actionable && isPending 
        };
      })
      .sort((left, right) => Number(right._isActionableByMe) - Number(left._isActionableByMe)),
    users: data.users.map((user) => ({
      id: first(user, ['Employee ID', 'employeeId', 'User ID', 'EmpID']),
      name: first(user, ['Employee Name', 'name', 'Name'], first(user, ['Employee ID', 'employeeId', 'User ID', 'EmpID']))
    }))
  });
  setCachedApprovalPayload(cacheKey, payload);
  return payload;
}

function approvalUserOptions(users = []) {
  return users.map((user) => ({
    id: first(user, ['Employee ID', 'employeeId', 'User ID', 'EmpID']),
    name: first(user, ['Employee Name', 'name', 'Name'], first(user, ['Employee ID', 'employeeId', 'User ID', 'EmpID']))
  }));
}

function employeeIdsQuery(employeeIds = []) {
  const ids = employeeIds.map((value) => safe(value)).filter(Boolean);
  if (!ids.length) return { $or: [{ legacyId: '__no_match__' }] };
  return {
    $or: [
      { 'data.Employee ID': { $in: ids } },
      { 'data.employeeId': { $in: ids } },
      { 'data.EmpID': { $in: ids } },
      { 'data.User ID': { $in: ids } }
    ]
  };
}

function userIdentityQuery(employeeId = '') {
  const value = safe(employeeId);
  return {
    $or: [
      { 'data.Employee ID': value },
      { 'data.employeeId': value },
      { 'data.EmpID': value },
      { 'data.User ID': value }
    ]
  };
}

function dateRangeFieldQuery(fields = [], startDate = '', endDate = '') {
  const start = safe(startDate);
  const end = safe(endDate);
  if (!start && !end) return {};
  const range = {};
  if (start) range.$gte = start;
  if (end) range.$lte = end;
  return { $or: fields.filter(Boolean).map((field) => ({ [field]: range })) };
}

function visibleApprovalUsers(admin, users = []) {
  return activeVisibleApprovalUsers(admin, users);
}

function visibleApprovalUserIds(admin, users = []) {
  return visibleApprovalUsers(admin, users).map((user) => safe(userId(user))).filter(Boolean);
}

function approvalTicketScopeQuery(admin, users = [], { pendingOnly = false } = {}) {
  const role = userRole(admin);
  const adminId = safe(userId(admin));
  const statusQuery = pendingOnly
    ? { $or: [{ 'data.Status': /pending approval|hr approved/i }, { 'data.status': /pending approval|hr approved/i }] }
    : { $or: [{ 'data.Status': /pending approval|hr approved|approved|closed|rework|reject|completed/i }, { 'data.status': /pending approval|hr approved|approved|closed|rework|reject|completed/i }] };

  if (role === 'super admin') return statusQuery;

  const visibleIds = visibleApprovalUserIds(admin, users);
  const scopedEmployeeQuery = employeeIdsQuery(visibleIds);
  const approverQuery = {
    $or: [
      { 'data.Task Approver': adminId },
      { 'data.taskApprover': adminId },
      { 'data.Reassigned To': adminId },
      { 'data.reassignedTo': adminId }
    ]
  };

  return {
    $and: [
      statusQuery,
      {
        $or: [
          scopedEmployeeQuery,
          approverQuery
        ]
      }
    ]
  };
}

function approvalTabQuery(tab, admin, users = [], filters = {}) {
  const visibleIds = visibleApprovalUserIds(admin, users);
  const ownerQuery = employeeIdsQuery(visibleIds);
  const startDate = safe(filters.startDate);
  const endDate = safe(filters.endDate);

  if (tab === 'tickets') {
    const clauses = [approvalTicketScopeQuery(admin, users)];
    const dateQuery = dateRangeFieldQuery(['data.Plan Date', 'data.planDate', 'data.Date', 'data.Timestamp'], startDate, endDate);
    if (Object.keys(dateQuery).length) clauses.push(dateQuery);
    return clauses.length === 1 ? clauses[0] : { $and: clauses };
  }

  const clauses = [ownerQuery];
  if (tab === 'leaves') {
    clauses.push({
      $or: [
        { 'data.Status': /pending|approved|reject/i },
        { 'data.status': /pending|approved|reject/i }
      ]
    });
    const dateQuery = dateRangeFieldQuery(['data.Start Date', 'data.startDate', 'data.End Date', 'data.endDate'], startDate, endDate);
    if (Object.keys(dateQuery).length) clauses.push(dateQuery);
  } else if (tab === 'intimations') {
    clauses.push({
      $or: [
        { 'data.Status': /submitted|pending|approved|reject/i },
        { 'data.status': /submitted|pending|approved|reject/i }
      ]
    });
    const dateQuery = dateRangeFieldQuery(['data.Intimation Date', 'data.Date', 'data.date'], startDate, endDate);
    if (Object.keys(dateQuery).length) clauses.push(dateQuery);
  } else if (tab === 'attendance') {
    clauses.push({
      $or: [
        { 'data.Status': /need approval|pending|present|approved|reject|absent/i },
        { 'data.status': /need approval|pending|present|approved|reject|absent/i },
        { 'data.Admin Approval': /pending|approved|reject/i },
        { 'data.adminApproval': /pending|approved|reject/i }
      ]
    });
    const dateQuery = dateRangeFieldQuery(['data.Date', 'data.date'], startDate, endDate);
    if (Object.keys(dateQuery).length) clauses.push(dateQuery);
  }
  return { $and: clauses };
}

function activeVisibleApprovalUsers(admin, users = []) {
  const role = userRole(admin);
  return users.filter((user) => {
    if (safe(first(user, ['Status', 'status'], 'Active')).toLowerCase() === 'inactive') return false;
    if (role === 'super admin') return true;
    if (role === 'admin') return userRole(user) !== 'super admin';
    if (role === 'hr') return userRole(user) !== 'super admin';
    if (role === 'manager') return canReviewEmployee(admin, user, users);
    return false;
  });
}

function actionableTicketMatchQuery(admin, users = []) {
  const role = userRole(admin);
  const adminId = safe(userId(admin));
  if (!adminId) return { $or: [{ legacyId: '__no_match__' }] };
  if (role === 'super admin') {
    return { 'data.Status': /pending approval|hr approved/i };
  }
  if (role === 'admin' || role === 'manager') {
    return {
      $and: [
        { 'data.Status': /pending approval|hr approved/i },
        {
          $or: [
            { 'data.Task Approver': adminId },
            { 'data.taskApprover': adminId },
            { 'data.Reassigned To': adminId },
            { 'data.reassignedTo': adminId }
          ]
        },
        {
          $nor: [
            { 'data.Employee ID': adminId },
            { 'data.employeeId': adminId },
            { 'data.EmpID': adminId },
            { 'data.User ID': adminId }
          ]
        }
      ]
    };
  }
  if (role === 'hr') {
    const hrEmployeeIds = users
      .filter((user) => {
        const ownerDepartment = safe(first(user, ['Department', 'department'])).toLowerCase();
        return ownerDepartment === 'hr' || ownerDepartment.includes('hr intern') || ownerDepartment.includes('human resource');
      })
      .map((user) => safe(userId(user)))
      .filter(Boolean);
    return {
      $and: [
        { 'data.Status': /pending approval|hr approved/i },
        {
          $or: [
            { 'data.Task Approver': adminId },
            { 'data.taskApprover': adminId },
            { 'data.Reassigned To': adminId },
            { 'data.reassignedTo': adminId },
            employeeIdsQuery(hrEmployeeIds)
          ]
        },
        {
          $nor: [
            { 'data.Employee ID': adminId },
            { 'data.employeeId': adminId },
            { 'data.EmpID': adminId },
            { 'data.User ID': adminId }
          ]
        }
      ]
    };
  }
  return { $or: [{ legacyId: '__no_match__' }] };
}

function buildVisibleLeaveRows(data, admin) {
  return groupLeaveRows(
    data.leaves
      .map((row) => {
        const decision = requestApprovalDecision(admin, row, data.users, 'Leave');
        return decision.visible ? { ...row, _canApprove: decision.canApprove, _isActionableByMe: decision.actionable } : null;
      })
      .filter(Boolean)
  );
}

function buildVisibleIntimationRows(data, admin) {
  return data.intimations
    .map((row) => {
      const decision = requestApprovalDecision(admin, row, data.users, 'Intimation');
      return decision.visible ? { ...row, _canApprove: decision.canApprove, _isActionableByMe: decision.actionable } : null;
    })
    .filter(Boolean);
}

function buildVisibleAttendanceRows(data, admin) {
  const attendanceGroups = new Map();
  data.attendance
    .filter((row) => requestApprovalDecision(admin, row, data.users, 'Attendance').visible)
    .forEach((row) => {
      const employee = first(row, ['Employee ID', 'employeeId', 'EmpID']);
      const date = normalizedDate(first(row, ['Date', 'date']));
      const key = `${safe(employee).toUpperCase()}|${date}`;
      const group = attendanceGroups.get(key) || {
        'Employee ID': employee,
        'Employee Name': first(row, ['Employee Name', 'employeeName', 'Name'], employee),
        DateStr: date,
        PunchIn: '-',
        PunchOut: '-',
        Duration: '-',
        Status: first(row, ['Status', 'status'], 'Need Approval'),
        AttendanceID: key,
        AttendanceIDs: [],
        _canApprove: false,
        _isActionableByMe: false
      };
      const decision = requestApprovalDecision(admin, row, data.users, 'Attendance');
      group.AttendanceIDs.push(first(row, ['AttendanceID', 'ID', 'attendanceId']));
      group._canApprove = group._canApprove || decision.canApprove;
      group._isActionableByMe = group._isActionableByMe || decision.actionable;
      if (/punch\s*in/i.test(first(row, ['Action', 'action']))) {
        group.PunchIn = formatApprovalTime(first(row, ['Time', 'Punch In', 'InTime']));
      }
      if (/punch\s*out/i.test(first(row, ['Action', 'action']))) {
        group.PunchOut = formatApprovalTime(first(row, ['Time', 'Punch Out', 'OutTime']));
        group.Duration = first(row, ['Total Working Hours', 'Duration'], group.Duration) || group.Duration;
      }
      attendanceGroups.set(key, group);
    });
  return Array.from(attendanceGroups.values());
}

function buildVisibleTicketRows(data, admin) {
  return data.tickets
    .filter((row) => ticketApprovalDecision(admin, row, data.users).visible && isApprovalRelevantTicketStatus(first(row, ['Status'])))
    .map((row) => {
      const decision = ticketApprovalDecision(admin, row, data.users);
      const isPending = isPendingTicketStatus(first(row, ['Status']));
      return {
        ...asTicketRow(row, data.clients),
        _canApprove: decision.canApprove && isPending,
        _isActionableByMe: decision.actionable && isPending,
        _canTransferApproval: decision.actionable && isPending
      };
    })
    .sort((left, right) => Number(right._isActionableByMe) - Number(left._isActionableByMe));
}

function includesFilter(value, query) {
  return !safe(query) || safe(value).toLowerCase().includes(safe(query).toLowerCase());
}

function inDateRange(value, start, end) {
  if (!start && !end) return true;
  const normalized = normalizedDate(value);
  if (!normalized) return false;
  if (start && normalized < start) return false;
  if (end && normalized > end) return false;
  return true;
}

function sortApprovalRows(rows = [], getDateValue) {
  return [...rows].sort((left, right) => {
    const actionableDiff = Number(Boolean(right?._isActionableByMe)) - Number(Boolean(left?._isActionableByMe));
    if (actionableDiff) return actionableDiff;
    const rightDate = new Date(getDateValue(right) || right?.['Last Update Date'] || right?.Timestamp || 0).getTime();
    const leftDate = new Date(getDateValue(left) || left?.['Last Update Date'] || left?.Timestamp || 0).getTime();
    return rightDate - leftDate;
  });
}

function filterApprovalRows(tab, rows = [], filters = {}) {
  if (tab === 'tickets') {
    return sortApprovalRows(rows.filter((ticket) => {
      const employeeText = `${ticket['Employee Name'] || ''} ${ticket['Employee ID'] || ''}`;
      const searchable = [
        ticket['Ticket ID'],
        ticket['Task Description'],
        ticket.Remarks,
        ticket.Name,
        ticket['Client Name'],
        ticket['Client ID']
      ].join(' ');
      const isPending = /pending approval|hr approved/i.test(ticket.Status);
      const isStatusMatch = !filters.status ||
        (filters.status === 'pending' && isPending) ||
        (filters.status === 'approved' && /approved/i.test(ticket.Status) && !isPending) ||
        (filters.status === 'rejected' && /reject|rework|closed/i.test(ticket.Status));
      return (
        isStatusMatch &&
        includesFilter(employeeText, filters.employee) &&
        (!filters.category || (ticket['Task Category'] || ticket.Category) === filters.category) &&
        inDateRange(ticket['Plan Date'], filters.startDate, filters.endDate) &&
        includesFilter(searchable, filters.search)
      );
    }), (item) => item?.['Plan Date']);
  }

  if (tab === 'leaves') {
    return sortApprovalRows(rows.filter((item) => {
      const employeeText = `${item['Employee Name'] || item.employeeName || ''} ${item['Employee ID'] || item.employeeId || ''}`;
      const searchable = [item['Leave Type'] || item.leaveType || item.type, item.Reason || item.reason, item['Day Type'] || item.dayType].join(' ');
      const isPending = /pending/i.test(item.Status);
      const isStatusMatch = !filters.status ||
        (filters.status === 'pending' && isPending) ||
        (filters.status === 'approved' && /approved/i.test(item.Status)) ||
        (filters.status === 'rejected' && /reject/i.test(item.Status));
      return (
        isStatusMatch &&
        includesFilter(employeeText, filters.employee) &&
        inDateRange(item['Start Date'] || item.startDate, filters.startDate, filters.endDate) &&
        inDateRange(item['End Date'] || item.endDate, filters.startDate, filters.endDate) &&
        includesFilter(searchable, filters.search)
      );
    }), (item) => item?.['Start Date'] || item?.startDate);
  }

  if (tab === 'intimations') {
    return sortApprovalRows(rows.filter((item) => {
      const employeeText = `${item['Employee Name'] || item.employeeName || ''} ${item['Employee ID'] || item.employeeId || ''}`;
      const searchable = [item['Intimation Type'] || item.type, item.Reason || item.reason].join(' ');
      const isPending = /pending|submitted/i.test(item.Status);
      const isStatusMatch = !filters.status ||
        (filters.status === 'pending' && isPending) ||
        (filters.status === 'approved' && /approved/i.test(item.Status)) ||
        (filters.status === 'rejected' && /reject/i.test(item.Status));
      return (
        isStatusMatch &&
        includesFilter(employeeText, filters.employee) &&
        inDateRange(item['Intimation Date'] || item.Date || item.date, filters.startDate, filters.endDate) &&
        includesFilter(searchable, filters.search)
      );
    }), (item) => item?.['Intimation Date'] || item?.Date || item?.date);
  }

  return sortApprovalRows(rows.filter((item) => {
    const employeeText = `${item['Employee Name'] || ''} ${item['Employee ID'] || ''}`;
    const searchable = [item.Status, item.Remarks, item['Admin Remarks']].join(' ');
    const isPending = /pending|need approval/i.test(item.Status);
    const isStatusMatch = !filters.status ||
      (filters.status === 'pending' && isPending) ||
      (filters.status === 'approved' && /present|approved/i.test(item.Status) && !isPending) ||
      (filters.status === 'rejected' && /reject|absent/i.test(item.Status));
    return (
      isStatusMatch &&
      includesFilter(employeeText, filters.employee) &&
      inDateRange(item.Date || item.DateStr, filters.startDate, filters.endDate) &&
      includesFilter(searchable, filters.search)
    );
  }), (item) => item?.Date || item?.DateStr);
}

function approvalSummaryPayload(data, admin) {
  const tickets = buildVisibleTicketRows({ ...data, clients: [] }, admin);
  const leaves = buildVisibleLeaveRows(data, admin);
  const intimations = buildVisibleIntimationRows(data, admin);
  const attendance = buildVisibleAttendanceRows(data, admin);
  return ok({
    counts: {
      tickets: tickets.filter((row) => row._isActionableByMe === true).length,
      leaves: leaves.filter((row) => row._isActionableByMe === true).length,
      intimations: intimations.filter((row) => row._isActionableByMe === true).length,
      attendance: attendance.filter((row) => row._isActionableByMe === true).length
    },
    users: approvalUserOptions(data.users),
    ticketCategories: Array.from(new Set(tickets.map((ticket) => ticket['Task Category'] || ticket.Category).filter(Boolean))).sort((left, right) => left.localeCompare(right))
  });
}

async function getPendingApprovalsSummary(adminId) {
  const cacheKey = `${safe(adminId).toLowerCase()}::summary`;
  const cached = await getCachedApprovalPayload(cacheKey);
  if (cached) return cached;

  const userProjection = {
    legacyId: 1,
    'data.Employee ID': 1,
    'data.User ID': 1,
    'data.EmpID': 1,
    'data.employeeId': 1,
    'data.Employee Name': 1,
    'data.Name': 1,
    'data.name': 1,
    'data.Role': 1,
    'data.role': 1,
    'data.Department': 1,
    'data.department': 1,
    'data.Manager ID': 1,
    'data.Manager': 1,
    'data.managerId': 1,
    'data.Reporting Manager': 1,
    'data.Task Approver': 1,
    'data.taskApprover': 1,
    'data.Status': 1,
    'data.status': 1
  };
  const users = await listDataRows('User', {}, userProjection);
  const admin = users.find((user) => eq(userId(user), adminId));
  if (!admin || !elevatedRoles.has(userRole(admin))) return fail('Access Denied');

  const visibleUsers = activeVisibleApprovalUsers(admin, users);
  const visibleUserIds = visibleUsers.map((user) => safe(userId(user))).filter(Boolean);
  const nonTicketBaseQuery = employeeIdsQuery(visibleUserIds);
  const ticketPendingQuery = actionableTicketMatchQuery(admin, users);

  const [ticketCount, leaveCount, intimationCount, attendanceCount] = await Promise.all([
    LegacyModels.Ticket.countDocuments(ticketPendingQuery),
    LegacyModels.Leave.countDocuments({
      $and: [
        nonTicketBaseQuery,
        { $or: [{ 'data.Status': /pending/i }, { 'data.status': /pending/i }] }
      ]
    }),
    LegacyModels.Intimation.countDocuments({
      $and: [
        nonTicketBaseQuery,
        { $or: [{ 'data.Status': /submitted|pending/i }, { 'data.status': /submitted|pending/i }] }
      ]
    }),
    LegacyModels.Attendance.countDocuments({
      $and: [
        nonTicketBaseQuery,
        { $or: [{ 'data.Status': /need approval|pending/i }, { 'data.status': /need approval|pending/i }, { 'data.Admin Approval': /pending/i }, { 'data.adminApproval': /pending/i }] }
      ]
    })
  ]);

  const payload = ok({
    counts: {
      tickets: ticketCount,
      leaves: leaveCount,
      intimations: intimationCount,
      attendance: attendanceCount
    },
    users: approvalUserOptions(visibleUsers),
    ticketCategories: []
  });
  setCachedApprovalPayload(cacheKey, payload);
  return payload;
}

async function getPendingApprovalsRows(adminId, options = {}) {
  const tab = ['tickets', 'leaves', 'intimations', 'attendance'].includes(safe(options.tab).toLowerCase())
    ? safe(options.tab).toLowerCase()
    : 'tickets';
  if (tab === 'tickets') {
    return getFastPendingTicketRows(adminId, options);
  }
  const page = Math.max(1, Number(options.page || 1) || 1);
  const pageSize = Math.min(50, Math.max(20, Number(options.pageSize || 20) || 20));
  const filters = {
    employee: safe(options.filters?.employee),
    category: safe(options.filters?.category),
    startDate: safe(options.filters?.startDate),
    endDate: safe(options.filters?.endDate),
    search: safe(options.filters?.search),
    status: safe(options.filters?.status)
  };
  const cacheKey = `${safe(adminId).toLowerCase()}::rows::${tab}::${JSON.stringify(filters)}::${page}::${pageSize}`;
  const cached = await getCachedApprovalPayload(cacheKey);
  if (cached) return cached;

  const data = await getApprovalQueueRows(adminId, { tabs: [tab], includeClients: tab === 'tickets', filters });
  const admin = data.users.find((user) => eq(userId(user), adminId));
  if (!admin || !elevatedRoles.has(userRole(admin))) return fail('Access Denied');

  const baseRows =
    tab === 'tickets' ? buildVisibleTicketRows(data, admin)
      : tab === 'leaves' ? buildVisibleLeaveRows(data, admin)
        : tab === 'intimations' ? buildVisibleIntimationRows(data, admin)
          : buildVisibleAttendanceRows(data, admin);

  const filteredRows = filterApprovalRows(tab, baseRows, filters);
  const startIndex = (page - 1) * pageSize;
  const rows = filteredRows.slice(startIndex, startIndex + pageSize);
  const payload = ok({
    tab,
    rows,
    ...(tab === 'tickets'
      ? {
          ticketCategories: Array.from(new Set(baseRows.map((ticket) => ticket['Task Category'] || ticket.Category).filter(Boolean))).sort((left, right) => left.localeCompare(right))
        }
      : {}),
    pagination: {
      page,
      pageSize,
      total: filteredRows.length,
      hasMore: startIndex + rows.length < filteredRows.length
    }
  });
  setCachedApprovalPayload(cacheKey, payload);
  return payload;
}

export async function processApprovalAction(actionData = {}) {
  clearApprovalQueueCache();
  const type = actionData.type || actionData.Type;
  const id = actionData.id || actionData.ID;
  const status = actionData.status || actionData.Status || actionData.action;
  const adminId = actionData.adminId || actionData.AdminID || actionData['Admin ID'] || actionData.approvedBy || actionData['Approved By'];
  const users = await listRows('User');
  const admin = users.find((user) => eq(userId(user), adminId));
  if (!admin || !elevatedRoles.has(userRole(admin))) return fail('Unauthorized: Admin/HR access required.');
  const remarks = first(actionData, ['remarks', 'Remarks', 'Admin Remarks']);
  const approved = safe(status).toLowerCase() === 'approved';
  
  let newStatus = status;
  if (approved) {
    if (/attendance/i.test(type)) newStatus = 'Present';
    else if (userRole(admin) === 'hr') newStatus = 'HR Approved';
    else newStatus = 'Approved';
  }

  const actualAction = newStatus;
  const update = { 
    ...actionData, 
    Status: newStatus,
    status: newStatus,
    'Admin Remarks': remarks, 
    'Last Update Date': nowIso() 
  };

  if (/leave/i.test(type)) {
    const leaveRows = await listRows('Leave');
    const row = leaveRows.find((item) => eq(first(item, ['LeaveID', 'Leave ID', 'ID', 'leaveId']), id));
    if (!row) return fail('Leave request not found.');
    const decision = requestApprovalDecision(admin, row, users, 'Leave');
    if (!decision.actionable) return fail('Access Denied: You cannot action this leave request.');
    const targetRows = findLeaveRowsForAction(leaveRows, row);
    const updatedLeaves = [];
    for (const current of (targetRows.length ? targetRows : [row])) {
      const currentId = first(current, ['LeaveID', 'Leave ID', 'ID', 'leaveId']);
      updatedLeaves.push(await upsertRow('Leave', 'LeaveID', currentId, {
        ...current,
        ...update,
        LeaveID: currentId,
        'Leave ID': currentId,
        'Admin Approval': actualAction
      }));
    }
    return ok({ message: `Leave request ${actualAction}.`, item: updatedLeaves[0], data: updatedLeaves });
  }
  if (/intimation/i.test(type)) {
    const intimationRows = await listRows('Intimation');
    const row = intimationRows.find((item) => eq(first(item, ['IntimationID', 'Intimation ID', 'ID', 'intimationId']), id));
    if (!row) return fail('Intimation request not found.');
    const decision = requestApprovalDecision(admin, row, users, 'Intimation');
    if (!decision.actionable) return fail('Access Denied: You cannot action this intimation request.');
    return ok({ message: `Intimation request ${actualAction}.`, item: await upsertRow('Intimation', 'IntimationID', id, { ...update, IntimationID: id, 'Intimation ID': id, 'Admin Approval': actualAction }) });
  }
  if (/attendance/i.test(type)) {
    const attendanceRows = await listRows('Attendance');
    const [targetEmployee, targetDate] = safe(id).includes('|') ? safe(id).split('|', 2) : ['', ''];
    const targets = attendanceRows.filter((row) => {
      const sameDate = targetDate && normalizedDate(first(row, ['Date', 'date'])) === targetDate;
      const sameId = !targetDate && eq(first(row, ['AttendanceID', 'ID', 'attendanceId']), id);
      return (sameId || (sameDate && eq(first(row, ['Employee ID', 'employeeId', 'EmpID']), targetEmployee)));
    });
    if (!targets.length) return fail('Error: Could not match attendance date in database.');

    const attendanceDecision = requestApprovalDecision(admin, targets[0], users, 'Attendance');
    if (!attendanceDecision.actionable) return fail('Unauthorized: You cannot approve this employee attendance.');

    const date = targetDate || normalizedDate(first(targets[0], ['Date', 'date']));
    let punchIn = targets.find((row) => /punch\s*in/i.test(first(row, ['Action', 'action'])));
    let punchOut = targets.find((row) => /punch\s*out/i.test(first(row, ['Action', 'action'])));
    const correctedRows = new Map();
    if (actionData.newPunchIn && punchIn) {
      const iso = attendanceTimestamp(date, actionData.newPunchIn);
      const rowId = first(punchIn, ['AttendanceID', 'ID', 'attendanceId']);
      punchIn = await upsertRow('Attendance', 'AttendanceID', rowId, {
        ...punchIn, Date: iso, Time: iso, 'Punch In': actionData.newPunchIn
      });
      correctedRows.set(rowId, punchIn);
    }
    if (actionData.newPunchOut && punchOut) {
      const iso = attendanceTimestamp(date, actionData.newPunchOut);
      const rowId = first(punchOut, ['AttendanceID', 'ID', 'attendanceId']);
      punchOut = await upsertRow('Attendance', 'AttendanceID', rowId, {
        ...punchOut, Date: iso, Time: iso, 'Punch Out': actionData.newPunchOut
      });
      correctedRows.set(rowId, punchOut);
    }
    const attendanceEmployeeId = targetEmployee || first(targets[0], ['Employee ID', 'employeeId', 'EmpID']);
    const attendanceEmployeeName = first(targets[0], ['Employee Name', 'employeeName', 'Name'], attendanceEmployeeId);
    if (actionData.newPunchIn && !punchIn) {
      const rowId = `ATT_CORRECTION_${Date.now()}_IN`;
      const iso = attendanceTimestamp(date, actionData.newPunchIn);
      const created = sheetAttendance({
        AttendanceID: rowId,
        employeeId: attendanceEmployeeId,
        employeeName: attendanceEmployeeName,
        date: iso,
        action: 'Punch In',
        inTime: actionData.newPunchIn,
        status: update.Status,
        photo: first(targets[0], ['Photo Url', 'Photo URL', 'Photo']),
        lat: first(targets[0], ['Lattitude', 'Latitude']),
        long: first(targets[0], ['Longitude'])
      });
      created.Date = iso;
      created.Time = iso;
      created['Admin Approval'] = actualAction;
      created['Admin Remarks'] = remarks;
      punchIn = await insertRow('Attendance', created);
      targets.push(punchIn);
      correctedRows.set(rowId, punchIn);
    }
    if (actionData.newPunchOut && !punchOut) {
      const rowId = `ATT_CORRECTION_${Date.now()}_OUT`;
      const iso = attendanceTimestamp(date, actionData.newPunchOut);
      const created = sheetAttendance({
        AttendanceID: rowId,
        employeeId: attendanceEmployeeId,
        employeeName: attendanceEmployeeName,
        date: iso,
        action: 'Punch Out',
        outTime: actionData.newPunchOut,
        status: update.Status,
        photo: first(targets[0], ['Photo Url', 'Photo URL', 'Photo']),
        lat: first(targets[0], ['Lattitude', 'Latitude']),
        long: first(targets[0], ['Longitude'])
      });
      created.Date = iso;
      created.Time = iso;
      created['Admin Approval'] = actualAction;
      created['Admin Remarks'] = remarks;
      punchOut = await insertRow('Attendance', created);
      targets.push(punchOut);
      correctedRows.set(rowId, punchOut);
    }
    const inValue = punchIn && first(punchIn, ['Punch In', 'InTime', 'Time']);
    const outValue = punchOut && first(punchOut, ['Punch Out', 'OutTime', 'Time']);
    const duration = durationBetween(inValue, outValue, date);
    const updated = [];
    for (const row of targets) {
      const rowId = first(row, ['AttendanceID', 'ID', 'attendanceId']);
      const sourceRow = correctedRows.get(rowId) || row;
      const rowUpdate = {
        ...sourceRow,
        ...update,
        AttendanceID: rowId,
        Status: update.Status,
        'Admin Approval': actualAction,
        'Admin Remarks': remarks
      };
      if (/punch\s*out/i.test(first(row, ['Action', 'action'])) && duration) {
        rowUpdate.Duration = duration;
        rowUpdate['Total Working Hours'] = duration;
      }
      updated.push(await upsertRow('Attendance', 'AttendanceID', rowId, rowUpdate));
    }
    return ok({ message: `Attendance ${actualAction} successfully.`, item: updated[updated.length - 1], data: updated });
  }
  return ok({ message: 'Action processed.' });
}

export async function adminTicketAction(ticketId, adminId, action, remarks) {
  clearApprovalQueueCache();
  const gate = await requireAttendanceActive(adminId);
  if (gate) return gate;
  const userProjection = {
    legacyId: 1,
    'data.Employee ID': 1,
    'data.User ID': 1,
    'data.EmpID': 1,
    'data.employeeId': 1,
    'data.Employee Name': 1,
    'data.Name': 1,
    'data.Role': 1,
    'data.role': 1,
    'data.Department': 1,
    'data.department': 1,
    'data.Manager ID': 1,
    'data.Manager': 1,
    'data.managerId': 1,
    'data.Reporting Manager': 1,
    'data.Task Approver': 1,
    'data.taskApprover': 1,
    'data.Status': 1,
    'data.status': 1
  };
  const ticketProjection = {
    legacyId: 1,
    'data.Ticket ID': 1,
    'data.Employee ID': 1,
    'data.employeeId': 1,
    'data.EmpID': 1,
    'data.Status': 1,
    'data.Remarks': 1
  };
  const [ticket, users] = await Promise.all([
    listDataRows('Ticket', {
      $or: [{ legacyId: ticketId }, { 'data.Ticket ID': ticketId }, { 'data.Task ID': ticketId }, { 'data.ID': ticketId }]
    }, ticketProjection).then((rows) => rows[0] || null),
    listDataRows('User', {}, userProjection)
  ]);
  if (!ticket) return fail('Ticket not found.');
  const adminUser = users.find((user) => eq(userId(user), adminId));
  if (!adminUser) return fail('Admin user not found.');
  if (!/pending approval|hr approved/i.test(first(ticket, ['Status']))) return fail('Only pending approval tickets can be actioned.');
  const decision = ticketApprovalDecision(adminUser, ticket, users);
  if (!decision.actionable) return fail('Access Denied: You are not the designated approver for this ticket.');
  if (!safe(remarks) && /reject|rework/i.test(action)) return fail('Rework remarks are required.');
  const statusMap = { approve: 'Closed', approved: 'Closed', reject: 'Rework', rework: 'Rework', close: 'Closed' };
  const status = statusMap[String(action).toLowerCase()] || action || 'Updated';
  const row = await upsertRow('Ticket', 'Ticket ID', ticketId, {
    'Ticket ID': ticketId,
    Status: status,
    Remarks: `${first(ticket, ['Remarks', 'remarks']) || ''}${first(ticket, ['Remarks', 'remarks']) ? '\n' : ''}[${first(adminUser, ['Role', 'role'], 'Admin')} ${first(adminUser, ['Employee Name', 'Name'], adminId)} - ${referenceNow().toLocaleString('en-IN')}]: ${action} - ${remarks || ''}`,
    'Last Update Date': nowIso(),
    'Last Action By': first(adminUser, ['Employee Name', 'Name'], adminId)
  });
  await insertRow('TicketHistory', {
    'History ID': `HIST_${Date.now()}`,
    'Ticket ID': ticketId,
    ActionBy: first(adminUser, ['Employee Name', 'Name'], adminId),
    ActionType: status,
    Remarks: remarks,
    Timestamp: nowIso()
  });
  return ok({ message: 'Ticket action completed.', item: row });
}

export async function getTaskApproversList() {
  if (taskApproversCache && Date.now() - taskApproversCache.createdAt < APPROVAL_QUEUE_CACHE_TTL_MS) {
    return taskApproversCache.payload;
  }
  const users = await listDataRows('User', {}, {
    legacyId: 1,
    'data.Employee ID': 1,
    'data.User ID': 1,
    'data.EmpID': 1,
    'data.Employee Name': 1,
    'data.Name': 1,
    'data.name': 1,
    'data.Role': 1,
    'data.role': 1,
    'data.Status': 1,
    'data.status': 1,
    'data.Task Approver': 1,
    'data.taskApprover': 1,
    'data.Approver ID': 1,
    'data.Manager ID': 1,
    'data.Manager': 1,
    'data.managerId': 1,
    'data.Reporting Manager': 1
  });
  const referencedIds = new Set();
  users.forEach((user) => {
    [
      first(user, ['Task Approver', 'taskApprover', 'Approver ID']),
      first(user, ['Manager ID', 'Manager', 'managerId', 'Reporting Manager'])
    ].forEach((value) => assignedIds(value).forEach((id) => referencedIds.add(id.toUpperCase())));
  });
  const payload = users
    .filter((user) => {
      const id = userId(user).toUpperCase();
      const role = userRole(user);
      const active = eq(first(user, ['Status', 'status'], 'Active'), 'Active');
      return active && (referencedIds.has(id) || elevatedRoles.has(role));
    })
    .map((user) => ({ id: userId(user), name: first(user, ['Employee Name', 'Name', 'name'], userId(user)), role: first(user, ['Role', 'role'], 'User') }));
  taskApproversCache = { createdAt: Date.now(), payload };
  return payload;
}

export async function transferTicketApproval(ticketId, targetManagerId, currentManagerId, remarks) {
  clearApprovalQueueCache();
  const gate = await requireAttendanceActive(currentManagerId);
  if (gate) return gate;
  const userProjection = {
    legacyId: 1,
    'data.Employee ID': 1,
    'data.User ID': 1,
    'data.EmpID': 1,
    'data.employeeId': 1,
    'data.Employee Name': 1,
    'data.Name': 1,
    'data.Role': 1,
    'data.role': 1,
    'data.Department': 1,
    'data.department': 1,
    'data.Manager ID': 1,
    'data.Manager': 1,
    'data.managerId': 1,
    'data.Reporting Manager': 1,
    'data.Task Approver': 1,
    'data.taskApprover': 1,
    'data.Status': 1,
    'data.status': 1
  };
  const ticketProjection = {
    legacyId: 1,
    'data.Ticket ID': 1,
    'data.Employee ID': 1,
    'data.employeeId': 1,
    'data.EmpID': 1,
    'data.Status': 1,
    'data.Reassigned To': 1,
    'data.reassignedTo': 1,
    'data.Remarks': 1
  };
  const [ticket, users] = await Promise.all([
    listDataRows('Ticket', {
      $or: [{ legacyId: ticketId }, { 'data.Ticket ID': ticketId }, { 'data.Task ID': ticketId }, { 'data.ID': ticketId }]
    }, ticketProjection).then((rows) => rows[0] || null),
    listDataRows('User', {}, userProjection)
  ]);
  if (!ticket) return fail('Ticket not found.');
  const currentManager = users.find((user) => eq(userId(user), currentManagerId));
  const targetManager = users.find((user) => eq(userId(user), targetManagerId) && eq(first(user, ['Status', 'status'], 'Active'), 'Active'));
  if (!currentManager || !targetManager) return fail('Manager details not found.');
  if (!/pending approval|hr approved/i.test(first(ticket, ['Status']))) return fail('Only pending approval tickets can be transferred.');
  if (!ticketApprovalDecision(currentManager, ticket, users).actionable) return fail('Access Denied: You are not the designated approver for this ticket.');
  if (!safe(remarks)) return fail('Transfer remarks are required.');
  const row = await upsertRow('Ticket', 'Ticket ID', ticketId, {
    'Ticket ID': ticketId,
    'Reassigned To': targetManagerId,
    'Reassigned By': currentManagerId,
    Remarks: `[[Approval transferred by ${currentManagerId}]] ${remarks || ''}`,
    'Last Update Date': nowIso()
  });
  return ok({ message: 'Approval transferred.', item: row });
}
