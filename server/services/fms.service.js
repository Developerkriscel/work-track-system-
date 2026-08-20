import crypto from 'node:crypto';
import XLSX from 'xlsx';
import { LegacyModels } from '../models/legacyModels.js';
import {
  findOneRowByFilter,
  findRowsByFilter,
  insertRow,
  listRows,
  registerStoreMutationListener,
  stripInternalMetadata,
  touchStoreMutation,
  upsertRow
} from './legacyStore.service.js';
import { buildRedisKey, deleteByPrefix, getJson, setJson } from './redisCache.service.js';

const safe = (value = '') => String(value ?? '').trim();
const eq = (left, right) => safe(left).toLowerCase() === safe(right).toLowerCase();
const first = (row, keys, fallback = '') => keys.map((key) => row?.[key]).find((value) => safe(value)) ?? fallback;
const employeeIdOf = (row = {}) => first(row, ['Employee ID', 'employeeId', 'User ID', 'EmpID', 'EMP Code']);
const employeeNameOf = (row = {}) => first(row, ['Employee Name', 'employeeName', 'Name', 'Full Name'], employeeIdOf(row));
const roleOf = (row = {}) => first(row, ['Role', 'role', 'Designation'], 'User');
const statusOf = (row = {}) => first(row, ['Status', 'status'], 'Active');
const ok = (payload = {}) => ({ success: true, ...payload });
const fail = (message) => ({ success: false, message });
const elevatedFmsRoles = ['super admin', 'admin', 'hr', 'manager'];
const DEFAULT_FMS_SHEET_ID = '1uiJ9hA7NaxkdbjUwXUxzHt4WgLU6stqFfJhwf0raH9E';
const DEFAULT_FMS_SHEET_GID = '779912841';
const FMS_SHEET_SYNC_META_ID = '__FMS_SHEET_SYNC_META__';
const FMS_CACHE_TTL_MS = Number(process.env.WORKTRACK_FMS_CACHE_TTL_MS || 45_000);
const fmsSheetSyncState = { promise: null, lastAt: 0, lastError: null, lastCount: 0, lastChanged: 0 };
const fmsCache = new Map();
const fmsInflight = new Map();

function fmsCacheKey(scope, ...parts) {
  return buildRedisKey('fms', scope, ...parts.map((part) => safe(part)));
}

function readFmsMemoryCache(key) {
  const cached = fmsCache.get(key);
  if (!cached) return null;
  if (Date.now() - cached.at > FMS_CACHE_TTL_MS) {
    fmsCache.delete(key);
    return null;
  }
  return cached.value;
}

function writeFmsMemoryCache(key, value) {
  fmsCache.set(key, { at: Date.now(), value });
}

async function withFmsCache(key, loader) {
  const memory = readFmsMemoryCache(key);
  if (memory) return memory;

  const redis = await getJson(key);
  if (redis) {
    writeFmsMemoryCache(key, redis);
    return redis;
  }

  const inflight = fmsInflight.get(key);
  if (inflight) return inflight;

  const promise = (async () => {
    const value = await loader();
    writeFmsMemoryCache(key, value);
    await setJson(key, value, FMS_CACHE_TTL_MS);
    return value;
  })();

  fmsInflight.set(key, promise);
  try {
    return await promise;
  } finally {
    fmsInflight.delete(key);
  }
}

async function clearFmsCaches() {
  fmsCache.clear();
  fmsInflight.clear();
  await deleteByPrefix(buildRedisKey('fms'));
}

function looksLikeTempTask(row = {}) {
  const taskId = first(row, ['Task ID', 'ID', 'rowId', 'taskId', 'FMS ID', 'fmsId']);
  const ownerId = first(row, ['Employee ID', 'EmpID', 'empId', 'employeeId', 'EMP Code']);
  const ownerName = first(row, ['Employee Name', 'employeeName', 'Name', 'User', 'who']);
  const description = first(row, ['taskName', 'Task Description', 'Description', 'description', 'Content', 'content']);
  const haystack = `${taskId} ${ownerId} ${ownerName} ${description}`.toLowerCase();
  return /(^|\s)(tmp_|dbg_|debug|verify)(\s|_|$)/i.test(haystack);
}

function parseReferenceNow(value) {
  if (!value) return new Date();
  if (String(value).includes('T')) return new Date(value);
  return new Date(`${value}T12:00:00+05:30`);
}

const referenceNow = () => parseReferenceNow(process.env.WORKTRACK_REFERENCE_DATE);

function localDate(date = new Date()) {
  return new Date(date).toISOString().slice(0, 10);
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
  const mdyShort = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})(?:\s+.*)?$/);
  if (mdyShort) {
    return `20${mdyShort[3]}-${String(Number(mdyShort[1])).padStart(2, '0')}-${String(Number(mdyShort[2])).padStart(2, '0')}`;
  }
  const dmy = raw.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);
  if (dmy) return `${dmy[3]}-${String(dmy[2]).padStart(2, '0')}-${String(dmy[1]).padStart(2, '0')}`;
  const named = raw.match(/^(\d{1,2})[-\s]([A-Za-z]{3,9})[-\s](\d{4})(?:\s+.*)?$/);
  if (named) {
    const monthIndex = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
      .findIndex((monthName) => named[2].toLowerCase().startsWith(monthName));
    if (monthIndex >= 0) {
      return `${named[3]}-${String(monthIndex + 1).padStart(2, '0')}-${String(Number(named[1])).padStart(2, '0')}`;
    }
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? raw : parsed.toISOString().slice(0, 10);
}

function googleSheetCsvUrl() {
  if (safe(process.env.FMS_GOOGLE_SHEET_CSV_URL)) return safe(process.env.FMS_GOOGLE_SHEET_CSV_URL);
  const sheetId = safe(process.env.FMS_GOOGLE_SHEET_ID) || DEFAULT_FMS_SHEET_ID;
  const gid = safe(process.env.FMS_GOOGLE_SHEET_GID) || DEFAULT_FMS_SHEET_GID;
  return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
}

function fmsSheetSyncEnabled() {
  return !/^(false|0|no|off)$/i.test(safe(process.env.FMS_GOOGLE_SHEET_SYNC || 'true'));
}

function fmsSheetSyncTtlMs() {
  const value = Number(process.env.FMS_GOOGLE_SHEET_SYNC_TTL_MS);
  return Number.isFinite(value) && value >= 0 ? value : 15000;
}

function fmsSheetTaskId(row = {}, index = 0) {
  const fingerprint = [
    first(row, ['Employee ID']),
    first(row, ['Planned date']),
    first(row, ['FMS Name']),
    first(row, ['Task Name']),
    first(row, ['Step no']),
    first(row, ['Form Link']),
    index
  ].map((value) => safe(value).toLowerCase()).join('|');
  return `FMS_SHEET_${crypto.createHash('sha1').update(fingerprint).digest('hex').slice(0, 16).toUpperCase()}`;
}

function fmsSheetRowHash(row = {}) {
  const normalized = Object.keys(row)
    .sort()
    .map((key) => `${key}:${safe(row[key])}`)
    .join('|');
  return crypto.createHash('sha1').update(normalized).digest('hex');
}

function fmsSheetSnapshotHash(entries = []) {
  return crypto.createHash('sha1').update(entries.join('|')).digest('hex');
}

function normalizeFmsSheetRow(row = {}, index = 0, existing = {}) {
  const employeeId = safe(first(row, ['Employee ID', 'EMP ID', 'Emp ID']));
  const who = safe(first(row, ['Who'])) || employeeId;
  const taskName = safe(first(row, ['Task Name']));
  const planDateRaw = first(row, ['Planned date', 'Planned Date', 'Plan Date']);
  const actualDateRaw = first(row, ['Actual Date', 'Done Date']);
  const existingDoneDate = first(existing, ['Done Date', 'doneDate', 'actualDate']);
  const hasSheetDone = safe(actualDateRaw);
  const doneDate = hasSheetDone ? normalizedDate(actualDateRaw) : (safe(existingDoneDate) ? normalizedDate(existingDoneDate) : '');
  const status = doneDate ? 'Completed' : 'Pending';
  const taskId = first(existing, ['Task ID', 'ID', 'rowId'], fmsSheetTaskId(row, index));

  return {
    ...existing,
    'Task ID': taskId,
    ID: taskId,
    rowId: taskId,
    taskId,
    'Employee ID': employeeId,
    EmpID: employeeId,
    empId: employeeId,
    employeeId,
    'Employee Name': who,
    employeeName: who,
    User: who,
    who,
    what: first(row, ['What']),
    What: first(row, ['What']),
    when: first(row, ['When']),
    When: first(row, ['When']),
    how: first(row, ['How']),
    How: first(row, ['How']),
    Client: first(row, ['FMS Name']),
    'Client Name': first(row, ['FMS Name']),
    clientName: first(row, ['FMS Name']),
    fmsName: first(row, ['FMS Name']),
    'Task Name': taskName,
    taskName,
    'Task Description': taskName,
    Description: taskName,
    description: taskName,
    Step: first(row, ['Step no']),
    'Step No': first(row, ['Step no']),
    stepNo: first(row, ['Step no']),
    'Plan Date': normalizedDate(planDateRaw),
    Date: normalizedDate(planDateRaw),
    planDate: normalizedDate(planDateRaw),
    TAT: first(row, ['When'], '0'),
    tatMinutes: first(row, ['When'], '0'),
    Status: status,
    status,
    'Done Date': doneDate,
    doneDate,
    actualDate: doneDate,
    'Form Link': first(row, ['Form Link']),
    formLink: first(row, ['Form Link']),
    'Delay Days': first(row, ['Delay Days'], doneDate ? '0' : ''),
    delayDays: first(row, ['Delay Days'], doneDate ? '0' : ''),
    'On Time Status': first(row, ['On Time Status'], doneDate ? 'On Time' : 'Pending'),
    onTimeStatus: first(row, ['On Time Status'], doneDate ? 'On Time' : 'Pending'),
    Source: 'Google Sheet',
    source: 'google_sheet',
    sourceSheet: 'FMS',
    sourceRowNumber: index + 2,
    sourceUpdatedAt: nowIso(),
    sourceHash: fmsSheetRowHash(row),
    rawActualDate: actualDateRaw,
    rawPlanDate: planDateRaw
  };
}

function parseFmsSheetCsv(csvText = '') {
  const workbook = XLSX.read(csvText, { type: 'string', raw: false });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  return XLSX.utils
    .sheet_to_json(workbook.Sheets[sheetName], { defval: '', raw: false })
    .filter((row) => safe(first(row, ['Employee ID'])) && safe(first(row, ['Task Name'])));
}

async function fetchFmsSheetRows() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(process.env.FMS_GOOGLE_SHEET_FETCH_TIMEOUT_MS || 5000));
  const response = await fetch(googleSheetCsvUrl(), {
    headers: { Accept: 'text/csv,*/*' },
    signal: controller.signal
  }).finally(() => clearTimeout(timeout));
  if (!response.ok) {
    throw new Error(`FMS Google Sheet fetch failed (${response.status}).`);
  }
  return parseFmsSheetCsv(await response.text());
}

function fmsStoredTaskQuery(query = {}) {
  return Object.keys(query || {}).length
    ? { $and: [{ legacyId: { $ne: FMS_SHEET_SYNC_META_ID } }, query] }
    : { legacyId: { $ne: FMS_SHEET_SYNC_META_ID } };
}

async function readFmsSheetSyncMeta() {
  const doc = await LegacyModels.FmsTask.collection.findOne(
    { legacyId: FMS_SHEET_SYNC_META_ID },
    { projection: { data: 1, legacyId: 1 } }
  );
  return doc?.data || {};
}

async function writeFmsSheetSyncMeta(meta = {}) {
  await LegacyModels.FmsTask.collection.updateOne(
    { legacyId: FMS_SHEET_SYNC_META_ID },
    {
      $set: {
        legacyId: FMS_SHEET_SYNC_META_ID,
        data: {
          metaType: 'FMS_SHEET_SYNC_META',
          ...meta,
          updatedAt: nowIso()
        }
      }
    },
    { upsert: true }
  );
}

async function cleanupDuplicateFmsSheetRows(taskIds = []) {
  const match = { legacyId: /^FMS_SHEET_/ };
  const scopedTaskIds = uniqueIds(taskIds);
  if (scopedTaskIds.length) match.legacyId = { $in: scopedTaskIds };
  const duplicates = await LegacyModels.FmsTask.aggregate([
    { $match: match },
    { $sort: { updatedAt: -1, createdAt: -1 } },
    { $group: { _id: '$legacyId', ids: { $push: '$_id' }, count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } }
  ]);
  const staleIds = duplicates.flatMap((item) => item.ids.slice(1));
  if (staleIds.length) {
    await LegacyModels.FmsTask.deleteMany({ _id: { $in: staleIds } });
  }
  return staleIds.length;
}

function uniqueIds(values = []) {
  return [...new Set(values.map((value) => safe(value)).filter(Boolean))];
}

function fmsIdentityProjection() {
  return {
    legacyId: 1,
    'data.Task ID': 1,
    'data.ID': 1,
    'data.rowId': 1,
    'data.sourceHash': 1,
    'data.Done Date': 1,
    'data.doneDate': 1,
    'data.actualDate': 1
  };
}

function fmsIdentityKeyCandidates(row = {}) {
  return uniqueIds([
    row._legacyId,
    row.legacyId,
    first(row, ['Task ID', 'ID', 'rowId'])
  ]);
}

async function findExistingFmsSheetRows(taskIds = []) {
  const scopedTaskIds = uniqueIds(taskIds);
  if (!scopedTaskIds.length) return [];

  const projection = fmsIdentityProjection();
  const primaryRows = await findRowsByFilter(
    'FmsTask',
    { legacyId: { $in: scopedTaskIds } },
    { projection, sort: { createdAt: 1 } }
  );
  const rowsByKey = new Map();
  primaryRows.forEach((row) => {
    fmsIdentityKeyCandidates(row).forEach((key) => {
      if (!rowsByKey.has(key)) rowsByKey.set(key, row);
    });
  });

  const missingTaskIds = scopedTaskIds.filter((taskId) => !rowsByKey.has(taskId));
  if (!missingTaskIds.length) return [...new Set(primaryRows)];

  const fallbackRows = await findRowsByFilter(
    'FmsTask',
    {
      $or: [
        { 'data.Task ID': { $in: missingTaskIds } },
        { 'data.ID': { $in: missingTaskIds } },
        { 'data.rowId': { $in: missingTaskIds } }
      ]
    },
    { projection, sort: { createdAt: 1 } }
  );
  fallbackRows.forEach((row) => {
    fmsIdentityKeyCandidates(row).forEach((key) => {
      if (!rowsByKey.has(key)) rowsByKey.set(key, row);
    });
  });

  const deduped = [];
  const seen = new Set();
  for (const row of rowsByKey.values()) {
    const identity = safe(row?._id || row?._legacyId || first(row, ['Task ID', 'ID', 'rowId']));
    if (!identity || seen.has(identity)) continue;
    seen.add(identity);
    deduped.push(row);
  }
  return deduped;
}

async function cleanupStaleFmsSheetRows(currentTaskIds = []) {
  const staleIds = uniqueIds(currentTaskIds);
  if (!staleIds.length) return 0;
  const result = await LegacyModels.FmsTask.deleteMany({
    legacyId: { $in: staleIds }
  });
  return result.deletedCount || 0;
}

export async function syncFmsFromGoogleSheet() {
  if (!fmsSheetSyncEnabled()) return { synced: false, count: 0 };
  const rows = await fetchFmsSheetRows();
  const currentTaskIds = rows.map((row, index) => fmsSheetTaskId(row, index));
  const sheetEntries = rows.map((row, index) => {
    const taskId = currentTaskIds[index];
    return { taskId, sourceHash: fmsSheetRowHash(row) };
  });
  const currentTaskHashMap = Object.fromEntries(sheetEntries.map(({ taskId, sourceHash }) => [taskId, sourceHash]));
  const currentSheetHash = fmsSheetSnapshotHash(sheetEntries.map(({ taskId, sourceHash }) => `${taskId}:${sourceHash}`));
  const previousMeta = await readFmsSheetSyncMeta();
  const previousTaskHashMap = previousMeta.taskHashes && typeof previousMeta.taskHashes === 'object' ? previousMeta.taskHashes : {};
  const removedTaskIds = Object.keys(previousTaskHashMap).filter((taskId) => !currentTaskHashMap[taskId]);
  const changedTaskIds = sheetEntries
    .filter(({ taskId, sourceHash }) => previousTaskHashMap[taskId] !== sourceHash)
    .map(({ taskId }) => taskId);

  if (
    previousMeta.sheetHash === currentSheetHash
    && Number(previousMeta.rowCount || 0) === rows.length
    && !removedTaskIds.length
    && !changedTaskIds.length
  ) {
    fmsSheetSyncState.lastAt = Date.now();
    fmsSheetSyncState.lastError = null;
    fmsSheetSyncState.lastCount = rows.length;
    fmsSheetSyncState.lastChanged = 0;
    return { synced: true, count: rows.length, changed: 0 };
  }

  const existingRows = await findExistingFmsSheetRows(changedTaskIds);
  const existingByTaskId = new Map(
    existingRows.flatMap((row) => fmsIdentityKeyCandidates(row).map((key) => [key, row])).filter(([key]) => safe(key))
  );

  const operations = rows
    .map((row, index) => {
      const taskId = fmsSheetTaskId(row, index);
      if (!changedTaskIds.includes(taskId)) return null;
      const existing = existingByTaskId.get(taskId) || {};
      const sourceHash = currentTaskHashMap[taskId];
      if (first(existing, ['sourceHash']) === sourceHash) return null;
      return {
        updateMany: {
          filter: { $or: [{ legacyId: taskId }, { 'data.Task ID': taskId }, { 'data.ID': taskId }, { 'data.rowId': taskId }] },
          update: { $set: { legacyId: taskId, data: normalizeFmsSheetRow(row, index, existing) } },
          upsert: true
        }
      };
    })
    .filter(Boolean);

  if (operations.length) {
    await LegacyModels.FmsTask.bulkWrite(operations, { ordered: false });
  }
  const staleRemoved = await cleanupStaleFmsSheetRows(removedTaskIds);
  const duplicateRemoved = await cleanupDuplicateFmsSheetRows(changedTaskIds);
  await writeFmsSheetSyncMeta({
    sheetHash: currentSheetHash,
    rowCount: rows.length,
    taskHashes: currentTaskHashMap
  });
  if (operations.length || staleRemoved || duplicateRemoved) {
    touchStoreMutation('FmsTask');
  }

  fmsSheetSyncState.lastAt = Date.now();
  fmsSheetSyncState.lastError = null;
  fmsSheetSyncState.lastCount = rows.length;
  fmsSheetSyncState.lastChanged = operations.length;
  return { synced: true, count: rows.length, changed: operations.length };
}

async function ensureFmsSheetSynced({ blocking = false } = {}) {
  if (!fmsSheetSyncEnabled()) return;
  if (fmsSheetSyncState.lastAt && Date.now() - fmsSheetSyncState.lastAt < fmsSheetSyncTtlMs()) return;
  if (fmsSheetSyncState.promise) return blocking ? fmsSheetSyncState.promise : undefined;
  fmsSheetSyncState.promise = syncFmsFromGoogleSheet()
    .catch((error) => {
      fmsSheetSyncState.lastError = error.message;
      fmsSheetSyncState.lastAt = Date.now();
    })
    .finally(() => {
      fmsSheetSyncState.promise = null;
    });
  const hasExistingRows = await LegacyModels.FmsTask.estimatedDocumentCount().catch(() => 0);
  return blocking || !hasExistingRows ? fmsSheetSyncState.promise : undefined;
}

function splitIds(value = '') {
  return safe(value)
    .toLowerCase()
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function fmsCreatorAllowed(role) {
  return elevatedFmsRoles.includes(safe(role).toLowerCase());
}

function escapeRegex(value = '') {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasWholeToken(haystack, needle) {
  const text = safe(haystack).toLowerCase();
  const target = safe(needle).toLowerCase();
  if (!text || !target) return false;
  return new RegExp(`(^|[^a-z0-9_])${escapeRegex(target)}([^a-z0-9_]|$)`, 'i').test(text);
}

function fmsMatchesUser(targetId, targetName, task, firstNameCount = {}) {
  const id = safe(targetId).toLowerCase();
  const name = safe(targetName).toLowerCase();
  const who = first(task, ['who', 'Employee Name', 'User']);
  const empId = first(task, ['empId', 'Employee ID', 'EmpID']);
  if (id && eq(empId, id)) return true;
  if (id && hasWholeToken(who, id)) return true;
  if (name && hasWholeToken(who, name)) return true;
  const firstName = name.split(/\s+/)[0];
  return !!(firstName && firstNameCount[firstName] === 1 && hasWholeToken(who, firstName));
}

function buildSyntheticFmsUser(employeeId, tasks = []) {
  const matchedTask = tasks.find((task) => eq(first(task, ['Employee ID', 'employeeId', 'empId', 'EmpID', 'EMP Code']), employeeId));
  if (!matchedTask) return null;
  return {
    'Employee ID': safe(employeeId).toUpperCase(),
    'User ID': safe(employeeId).toUpperCase(),
    'Employee Name': first(matchedTask, ['Employee Name', 'employeeName', 'who', 'User', 'Assigned To'], safe(employeeId).toUpperCase()),
    Name: first(matchedTask, ['Employee Name', 'employeeName', 'who', 'User', 'Assigned To'], safe(employeeId).toUpperCase()),
    Role: 'User',
    Status: 'Active',
    Department: first(matchedTask, ['Department', 'department'], '')
  };
}

function buildFmsVisibilityContext(employeeId, users = [], tasks = []) {
  const currentUser = users.find((user) => eq(employeeIdOf(user), employeeId)) || buildSyntheticFmsUser(employeeId, tasks);
  if (!currentUser) return { valid: false, role: 'User', teamMembers: [], firstNameCount: {}, currentUser: null };
  const firstNameCount = {};
  users.forEach((user) => {
    if (!eq(statusOf(user), 'Active')) return;
    const firstName = safe(employeeNameOf(user)).toLowerCase().split(/\s+/)[0];
    if (firstName) firstNameCount[firstName] = (firstNameCount[firstName] || 0) + 1;
  });
  const currentId = safe(employeeIdOf(currentUser)).toLowerCase();
  const teamMembers = users.filter((user) => {
    if (!eq(statusOf(user), 'Active')) return false;
    if (eq(employeeIdOf(user), currentId)) return false;
    return splitIds(first(user, ['Manager ID', 'managerId', 'Manager', 'manager'])).includes(currentId) ||
      splitIds(first(user, ['Task Approver', 'taskApprover'])).includes(currentId);
  });
  return {
    valid: true,
    currentUser,
    role: roleOf(currentUser),
    teamMembers,
    firstNameCount
  };
}

function fmsVisibilityDecision(context, task) {
  if (!context.valid) return { canSee: false, isMyTask: false, isTeamTask: false };
  const isMyTask = fmsMatchesUser(employeeIdOf(context.currentUser), employeeNameOf(context.currentUser), task, context.firstNameCount);
  let isTeamTask = false;
  if (['Super Admin', 'HR'].includes(context.role)) {
    isTeamTask = !isMyTask;
  } else if (['Manager', 'Admin'].includes(context.role)) {
    isTeamTask = context.teamMembers.some((member) =>
      fmsMatchesUser(employeeIdOf(member), employeeNameOf(member), task, context.firstNameCount)
    );
  }
  return {
    canSee: ['Super Admin', 'HR'].includes(context.role) || isMyTask || isTeamTask,
    isMyTask,
    isTeamTask
  };
}

function directTeamMembersFor(employeeId, users = []) {
  const currentId = safe(employeeId).toLowerCase();
  return users.filter((user) => {
    if (!eq(statusOf(user), 'Active')) return false;
    if (eq(employeeIdOf(user), currentId)) return false;
    return splitIds(first(user, ['Manager ID', 'managerId', 'Manager', 'manager'])).includes(currentId);
  });
}

function assignableUsersFor(employeeId, role, users = []) {
  const normalizedRole = safe(role).toLowerCase();
  const activeUsers = users.filter((user) => eq(statusOf(user), 'Active'));
  let pool = [];

  if (normalizedRole === 'super admin' || normalizedRole === 'hr') {
    pool = activeUsers;
  } else if (normalizedRole === 'admin' || normalizedRole === 'manager') {
    const allowedIds = new Set([
      safe(employeeId).toLowerCase(),
      ...directTeamMembersFor(employeeId, activeUsers).map((member) => employeeIdOf(member).toLowerCase())
    ]);
    pool = activeUsers.filter((user) => allowedIds.has(employeeIdOf(user).toLowerCase()));
  } else if (safe(employeeId)) {
    const current = activeUsers.find((user) => eq(employeeIdOf(user), employeeId));
    pool = current ? [current] : [];
  }

  const seen = new Set();
  return pool
    .map((user) => {
      const id = employeeIdOf(user);
      return {
        id,
        name: employeeNameOf(user),
        role: roleOf(user),
        department: first(user, ['Department', 'department'], ''),
        status: statusOf(user),
        label: employeeNameOf(user) && employeeNameOf(user) !== id ? `${employeeNameOf(user)} (${id})` : id
      };
    })
    .filter((user) => {
      const key = safe(user.id).toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((left, right) => {
      const leftCurrent = safe(left.id).toLowerCase() === safe(employeeId).toLowerCase();
      const rightCurrent = safe(right.id).toLowerCase() === safe(employeeId).toLowerCase();
      if (leftCurrent !== rightCurrent) return leftCurrent ? -1 : 1;
      return left.label.localeCompare(right.label, undefined, { sensitivity: 'base' });
    });
}

function parseFmsTaskOptions(options = {}) {
  const filters = options.filters || {};
  return {
    paginated: options.paginated === true,
    tab: safe(options.tab || 'my-pending'),
    page: Math.max(1, Number(options.page || 1) || 1),
    pageSize: Math.min(100, Math.max(20, Number(options.pageSize || 20) || 20)),
    filters: {
      emp: safe(filters.emp),
      name: safe(filters.name),
      date: safe(filters.date),
      search: safe(filters.search).toLowerCase()
    }
  };
}

function classifyFmsTaskForTab(task) {
  const plan = normalizedDate(first(task, ['planDate', 'Plan Date', 'Date']));
  const completed = Boolean(first(task, ['actualDate', 'Done Date', 'doneDate'])) || /complete|done/i.test(safe(first(task, ['Status', 'status'])));
  const future = Boolean(plan && plan > today() && !completed);
  return {
    ...task,
    _completed: completed,
    _future: future,
    _pending: !completed && !future
  };
}

function filterFmsRowsByTab(rows = [], tab = '') {
  switch (tab) {
    case 'my-pending':
      return rows.filter((task) => task._isMyTask && task._pending);
    case 'my-future':
      return rows.filter((task) => task._isMyTask && task._future);
    case 'my-completed':
      return rows.filter((task) => task._isMyTask && task._completed);
    case 'team-pending':
      return rows.filter((task) => task._isTeamTask && task._pending);
    case 'team-future':
      return rows.filter((task) => task._isTeamTask && task._future);
    case 'team-completed':
      return rows.filter((task) => task._isTeamTask && task._completed);
    default:
      return rows;
  }
}

function filterFmsRows(rows = [], filters = {}) {
  return rows.filter((task) => {
    const employeeMatch = !filters.emp || safe(first(task, ['empId', 'Employee ID'])) === filters.emp;
    const categoryMatch = !filters.name || safe(first(task, ['fmsName', 'Client Name', 'Client'])) === filters.name;
    const dateMatch = !filters.date || safe(first(task, ['planDate', 'Plan Date', 'Date'])) === filters.date;
    const searchMatch = !filters.search || [
      task.empId,
      task.who,
      task.what,
      task.when,
      task.how,
      task.fmsName,
      task['Client Name'],
      task.Client,
      task.taskName,
      task['Task Description'],
      task.Description,
      task.stepNo,
      task.Status,
      task['On Time Status']
    ].filter(Boolean).join(' ').toLowerCase().includes(filters.search);
    return employeeMatch && categoryMatch && dateMatch && searchMatch;
  });
}

function sortFmsRows(rows = []) {
  return [...rows].sort((left, right) => {
    if (left._completed !== right._completed) return Number(left._completed) - Number(right._completed);
    return safe(first(right, ['planDate', 'Plan Date', 'Date'])).localeCompare(safe(first(left, ['planDate', 'Plan Date', 'Date'])));
  });
}

function fmsTabCounts(rows = []) {
  return {
    'my-pending': rows.filter((task) => task._isMyTask && task._pending).length,
    'my-future': rows.filter((task) => task._isMyTask && task._future).length,
    'my-completed': rows.filter((task) => task._isMyTask && task._completed).length,
    'team-pending': rows.filter((task) => task._isTeamTask && task._pending).length,
    'team-future': rows.filter((task) => task._isTeamTask && task._future).length,
    'team-completed': rows.filter((task) => task._isTeamTask && task._completed).length
  };
}

function fmsEmployeeOptions(rows = []) {
  const seen = new Map();
  rows.filter((task) => task._isTeamTask).forEach((task) => {
    const value = safe(first(task, ['empId', 'Employee ID']));
    if (!value || seen.has(value)) return;
    const person = safe(first(task, ['who', 'Employee Name'], value));
    seen.set(value, { value, label: person && person !== value ? `${person} (${value})` : value });
  });
  return [...seen.values()];
}

function fmsCategoryOptions(rows = []) {
  return [...new Set(rows.map((task) => safe(first(task, ['fmsName', 'Client Name', 'Client']))).filter(Boolean))];
}

function paginateFmsRows(rows = [], page = 1, pageSize = 60) {
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

function fmsIncompleteQuery() {
  return {
    $and: [
      { 'data.Status': { $not: /complete|done/i } },
      { 'data.status': { $not: /complete|done/i } },
      { $or: [{ 'data.Done Date': { $exists: false } }, { 'data.Done Date': '' }] },
      { $or: [{ 'data.doneDate': { $exists: false } }, { 'data.doneDate': '' }] },
      { $or: [{ 'data.actualDate': { $exists: false } }, { 'data.actualDate': '' }] }
    ]
  };
}

function fmsCompletedQuery() {
  return {
    $or: [
      { 'data.Status': /complete|done/i },
      { 'data.status': /complete|done/i },
      { 'data.Done Date': { $exists: true, $nin: ['', null] } },
      { 'data.doneDate': { $exists: true, $nin: ['', null] } },
      { 'data.actualDate': { $exists: true, $nin: ['', null] } }
    ]
  };
}

function fmsOwnerQuery(ids = []) {
  const cleanIds = ids.map((id) => safe(id)).filter(Boolean);
  if (!cleanIds.length) return { _id: { $exists: false } };
  return {
    $or: [
      { 'data.Employee ID': { $in: cleanIds } },
      { 'data.EmpID': { $in: cleanIds } },
      { 'data.empId': { $in: cleanIds } },
      { 'data.employeeId': { $in: cleanIds } },
      { 'data.EMP Code': { $in: cleanIds } }
    ]
  };
}

function fmsScopeQuery(tab, context) {
  const currentId = employeeIdOf(context.currentUser);
  const teamIds = context.teamMembers.map((member) => employeeIdOf(member)).filter(Boolean);
  if (tab.startsWith('my-')) return fmsOwnerQuery([currentId]);
  if (['Super Admin', 'HR'].includes(context.role)) {
    return {
      $and: [
        { $nor: [{ 'data.Employee ID': currentId }, { 'data.EmpID': currentId }, { 'data.empId': currentId }, { 'data.employeeId': currentId }, { 'data.EMP Code': currentId }] }
      ]
    };
  }
  return fmsOwnerQuery(teamIds);
}

function fmsDateQuery(tab) {
  if (tab.endsWith('completed')) return fmsCompletedQuery();
  const incomplete = fmsIncompleteQuery();
  const planKeys = ['data.Plan Date', 'data.planDate', 'data.Date', 'data.date'];
  const comparator = tab.endsWith('future') ? { $gt: today() } : { $lte: today() };
  return {
    $and: [
      incomplete,
      { $or: planKeys.map((key) => ({ [key]: comparator })) }
    ]
  };
}

function fmsFilterQuery(filters = {}) {
  const clauses = [];
  if (filters.emp) clauses.push(fmsOwnerQuery([filters.emp]));
  if (filters.name) {
    clauses.push({
      $or: [
        { 'data.fmsName': filters.name },
        { 'data.Client Name': filters.name },
        { 'data.Client': filters.name },
        { 'data.clientName': filters.name }
      ]
    });
  }
  if (filters.date) {
    clauses.push({
      $or: [
        { 'data.Plan Date': filters.date },
        { 'data.planDate': filters.date },
        { 'data.Date': filters.date },
        { 'data.date': filters.date }
      ]
    });
  }
  if (filters.search) {
    const regex = new RegExp(escapeRegex(filters.search), 'i');
    clauses.push({
      $or: [
        { 'data.Employee ID': regex },
        { 'data.empId': regex },
        { 'data.Employee Name': regex },
        { 'data.who': regex },
        { 'data.What': regex },
        { 'data.what': regex },
        { 'data.How': regex },
        { 'data.how': regex },
        { 'data.fmsName': regex },
        { 'data.Client Name': regex },
        { 'data.Task Name': regex },
        { 'data.Task Description': regex },
        { 'data.Description': regex },
        { 'data.stepNo': regex },
        { 'data.Status': regex }
      ]
    });
  }
  return clauses.length ? { $and: clauses } : {};
}

function combineMongoQuery(...parts) {
  const clauses = parts.filter((part) => part && Object.keys(part).length);
  return clauses.length ? { $and: clauses } : {};
}

function fmsTaskProjection() {
  return {
    legacyId: 1,
    'data.Task ID': 1,
    'data.ID': 1,
    'data.rowId': 1,
    'data.taskId': 1,
    'data.FMS ID': 1,
    'data.fmsId': 1,
    'data.Employee ID': 1,
    'data.EmpID': 1,
    'data.empId': 1,
    'data.employeeId': 1,
    'data.EMP Code': 1,
    'data.Employee Name': 1,
    'data.employeeName': 1,
    'data.User': 1,
    'data.Who': 1,
    'data.who': 1,
    'data.Assigned To': 1,
    'data.what': 1,
    'data.What': 1,
    'data.when': 1,
    'data.When': 1,
    'data.how': 1,
    'data.How': 1,
    'data.Client': 1,
    'data.Client Name': 1,
    'data.fmsName': 1,
    'data.clientName': 1,
    'data.Client_Id': 1,
    'data.Client ID': 1,
    'data.CustomerID': 1,
    'data.clientId': 1,
    'data.taskName': 1,
    'data.Task Name': 1,
    'data.Task Description': 1,
    'data.Description': 1,
    'data.description': 1,
    'data.stepNo': 1,
    'data.Step': 1,
    'data.Step No': 1,
    'data.Plan Date': 1,
    'data.planDate': 1,
    'data.Date': 1,
    'data.date': 1,
    'data.TAT': 1,
    'data.tatMinutes': 1,
    'data.Duration': 1,
    'data.Actual Duration': 1,
    'data.duration': 1,
    'data.Status': 1,
    'data.status': 1,
    'data.Done Date': 1,
    'data.doneDate': 1,
    'data.actualDate': 1,
    'data.Form Link': 1,
    'data.Form link': 1,
    'data.formLink': 1,
    'data.On Time Status': 1,
    'data.Delay Days': 1
  };
}

async function getFmsPagedRows(employeeId, options) {
  await ensureFmsSheetSynced();
  const key = fmsCacheKey(
    'paged',
    safe(employeeId).toUpperCase(),
    options.tab,
    options.page,
    options.pageSize,
    options.filters.emp,
    options.filters.name,
    options.filters.date,
    options.filters.search
  );

  return withFmsCache(key, async () => {
    const users = await listDataRows('User', {}, {
      legacyId: 1,
      'data.Employee ID': 1,
      'data.User ID': 1,
      'data.EmpID': 1,
      'data.EMP Code': 1,
      'data.employeeId': 1,
      'data.Employee Name': 1,
      'data.employeeName': 1,
      'data.Name': 1,
      'data.Full Name': 1,
      'data.Role': 1,
      'data.role': 1,
      'data.Designation': 1,
      'data.Status': 1,
      'data.status': 1,
      'data.Manager ID': 1,
      'data.managerId': 1,
      'data.Manager': 1,
      'data.manager': 1,
      'data.Task Approver': 1,
      'data.taskApprover': 1,
      'data.Department': 1,
      'data.department': 1
    });
    const context = buildFmsVisibilityContext(employeeId, users, []);
    if (!context.valid) return { error: fail('Access denied: user not found.') };

    const baseForTab = (tab) => combineMongoQuery(fmsScopeQuery(tab, context), fmsDateQuery(tab), fmsFilterQuery(options.filters));
    const activeQuery = baseForTab(options.tab);
    const skip = (options.page - 1) * options.pageSize;
    const [docs, total, tabCountEntries, categoryDocs, employeeDocs] = await Promise.all([
      findRowsByFilter('FmsTask', fmsStoredTaskQuery(activeQuery), {
        projection: fmsTaskProjection(),
        sort: { 'data.Plan Date': 1, createdAt: 1 },
        skip,
        limit: options.pageSize
      }),
      LegacyModels.FmsTask.countDocuments(fmsStoredTaskQuery(activeQuery)),
      Promise.all(['my-pending', 'my-future', 'my-completed', 'team-pending', 'team-future', 'team-completed'].map(async (tab) => [
        tab,
        await LegacyModels.FmsTask.countDocuments(fmsStoredTaskQuery(combineMongoQuery(fmsScopeQuery(tab, context), fmsDateQuery(tab))))
      ])),
      LegacyModels.FmsTask.distinct('data.fmsName', fmsStoredTaskQuery(combineMongoQuery(fmsScopeQuery(options.tab, context)))).catch(() => []),
      findRowsByFilter('FmsTask', fmsStoredTaskQuery(fmsScopeQuery('team-pending', context)), {
        projection: {
          'data.Employee ID': 1,
          'data.empId': 1,
          'data.Employee Name': 1,
          'data.who': 1
        },
        limit: 500
      })
    ]);

    const clients = [];
    const rows = docs
      .filter((item) => !looksLikeTempTask(item))
      .map((item) => {
        const row = classifyFmsTaskForTab(normalizeFmsForDashboard(item, users, clients));
        const decision = fmsVisibilityDecision(context, row);
        return { ...row, _isMyTask: decision.isMyTask, _isTeamTask: decision.isTeamTask, _canSee: decision.canSee, _role: context.role };
      })
      .filter((row) => row._canSee);

    const totalPages = Math.max(1, Math.ceil(total / options.pageSize));
    const safePage = Math.min(options.page, totalPages);
    const employeeOptions = fmsEmployeeOptions(employeeDocs.map((item) => {
      const row = normalizeFmsForDashboard(item, users, clients);
      return { ...row, _isTeamTask: true };
    }));

    return {
      users,
      context,
      rows,
      total,
      meta: {
        tabCounts: Object.fromEntries(tabCountEntries),
        categoryOptions: categoryDocs.filter(Boolean).sort(),
        employeeOptions,
        pagination: {
          page: safePage,
          pageSize: options.pageSize,
          total,
          totalPages,
          start: total ? skip + 1 : 0,
          end: Math.min(skip + options.pageSize, total),
          tab: options.tab
        }
      }
    };
  });
}

function normalizeFmsCreatePayload(payload = {}) {
  const assigneeId = first(payload, ['Employee ID', 'employeeId', 'Assignee ID', 'assigneeId', 'Assign To'], '');
  const fmsName = first(payload, ['FMS Name', 'fmsName', 'Client Name', 'Client', 'Project'], 'General');
  const taskName = first(payload, ['Task Name', 'taskName', 'Task', 'Description', 'Task Description'], '');
  const taskDescription = first(payload, ['Task Description', 'description', 'Description', 'Task'], taskName);
  const planDate = normalizedDate(first(payload, ['Plan Date', 'planDate', 'Date'], today()));
  const tatMinutes = String(Math.max(0, Number(first(payload, ['TAT', 'tatMinutes', 'When'], 0)) || 0));
  return {
    assigneeId,
    fmsName,
    taskName,
    taskDescription,
    planDate,
    tatMinutes,
    what: first(payload, ['What', 'what', 'Task Category', 'Category', 'Department'], ''),
    how: first(payload, ['How', 'how'], ''),
    stepNo: first(payload, ['Step No', 'stepNo', 'Step'], ''),
    formLink: first(payload, ['Form Link', 'formLink'], ''),
    remarks: first(payload, ['Remarks', 'remarks'], '')
  };
}

function taskOwnerName(task, users = []) {
  const explicit = first(task, ['Employee Name', 'employeeName', 'User', 'Who', 'who', 'Assigned To', 'assignedTo']);
  if (explicit) return explicit;
  const empId = first(task, ['Employee ID', 'EmpID', 'empId', 'employeeId', 'EMP Code']);
  const user = users.find((item) => eq(employeeIdOf(item), empId));
  return employeeNameOf(user) || empId || 'Unassigned';
}

function clientName(task, clients = []) {
  const explicit = first(task, ['Client', 'Client Name', 'CustomerName', 'fmsName', 'clientName']);
  if (explicit) return explicit;
  const clientId = first(task, ['Client_Id', 'Client ID', 'CustomerID', 'clientId']);
  const client = clients.find((item) => eq(first(item, ['Client_Id', 'Client ID', 'CustomerID', 'clientId']), clientId));
  return client?.['Client Name'] || 'Internal / General';
}

function normalizeFmsForDashboard(task, users, clients) {
  const status = first(task, ['Status', 'status'], first(task, ['Done Date', 'doneDate', 'actualDate']) ? 'Completed' : 'Pending');
  const date = first(task, ['Plan Date', 'planDate', 'Date', 'date'], today());
  const taskId = first(task, ['Task ID', 'ID', 'rowId', 'taskId', 'FMS ID', 'fmsId']);
  const ownerId = first(task, ['Employee ID', 'EmpID', 'empId', 'employeeId', 'EMP Code']);
  const ownerName = taskOwnerName(task, users);
  const resolvedClientName = clientName(task, clients);
  const description = first(task, ['taskName', 'Task Description', 'Description', 'description', 'Content', 'content']);
  const doneDateRaw = first(task, ['Done Date', 'doneDate', 'actualDate']);
  const planDate = normalizedDate(date);
  const doneDate = safe(doneDateRaw) ? normalizedDate(doneDateRaw) : '';
  return {
    ID: taskId,
    rowId: first(task, ['rowId', 'Task ID', 'ID', 'taskId', 'FMS ID', 'fmsId'], taskId),
    Type: 'FMS',
    Client: resolvedClientName,
    User: ownerName,
    Status: status,
    status,
    Date: planDate,
    date: planDate,
    'Plan Date': planDate,
    planDate,
    TAT: first(task, ['TAT', 'When', 'tatMinutes'], '0'),
    tatMinutes: first(task, ['tatMinutes', 'TAT', 'When'], '0'),
    Duration: first(task, ['Duration', 'Actual Duration', 'duration'], '0h 0m'),
    duration: first(task, ['duration', 'Duration', 'Actual Duration'], '0h 0m'),
    Description: description,
    description,
    'Employee ID': ownerId,
    empId: ownerId,
    employeeId: ownerId,
    'Employee Name': ownerName,
    employeeName: ownerName,
    who: first(task, ['who', 'Who', 'Employee Name', 'employeeName', 'User', 'Assigned To', 'assignedTo'], ownerName),
    what: first(task, ['what', 'What', 'Department', 'department'], ''),
    when: first(task, ['when', 'When', 'TAT', 'tatMinutes'], ''),
    how: first(task, ['how', 'How', 'Channel', 'channel'], ''),
    'Client Name': first(task, ['Client Name', 'Client', 'fmsName', 'clientName'], resolvedClientName),
    fmsName: first(task, ['fmsName', 'Client Name', 'Client', 'clientName'], resolvedClientName),
    clientId: first(task, ['clientId', 'Client_Id', 'Client ID', 'CustomerID'], ''),
    'Task ID': taskId,
    taskId,
    taskName: description,
    stepNo: first(task, ['stepNo', 'Step', 'Step No'], ''),
    actualDate: doneDate,
    doneDate,
    'Done Date': doneDate,
    formLink: first(task, ['formLink', 'Form Link', 'Form link'], '')
  };
}

function attendanceEventTime(row) {
  const date = normalizedDate(first(row, ['Date'], today()));
  const time = first(row, ['Time', 'Punch In', 'Punch Out']);
  const parsed = new Date(time || date);
  if (!Number.isNaN(parsed.getTime()) && /T|GMT|UTC|\d{4}-\d{2}-\d{2}/i.test(String(time || date))) return parsed.getTime();
  return new Date(`${date}T00:00:00+05:30`).getTime();
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

async function requireAttendanceActive(employeeId) {
  if (!safe(employeeId) || eq(employeeId, 'client')) return null;
  const attendance = await findRowsByFilter(
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
  if (isAttendanceActive(attendance, employeeId)) return null;
  return fail('Attendance Required: Aapne aaj ki Attendance (Punch In) mark nahi ki hai ya aap already Punch Out kar chuke hain. Kripya pehle Punch In karein!');
}

async function getRows() {
  return getFmsReadRows();
}

function fromLegacyDocs(docs = []) {
  return docs.map((doc) => ({
    ...stripInternalMetadata(doc.data || {}),
    _id: String(doc._id),
    _legacyId: doc.legacyId
  }));
}

async function listDataRows(modelName, query = {}, projection = { data: 1, legacyId: 1 }) {
  return findRowsByFilter(modelName, query, { projection, sort: { createdAt: 1 } });
}

async function getFmsReadRows() {
  await ensureFmsSheetSynced();
  return withFmsCache(fmsCacheKey('read-rows'), async () => {
    const userProjection = {
      legacyId: 1,
      'data.Employee ID': 1,
      'data.User ID': 1,
      'data.EmpID': 1,
      'data.EMP Code': 1,
      'data.employeeId': 1,
      'data.Employee Name': 1,
      'data.employeeName': 1,
      'data.Name': 1,
      'data.Full Name': 1,
      'data.Role': 1,
      'data.role': 1,
      'data.Designation': 1,
      'data.Status': 1,
      'data.status': 1,
      'data.Manager ID': 1,
      'data.managerId': 1,
      'data.Manager': 1,
      'data.manager': 1,
      'data.Task Approver': 1,
      'data.taskApprover': 1,
      'data.Department': 1,
      'data.department': 1
    };
    const clientProjection = {
      legacyId: 1,
      'data.Client_Id': 1,
      'data.Client ID': 1,
      'data.CustomerID': 1,
      'data.clientId': 1,
      'data.Client Name': 1,
      'data.Name': 1
    };
    const fmsProjection = {
      legacyId: 1,
      'data.Task ID': 1,
      'data.ID': 1,
      'data.rowId': 1,
      'data.taskId': 1,
      'data.FMS ID': 1,
      'data.fmsId': 1,
      'data.Employee ID': 1,
      'data.EmpID': 1,
      'data.empId': 1,
      'data.employeeId': 1,
      'data.EMP Code': 1,
      'data.Employee Name': 1,
      'data.employeeName': 1,
      'data.User': 1,
      'data.Who': 1,
      'data.who': 1,
      'data.Assigned To': 1,
      'data.assignedTo': 1,
      'data.what': 1,
      'data.What': 1,
      'data.Department': 1,
      'data.department': 1,
      'data.when': 1,
      'data.When': 1,
      'data.how': 1,
      'data.How': 1,
      'data.Channel': 1,
      'data.channel': 1,
      'data.Client': 1,
      'data.Client Name': 1,
      'data.CustomerName': 1,
      'data.fmsName': 1,
      'data.clientName': 1,
      'data.Client_Id': 1,
      'data.Client ID': 1,
      'data.CustomerID': 1,
      'data.clientId': 1,
      'data.taskName': 1,
      'data.Task Name': 1,
      'data.Task Description': 1,
      'data.Description': 1,
      'data.description': 1,
      'data.Content': 1,
      'data.content': 1,
      'data.stepNo': 1,
      'data.Step': 1,
      'data.Step No': 1,
      'data.Plan Date': 1,
      'data.planDate': 1,
      'data.Date': 1,
      'data.date': 1,
      'data.TAT': 1,
      'data.tatMinutes': 1,
      'data.Duration': 1,
      'data.Actual Duration': 1,
      'data.duration': 1,
      'data.Status': 1,
      'data.status': 1,
      'data.Done Date': 1,
      'data.doneDate': 1,
      'data.actualDate': 1,
      'data.Form Link': 1,
      'data.Form link': 1,
      'data.formLink': 1,
      'data.On Time Status': 1,
      'data.Delay Days': 1
    };
    const [users, clients, fms] = await Promise.all([
      listDataRows('User', {}, userProjection),
      listDataRows('Client', {}, clientProjection),
      listDataRows('FmsTask', fmsStoredTaskQuery(), fmsProjection)
    ]);
    return { users, clients, fms };
  });
}

export async function getFmsTasks(employeeId, options = {}) {
  const taskOptions = parseFmsTaskOptions(options);
  if (taskOptions.paginated) {
    const paged = await getFmsPagedRows(employeeId, taskOptions);
    if (paged.error) return paged.error;
    return ok({
      data: paged.rows,
      meta: {
        role: paged.context.role,
        teamCount: paged.context.teamMembers.length,
        canCreate: fmsCreatorAllowed(paged.context.role),
        sheetSync: {
          enabled: fmsSheetSyncEnabled(),
          count: fmsSheetSyncState.lastCount,
          changed: fmsSheetSyncState.lastChanged,
          lastAt: fmsSheetSyncState.lastAt ? new Date(fmsSheetSyncState.lastAt).toISOString() : '',
          error: fmsSheetSyncState.lastError || ''
        },
        tabCounts: paged.meta.tabCounts,
        employeeOptions: paged.meta.employeeOptions,
        categoryOptions: paged.meta.categoryOptions,
        pagination: paged.meta.pagination,
        serverPaged: true
      }
    });
  }
  const data = await getRows();
  const liveFmsRows = data.fms.filter((item) => !looksLikeTempTask(item));
  const context = buildFmsVisibilityContext(employeeId, data.users, liveFmsRows);
  if (!context.valid) return fail('Access denied: user not found.');
  const items = liveFmsRows
    .map((item) => {
      const row = normalizeFmsForDashboard(item, data.users, data.clients);
      const decision = fmsVisibilityDecision(context, row);
      row._isMyTask = decision.isMyTask;
      row._isTeamTask = decision.isTeamTask;
      row._canSee = decision.canSee;
      row._role = context.role;
      return classifyFmsTaskForTab(row);
    })
    .filter((row) => row._canSee);
  const meta = {
    role: context.role,
    teamCount: context.teamMembers.length,
    canCreate: fmsCreatorAllowed(context.role),
    sheetSync: {
      enabled: fmsSheetSyncEnabled(),
      count: fmsSheetSyncState.lastCount,
      changed: fmsSheetSyncState.lastChanged,
      lastAt: fmsSheetSyncState.lastAt ? new Date(fmsSheetSyncState.lastAt).toISOString() : '',
      error: fmsSheetSyncState.lastError || ''
    }
  };
  if (taskOptions.paginated) {
    const tabRows = filterFmsRowsByTab(items, taskOptions.tab);
    const filteredRows = sortFmsRows(filterFmsRows(tabRows, taskOptions.filters));
    const paged = paginateFmsRows(filteredRows, taskOptions.page, taskOptions.pageSize);
    return ok({
      data: paged.rows,
      meta: {
        ...meta,
        tabCounts: fmsTabCounts(items),
        employeeOptions: fmsEmployeeOptions(items),
        categoryOptions: fmsCategoryOptions(items),
        pagination: { ...paged.pagination, tab: taskOptions.tab },
        serverPaged: true
      }
    });
  }
  return ok({
    data: items,
    meta
  });
}

export async function getFmsAssignableUsers(employeeId) {
  await ensureFmsSheetSynced();
  const key = fmsCacheKey('assignable', safe(employeeId).toUpperCase());
  return withFmsCache(key, async () => {
    const users = await listDataRows('User', {
      $or: [
        { 'data.Status': 'Active' },
        { 'data.status': 'Active' },
        { 'data.Status': { $exists: false } },
        { 'data.status': { $exists: false } }
      ]
    }, {
      legacyId: 1,
      'data.Employee ID': 1,
      'data.User ID': 1,
      'data.EmpID': 1,
      'data.EMP Code': 1,
      'data.employeeId': 1,
      'data.Employee Name': 1,
      'data.employeeName': 1,
      'data.Name': 1,
      'data.Full Name': 1,
      'data.Role': 1,
      'data.role': 1,
      'data.Designation': 1,
      'data.Status': 1,
      'data.status': 1,
      'data.Manager ID': 1,
      'data.managerId': 1,
      'data.Manager': 1,
      'data.manager': 1,
      'data.Task Approver': 1,
      'data.taskApprover': 1,
      'data.Department': 1,
      'data.department': 1
    });
    const data = { users, fms: [] };
    const liveFmsRows = data.fms.filter((item) => !looksLikeTempTask(item));
    const context = buildFmsVisibilityContext(employeeId, data.users, liveFmsRows);
    if (!context.valid) return fail('Access denied: user not found.');
    if (!fmsCreatorAllowed(context.role)) {
      return fail('Access denied: only Admin, HR, Manager, and Super Admin can create FMS tasks.');
    }
    return ok({
      data: assignableUsersFor(employeeId, context.role, data.users),
      meta: { role: context.role, teamCount: context.teamMembers.length, canCreate: true }
    });
  });
}

export async function createFmsTask(payload = {}, employeeId) {
  const data = await getRows();
  const liveFmsRows = data.fms.filter((item) => !looksLikeTempTask(item));
  const context = buildFmsVisibilityContext(employeeId, data.users, liveFmsRows);
  if (!context.valid) return fail('Access denied: user not found.');
  if (!fmsCreatorAllowed(context.role)) {
    return fail('Access denied: only Admin, HR, Manager, and Super Admin can create FMS tasks.');
  }

  const form = normalizeFmsCreatePayload(payload);
  const assignableUsers = assignableUsersFor(employeeId, context.role, data.users);
  const assignee = assignableUsers.find((user) => eq(user.id, form.assigneeId)) || assignableUsers[0];
  if (!assignee) return fail('Assign To is required.');
  if (!form.taskName) return fail('Task Name is required.');
  if (!form.taskDescription) return fail('Task Description is required.');

  const taskId = `FMS_${Date.now()}_${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const creator = context.currentUser;
  const row = await insertRow('FmsTask', {
    'Task ID': taskId,
    ID: taskId,
    rowId: taskId,
    'Employee ID': assignee.id,
    empId: assignee.id,
    employeeId: assignee.id,
    'Employee Name': assignee.name,
    employeeName: assignee.name,
    User: assignee.name,
    who: assignee.name,
    'Client_Id': '',
    'Client ID': '',
    Client: form.fmsName,
    'Client Name': form.fmsName,
    clientName: form.fmsName,
    fmsName: form.fmsName,
    what: form.what,
    when: form.tatMinutes,
    how: form.how,
    stepNo: form.stepNo,
    'Task Name': form.taskName,
    taskName: form.taskName,
    'Task Description': form.taskDescription,
    Description: form.taskDescription,
    description: form.taskDescription,
    'Plan Date': form.planDate,
    Date: form.planDate,
    planDate: form.planDate,
    TAT: form.tatMinutes,
    tatMinutes: form.tatMinutes,
    Status: 'Pending',
    status: 'Pending',
    'Done Date': '',
    doneDate: '',
    actualDate: '',
    Remarks: form.remarks,
    remarks: form.remarks,
    'Form Link': form.formLink,
    formLink: form.formLink,
    'Created By': employeeId,
    createdBy: employeeId,
    'Created By Name': employeeNameOf(creator),
    createdByName: employeeNameOf(creator),
    'Created At': nowIso(),
    createdAt: nowIso(),
    'Last Update Date': nowIso(),
    'Latest Update Date': nowIso(),
    lastUpdateDate: nowIso(),
    'On Time Status': 'Pending',
    onTimeStatus: 'Pending',
    'Delay Days': 0,
    delayDays: 0
  });

  return ok({ message: 'FMS task created.', item: row });
}

export async function markFmsTaskDone(rowId, remarks, employeeId) {
  const gate = await requireAttendanceActive(employeeId);
  if (gate) return gate;
  const data = await getRows();
  const liveFmsRows = data.fms.filter((item) => !looksLikeTempTask(item));
  const context = buildFmsVisibilityContext(employeeId, data.users, liveFmsRows);
  if (!context.valid) return fail('Access denied: user not found.');
  const existing = liveFmsRows
    .map((item) => normalizeFmsForDashboard(item, data.users, data.clients))
    .find((item) => eq(item['Task ID'] || item.ID || item.rowId, rowId));
  if (!existing) return fail('FMS task not found.');
  const decision = fmsVisibilityDecision(context, existing);
  if (!decision.canSee) return fail('Access denied: this FMS task is not assigned to you or your hierarchy.');
  if (!decision.isMyTask) return fail('View only: manager/team FMS tasks can be viewed, but only assigned user can complete them.');
  if (first(existing, ['Done Date', 'actualDate'])) return fail('Task is already completed.');

  const planDate = normalizedDate(first(existing, ['Plan Date', 'Date'], today()));
  const actualDate = today();
  const delayDays = Math.max(
    0,
    Math.ceil(
      (new Date(`${actualDate}T00:00:00+05:30`) - new Date(`${planDate}T00:00:00+05:30`)) / (24 * 60 * 60 * 1000)
    )
  );
  const row = await upsertRow('FmsTask', 'Task ID', rowId, {
    'Task ID': rowId,
    taskId: rowId,
    Status: 'Completed',
    status: 'Completed',
    'Done Date': actualDate,
    doneDate: actualDate,
    'Last Update Date': nowIso(),
    actualDate,
    'Delay Days': delayDays,
    delayDays,
    'On Time Status': delayDays > 0 ? 'Late' : 'On Time',
    onTimeStatus: delayDays > 0 ? 'Late' : 'On Time',
    Remarks: remarks || '',
    'Completed By': employeeId
  });
  return ok({ message: 'FMS task completed.', item: row });
}

registerStoreMutationListener((modelName = '') => {
  if (!['FmsTask', 'User', 'Client'].includes(String(modelName || ''))) return;
  void clearFmsCaches();
});
