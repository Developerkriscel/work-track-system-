import { saveBase64File } from './fileStorage.service.js';
import {
  findOneRowByFilter,
  findRowsByFilter,
  getLegacyId,
  insertRow,
  listRows,
  registerStoreMutationListener,
  sheetAttendance,
  stripInternalMetadata,
  upsertRow
} from './legacyStore.service.js';
import { LegacyModels } from '../models/legacyModels.js';
import { buildRedisKey, deleteByPrefix, getJson, setJson } from './redisCache.service.js';
import { holidayDateOf, holidayNameOf, isActiveHoliday } from './holiday.service.js';

const safe = (value) => String(value ?? '').trim();
const eq = (left, right) => safe(left).toLowerCase() === safe(right).toLowerCase();
const first = (row, keys, fallback = '') => keys.map((key) => row?.[key]).find((value) => safe(value)) ?? fallback;
const num = (value) => Number(String(value ?? 0).replace(/[^0-9.-]/g, '')) || 0;
const ok = (payload = {}) => ({ success: true, ...payload });
const fail = (message) => ({ success: false, message });
const ATTENDANCE_POLICY_ID = 'ATTENDANCE_LOCATION_POLICY';
const ATTENDANCE_CACHE_TTL_MS = Number(process.env.WORKTRACK_ATTENDANCE_CACHE_TTL_MS || 30_000);
const attendanceCache = new Map();
const attendanceInflight = new Map();

function identityKey(value = '') {
  return safe(value).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function attendanceCacheKey(scope, ...parts) {
  return buildRedisKey('attendance', scope, ...parts.map((part) => String(part ?? '').trim()));
}

function readAttendanceMemoryCache(key) {
  const cached = attendanceCache.get(key);
  if (!cached) return null;
  if (Date.now() - cached.at > ATTENDANCE_CACHE_TTL_MS) {
    attendanceCache.delete(key);
    return null;
  }
  return cached.value;
}

function writeAttendanceMemoryCache(key, value) {
  attendanceCache.set(key, { at: Date.now(), value });
}

async function withAttendanceCache(key, loader) {
  const memory = readAttendanceMemoryCache(key);
  if (memory) return memory;

  const redis = await getJson(key);
  if (redis) {
    writeAttendanceMemoryCache(key, redis);
    return redis;
  }

  const inflight = attendanceInflight.get(key);
  if (inflight) return inflight;

  const promise = (async () => {
    const value = await loader();
    writeAttendanceMemoryCache(key, value);
    await setJson(key, value, ATTENDANCE_CACHE_TTL_MS);
    return value;
  })();

  attendanceInflight.set(key, promise);
  try {
    return await promise;
  } finally {
    attendanceInflight.delete(key);
  }
}

async function clearAttendanceCaches() {
  attendanceCache.clear();
  attendanceInflight.clear();
  await deleteByPrefix(buildRedisKey('attendance'));
}

function parseReferenceNow(value) {
  if (!value) return new Date();
  if (String(value).includes('T')) return new Date(value);
  return new Date(`${value}T12:00:00+05:30`);
}

const referenceNow = () => parseReferenceNow(process.env.WORKTRACK_REFERENCE_DATE);
const WORKTRACK_TIME_ZONE = process.env.WORKTRACK_TIME_ZONE || 'Asia/Kolkata';

function localDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: WORKTRACK_TIME_ZONE,
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

function escapeRegex(value = '') {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function uniqueValues(values = []) {
  return Array.from(new Set(values.filter(Boolean)));
}

function ymd(year, month, day) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function normalizedDateCandidates(value) {
  if (!value) return [today()];
  const raw = safe(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return [raw.slice(0, 10)];

  const numeric = raw.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2}|\d{4})(?:\s+\d{1,2}:\d{2}(?::\d{2})?\s*(?:am|pm)?)?$/i);
  if (numeric) {
    const left = Number(numeric[1]);
    const right = Number(numeric[2]);
    const year = numeric[3].length === 2 ? `20${numeric[3]}` : numeric[3];
    const dates = [];
    if (left >= 1 && left <= 31 && right >= 1 && right <= 12) dates.push(ymd(year, right, left));
    if (right >= 1 && right <= 31 && left >= 1 && left <= 12) dates.push(ymd(year, left, right));
    return uniqueValues(dates);
  }

  const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  const dayMonthName = raw.match(/^(\d{1,2})[-\s]([A-Za-z]{3,9})[-\s](\d{4})(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?$/);
  if (dayMonthName) {
    const monthIndex = monthNames.findIndex((monthName) => dayMonthName[2].toLowerCase().startsWith(monthName));
    if (monthIndex >= 0) return [ymd(dayMonthName[3], monthIndex + 1, Number(dayMonthName[1]))];
  }

  const monthNameDay = raw.match(/^([A-Za-z]{3,9})[-\s](\d{1,2})[-,\s]+(\d{4})(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?$/);
  if (monthNameDay) {
    const monthIndex = monthNames.findIndex((monthName) => monthNameDay[1].toLowerCase().startsWith(monthName));
    if (monthIndex >= 0) return [ymd(monthNameDay[3], monthIndex + 1, Number(monthNameDay[2]))];
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? [raw] : [localDate(parsed)];
}

function normalizedDate(value) {
  return normalizedDateCandidates(value)[0] || safe(value);
}

function dateInRange(value, start, end) {
  if (!start || !end || !value) return true;
  return normalizedDateCandidates(value).some((date) => date >= start && date <= end);
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

  return new Date(
    `${date}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}+05:30`
  ).toISOString();
}

function timestampFromElapsedMinutes(minutes) {
  const value = num(minutes);
  if (!value) return '';
  return new Date(Date.now() - value * 60000).toISOString();
}

function localDateLabel(dateValue) {
  const date = new Date(`${normalizedDate(dateValue)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return normalizedDate(dateValue);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'short'
  });
}

function userId(user = {}) {
  return first(user, ['Employee ID', 'employeeId', 'User ID', 'EmpID']);
}

function userRole(user = {}) {
  return safe(first(user, ['Role', 'role'], 'User')).toLowerCase();
}

function isActiveUser(user = {}) {
  const status = first(user, ['Status', 'status'], 'Active');
  return !safe(status) || eq(status, 'Active');
}

function canManageTeamAttendance(user = {}) {
  return /^(admin|super admin|hr|manager)$/i.test(first(user, ['Role', 'role'], ''));
}

function directReportIds(reviewerId, users = []) {
  const target = safe(reviewerId).toUpperCase();
  return users
    .filter((user) => {
      if (!isActiveUser(user)) return false;
      const managers = safe(first(user, ['Manager ID', 'Manager', 'managerId', 'Reporting Manager']));
      return managers.split(/[,;|]/).map((item) => item.trim().toUpperCase()).includes(target);
    })
    .map((user) => safe(userId(user)).toUpperCase())
    .filter(Boolean);
}

function isApprovedStatus(value = '') {
  return /approved|hr approved|accepted/i.test(safe(value));
}

function isWorkFromHomeIntimation(row = {}) {
  return /work\s*from\s*home/i.test(first(row, ['Intimation Type', 'IntimationType', 'Type', 'SubType']));
}

function getPolicyNumber(value, fallback = 0) {
  const parsed = Number(String(value ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeLocationPolicy(row = {}) {
  let locations = [];
  try {
    const rawLocations = first(row, ['Locations', 'locations']);
    if (Array.isArray(rawLocations)) {
      locations = rawLocations;
    } else if (typeof rawLocations === 'string') {
      locations = JSON.parse(rawLocations || '[]');
    }
  } catch {
    locations = [];
  }
  
  if (!locations.length && first(row, ['Latitude', 'Lattitude', 'Office Latitude', 'latitude'])) {
    locations.push({
      officeName: first(row, ['Office Name', 'Office', 'Location Name', 'Location', 'officeName'], ''),
      latitude: first(row, ['Latitude', 'Lattitude', 'Office Latitude', 'latitude'], ''),
      longitude: first(row, ['Longitude', 'Office Longitude', 'longitude'], ''),
      radiusMeters: getPolicyNumber(first(row, ['Radius (Meters)', 'Radius', 'Allowed Radius', 'radiusMeters'], 200), 200) || 200
    });
  }

  return {
    policyId: first(row, ['PolicyID', 'ID', 'policyId', 'AttendancePolicyID'], ATTENDANCE_POLICY_ID),
    enabled: !/^(false|0|no|off)$/i.test(safe(first(row, ['Enabled', 'Active', 'Status', 'enabled'], 'true'))),
    locations,
    updatedBy: first(row, ['Updated By', 'UpdatedBy', 'updatedBy'], ''),
    updatedAt: first(row, ['Updated At', 'UpdatedAt', 'updatedAt'], '')
  };
}

function locationPolicyRecord(policy = {}) {
  const normalized = normalizeLocationPolicy(policy);
  return {
    PolicyID: normalized.policyId,
    AttendancePolicyID: normalized.policyId,
    ID: normalized.policyId,
    policyId: normalized.policyId,
    Enabled: normalized.enabled ? 'true' : 'false',
    enabled: normalized.enabled,
    Locations: JSON.stringify(normalized.locations || []),
    locations: JSON.stringify(normalized.locations || []),
    'Updated By': normalized.updatedBy,
    updatedBy: normalized.updatedBy,
    'Updated At': normalized.updatedAt,
    updatedAt: normalized.updatedAt
  };
}

async function getAttendanceLocationPolicy() {
  const row = await findOneRowByFilter(
    'AttendancePolicy',
    {
      $or: [
        { 'data.PolicyID': ATTENDANCE_POLICY_ID },
        { 'data.ID': ATTENDANCE_POLICY_ID },
        { 'data.policyId': ATTENDANCE_POLICY_ID },
        { 'data.AttendancePolicyID': ATTENDANCE_POLICY_ID }
      ]
    },
    {
      projection: { data: 1, legacyId: 1 },
      sort: { updatedAt: -1, createdAt: -1 }
    }
  );
  if (!row) {
    return normalizeLocationPolicy(locationPolicyRecord({
      PolicyID: ATTENDANCE_POLICY_ID,
      Enabled: true,
      'Radius (Meters)': 200
    }));
  }
  return normalizeLocationPolicy(row);
}

async function saveAttendanceLocationPolicy(policy = {}, editorId = '') {
  const next = locationPolicyRecord({
    ...policy,
    policyId: ATTENDANCE_POLICY_ID,
    updatedBy: safe(editorId),
    updatedAt: nowIso()
  });
  await upsertRow('AttendancePolicy', 'PolicyID', ATTENDANCE_POLICY_ID, next);
  return normalizeLocationPolicy(next);
}

function haversineDistanceMeters(leftLat, leftLng, rightLat, rightLng) {
  const toRad = (value) => (Number(value) * Math.PI) / 180;
  const lat1 = Number(leftLat);
  const lng1 = Number(leftLng);
  const lat2 = Number(rightLat);
  const lng2 = Number(rightLng);
  if (![lat1, lng1, lat2, lng2].every((value) => Number.isFinite(value))) return Number.NaN;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function isWFHApprovedForDate(employeeId, dateValue) {
  const date = normalizedDate(dateValue || today());
  const intimationRows = await findIntimationRows(
    {
      $and: [
        employeeIdQuery(employeeId),
        {
          $or: [
            { 'data.Intimation Date': date },
            { 'data.Date': date },
            { 'data.date': date }
          ]
        }
      ]
    },
    {
      legacyId: 1,
      'data.Employee ID': 1,
      'data.User ID': 1,
      'data.employeeId': 1,
      'data.EmpID': 1,
      'data.Intimation Date': 1,
      'data.Date': 1,
      'data.date': 1,
      'data.Intimation Type': 1,
      'data.type': 1,
      'data.Reason': 1,
      'data.Status': 1,
      'data.status': 1
    }
  );
  return intimationRows.some((row) => isWorkFromHomeIntimation(row) && isApprovedStatus(first(row, ['Status', 'status'])));
}

async function canPunchAtLocation(employeeId, latitude, longitude, dateValue = today()) {
  const policy = await getAttendanceLocationPolicy();
  const wfhApproved = await isWFHApprovedForDate(employeeId, dateValue);
  if (!policy.enabled || wfhApproved) {
    return { allowed: true, policy, wfhApproved, mode: wfhApproved ? 'WFH' : 'Open' };
  }

  const locations = policy.locations || [];
  if (!locations.length) {
    return { allowed: true, policy, wfhApproved: false, mode: 'Open' };
  }

  let minDistance = Infinity;
  let closestLocation = null;

  for (const loc of locations) {
    if (!safe(loc.latitude) || !safe(loc.longitude)) continue;
    const distance = haversineDistanceMeters(loc.latitude, loc.longitude, latitude, longitude);
    if (!Number.isFinite(distance)) continue;
    if (distance < minDistance) {
      minDistance = distance;
      closestLocation = loc;
    }
  }

  if (!closestLocation || !Number.isFinite(minDistance)) {
    return {
      allowed: false,
      policy,
      wfhApproved: false,
      mode: 'Office',
      message: 'Attendance location check failed. Invalid GPS coordinates received or no valid locations defined.'
    };
  }

  const radiusMeters = Math.max(25, getPolicyNumber(closestLocation.radiusMeters, 200) || 200);
  if (minDistance <= radiusMeters) {
    return {
      allowed: true,
      policy,
      location: closestLocation,
      distanceMeters: minDistance,
      wfhApproved: false,
      mode: 'Office'
    };
  }

  return {
    allowed: false,
    policy,
    closestLocation,
    distanceMeters: minDistance,
    wfhApproved: false,
    mode: 'Office',
    message: `You are out of the attendance zone. Closest office is ${Math.round(minDistance)}m away (max allowed is ${radiusMeters}m).`
  };
}

function durationLabel(start, end) {
  if (!start || !end) return '';
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return '';
  const diff = Math.round((end - start) / 60000);
  const hours = Math.floor(diff / 60);
  const minutes = diff % 60;
  return `${hours}h ${minutes}m`;
}

function holidayMapFromRows(rows = []) {
  const map = new Map();
  for (const row of rows || []) {
    if (!isActiveHoliday(row)) continue;
    const date = holidayDateOf(row);
    if (date) map.set(date, { date, name: holidayNameOf(row), row });
  }
  return map;
}

function holidayForDate(holidayMap = new Map(), dateValue) {
  return holidayMap.get(normalizedDate(dateValue));
}

async function loadHolidayRowsForRange(startDate, endDate) {
  const start = normalizedDate(startDate || today());
  const end = normalizedDate(endDate || startDate || today());
  return (await listRows('Holiday')).filter((row) => {
    const holidayDate = holidayDateOf(row);
    return isActiveHoliday(row) && Boolean(holidayDate) && dateInRange(holidayDate, start, end);
  });
}

function holidayAttendanceRows(holidayRows = [], startDate, endDate) {
  const start = normalizedDate(startDate || today());
  const end = normalizedDate(endDate || startDate || today());
  return holidayRows
    .filter((row) => holidayDateOf(row) && dateInRange(holidayDateOf(row), start, end))
    .map((row) => ({
      AttendanceID: `HOLIDAY_${holidayDateOf(row)}`,
      Date: holidayDateOf(row),
      Action: 'Holiday',
      Time: '',
      'Punch In': '',
      'Punch Out': '',
      Status: 'Holiday',
      status: 'Holiday',
      holidayName: holidayNameOf(row),
      isHoliday: true
    }));
}

function computeAttendanceStatus(dateValue, punchInRow, holidayMap = new Map(), punchOutRow = null) {
  if (holidayForDate(holidayMap, dateValue)) return 'Holiday';
  if (!punchInRow && !punchOutRow) {
    const day = new Date(`${normalizedDate(dateValue)}T00:00:00`).getDay();
    return day === 0 ? 'Weekly Off' : 'Absent';
  }

  const inTime = punchInRow ? new Date(timestampForAttendance(dateValue, first(punchInRow, ['Punch In', 'Time']), 'Punch In')) : null;
  const outTime = punchOutRow ? new Date(timestampForAttendance(dateValue, first(punchOutRow, ['Punch Out', 'Time']), 'Punch Out')) : null;

  if (inTime && !Number.isNaN(inTime.getTime())) {
    const shiftStartGrace = new Date(`${normalizedDate(dateValue)}T10:15:00+05:30`);
    const isLateIn = inTime.getTime() > shiftStartGrace.getTime();

    if (isLateIn) {
      return 'Half Day';
    }

    if (outTime && !Number.isNaN(outTime.getTime())) {
      const workedMinutes = (outTime.getTime() - inTime.getTime()) / 60000;
      if (workedMinutes < 480) { // < 8 hours
        return 'Half Day';
      }
    }

    const shiftStart = new Date(`${normalizedDate(dateValue)}T10:00:00+05:30`);
    if (inTime.getTime() < shiftStart.getTime()) {
      return 'Early';
    }
    return 'On Time';
  }

  if (outTime) return 'Half Day';

  return 'Present';
}

function computeDepartureStatus(dateValue, punchInRow, punchOutRow) {
  if (!punchOutRow) return null;
  const punchTime = new Date(timestampForAttendance(dateValue, first(punchOutRow, ['Punch Out', 'Time']), 'Punch Out'));
  if (Number.isNaN(punchTime.getTime())) return null;

  let completedFullShift = false;
  if (punchInRow) {
    const inTime = new Date(timestampForAttendance(dateValue, first(punchInRow, ['Punch In', 'Time']), 'Punch In'));
    if (!Number.isNaN(inTime.getTime())) {
      const shiftDurationMinutes = (punchTime.getTime() - inTime.getTime()) / 60000;
      if (shiftDurationMinutes >= 480) { // 8 hours
        completedFullShift = true;
      }
    }
  }

  const shiftEnd = new Date(`${normalizedDate(dateValue)}T19:00:00+05:30`);
  const difference = (punchTime.getTime() - shiftEnd.getTime()) / 60000;
  if (difference < -15 && !completedFullShift) return 'Early Departure';
  if (difference <= 60) return 'On Time Departure';
  return 'Late Departure';
}

function personLabelFromId(users = [], value = '') {
  const id = safe(value).toUpperCase();
  if (!id) return '';
  const user = users.find((item) => [userId(item), first(item, ['User ID', 'employeeId', 'EmpID'])]
    .some((candidate) => safe(candidate).toUpperCase() === id));
  return user ? first(user, ['Employee Name', 'Name'], id) : id;
}

function extractEditedName(remark = '') {
  const match = safe(remark).match(/edited by\s+(.+?)(?:\s+on\s+|$)/i);
  return match ? safe(match[1]) : '';
}

function attendanceRemarkItems(rows = [], users = []) {
  const seen = new Set();
  const items = [];
  const push = (type, text) => {
    const value = safe(text);
    if (!value) return;
    const key = `${type}:${value.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    items.push({ type, text: value });
  };

  for (const row of rows.filter(Boolean)) {
    const approval = first(row, ['Admin Approval', 'adminApproval']);
    const remark = first(row, ['Admin Remarks', 'adminRemarks']);
    const approvedBy = first(row, ['Approved By', 'approvedBy', 'Approved By Name', 'approvedByName']) ||
      personLabelFromId(users, first(row, ['Approved By ID', 'approvedById', 'Admin ID', 'adminId', 'AdminID']));
    const editedBy = first(row, ['Edited By', 'editedBy', 'Edited By Name', 'editedByName']) ||
      extractEditedName(remark) ||
      personLabelFromId(users, first(row, ['Edited By ID', 'editedById', 'Admin ID', 'adminId', 'AdminID']));
    const hasEditSignal = /edit|edited|correct/i.test(remark) || Boolean(first(row, ['newPunchIn', 'newPunchOut', 'New Punch In', 'New Punch Out']));
    const hasApprovalSignal = /approved/i.test(approval) || (/approved/i.test(remark) && !/edit|edited|correct/i.test(remark));

    if (hasApprovalSignal && !/edit|edited|correct/i.test(remark)) {
      push('approved', approvedBy ? `Approved by ${approvedBy}` : 'Approved');
    }
    if (hasEditSignal) {
      push('edited', editedBy ? `Edited by ${editedBy}` : 'Edited');
    }
  }

  return items;
}

function teamAttendanceAccessSet(reviewer = {}, users = []) {
  if (!canManageTeamAttendance(reviewer)) return new Set();
  const role = safe(first(reviewer, ['Role', 'role'], ''));
  if (/^(admin|super admin|hr)$/i.test(role)) {
    return new Set(
      users
        .filter((user) => isActiveUser(user))
        .map((user) => safe(userId(user)).toUpperCase())
        .filter(Boolean)
    );
  }
  return new Set(
    directReportIds(userId(reviewer), users)
  );
}

function dateWithinRange(dateValue, startDate, endDate) {
  const date = normalizedDate(dateValue);
  const start = normalizedDate(startDate || date);
  const end = normalizedDate(endDate || start);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && /^\d{4}-\d{2}-\d{2}$/.test(start) && /^\d{4}-\d{2}-\d{2}$/.test(end) && start <= date && date <= end;
}

function buildTeamAttendanceGroups(attendanceRows, users, allowedIds, startDate, endDate, holidayRows = []) {
  const holidayMap = holidayMapFromRows(holidayRows);
  const userMap = new Map(users.map((user) => [safe(userId(user)).toUpperCase(), user]));
  const groups = new Map();

  attendanceRows
    .filter((row) => {
      const employeeId = safe(first(row, ['Employee ID', 'employeeId', 'EmpID'])).toUpperCase();
      const date = normalizedDate(first(row, ['Date', 'date']));
      if (!allowedIds.has(employeeId) || !dateInRange(date, startDate, endDate)) return false;
      const employee = userMap.get(employeeId);
      const joiningDateStr = employee ? first(employee, ['Date of Joining', 'Joining Date', 'Date Of Joining']) : '';
      if (joiningDateStr && normalizedDate(joiningDateStr) > date) return false;
      return true;
    })
    .forEach((rawRow) => {
      const employeeId = safe(first(rawRow, ['Employee ID', 'employeeId', 'EmpID'])).toUpperCase();
      const employee = userMap.get(employeeId) || {};
      const expanded = attendanceRowsForApp(rawRow).map((event) => ({
        ...event,
        _sourceLegacyId: getLegacyId('Attendance', rawRow),
        _sourceRow: rawRow
      }));

      expanded.forEach((event) => {
        const date = normalizedDate(first(event, ['Date', 'date']));
        const key = `${employeeId}__${date}`;
        if (!groups.has(key)) {
          groups.set(key, {
            id: key,
            date,
            dateLabel: localDateLabel(date),
            employeeId,
            employeeName: first(employee, ['Employee Name', 'Name'], first(event, ['Employee Name', 'Name'], employeeId)),
            role: first(employee, ['Role', 'role'], ''),
            department: first(employee, ['Department', 'department'], ''),
            punchesIn: [],
            punchesOut: []
          });
        }
        const group = groups.get(key);
        if (/punch\s*in/i.test(safe(event.Action))) group.punchesIn.push(event);
        if (/punch\s*out/i.test(safe(event.Action))) group.punchesOut.push(event);
      });
    });

  const s = normalizedDate(startDate || today());
  const e = normalizedDate(endDate || startDate || today());
  const loopStart = new Date(`${s}T12:00:00+05:30`);
  const loopEnd = new Date(`${e}T12:00:00+05:30`);
  let currentLoop = loopStart;
  let days = 0;

  while (currentLoop <= loopEnd && days < 31) {
    const loopDate = localDate(currentLoop);
    users
      .filter((user) => {
        const employeeId = safe(userId(user)).toUpperCase();
        if (!(employeeId && allowedIds.has(employeeId) && isActiveUser(user))) return false;
        const joiningDateStr = first(user, ['Date of Joining', 'Joining Date', 'Date Of Joining']);
        if (joiningDateStr && normalizedDate(joiningDateStr) > loopDate) return false;
        return true;
      })
      .forEach((user) => {
        const employeeId = safe(userId(user)).toUpperCase();
        const key = `${employeeId}__${loopDate}`;
        if (!groups.has(key)) {
          groups.set(key, {
            id: key,
            date: loopDate,
            dateLabel: localDateLabel(loopDate),
            employeeId,
            employeeName: first(user, ['Employee Name', 'Name'], employeeId),
            role: first(user, ['Role', 'role'], ''),
            department: first(user, ['Department', 'department'], ''),
            punchesIn: [],
            punchesOut: []
          });
        }
      });
    currentLoop.setDate(currentLoop.getDate() + 1);
    days++;
  }

  return Array.from(groups.values())
    .map((group) => {
      const punchIn = group.punchesIn.sort((left, right) => attendanceEventTime(left) - attendanceEventTime(right))[0] || null;
      const punchOut = group.punchesOut.sort((left, right) => attendanceEventTime(right) - attendanceEventTime(left))[0] || null;
      const inDate = punchIn ? new Date(timestampForAttendance(group.date, first(punchIn, ['Punch In', 'Time']), 'Punch In')) : null;
      const outDate = punchOut ? new Date(timestampForAttendance(group.date, first(punchOut, ['Punch Out', 'Time']), 'Punch Out')) : null;
      const adminRemarkItems = attendanceRemarkItems([...group.punchesIn, ...group.punchesOut], users);

      return {
        id: group.id,
        date: group.date,
        dateLabel: group.dateLabel,
        employeeId: group.employeeId,
        employeeName: group.employeeName,
        role: group.role,
        department: group.department,
        punchIn,
        punchOut,
        punchInTime: first(punchIn, ['Punch In']),
        punchOutTime: first(punchOut, ['Punch Out']),
        punchInSourceId: punchIn?._sourceLegacyId || '',
        punchOutSourceId: punchOut?._sourceLegacyId || '',
        status: computeAttendanceStatus(group.date, punchIn, holidayMap, punchOut),
        holidayName: holidayForDate(holidayMap, group.date)?.name || '',
        isHoliday: Boolean(holidayForDate(holidayMap, group.date)),
        outStatus: computeDepartureStatus(group.date, punchIn, punchOut),
        duration: durationLabel(inDate, outDate) || first(punchOut, ['Duration', 'Total Duration']) || '-',
        adminRemarks: adminRemarkItems.map((item) => item.text).join(' | '),
        adminRemarkItems
      };
    })
    .sort((left, right) => {
      if (left.date === right.date) return left.employeeName.localeCompare(right.employeeName);
      return left.date.localeCompare(right.date);
    });
}

function currentEditorRemark(editor = {}) {
  const name = first(editor, ['Employee Name', 'Name'], userId(editor) || 'Admin');
  return `Attendance edited by ${name} on ${referenceNow().toLocaleString('en-IN', { timeZone: WORKTRACK_TIME_ZONE })}`;
}

function mergeAttendanceRow(baseRow = {}, updates = {}) {
  return {
    ...baseRow,
    ...updates,
    Latitude: updates.Latitude ?? baseRow.Latitude ?? baseRow.Lattitude ?? '',
    Lattitude: updates.Lattitude ?? updates.Latitude ?? baseRow.Lattitude ?? baseRow.Latitude ?? '',
    Longitude: updates.Longitude ?? baseRow.Longitude ?? '',
    Photo: updates.Photo ?? baseRow.Photo ?? baseRow['Photo Url'] ?? baseRow['Photo URL'] ?? '',
    'Photo Url': updates['Photo Url'] ?? updates.Photo ?? baseRow['Photo Url'] ?? baseRow.Photo ?? '',
    'Photo URL': updates['Photo URL'] ?? updates.Photo ?? baseRow['Photo URL'] ?? baseRow.Photo ?? ''
  };
}

function buildAttendanceEditTarget(existingRow, defaults) {
  return existingRow ? { ...existingRow } : sheetAttendance(defaults);
}

function normalizeTimeValue(value) {
  return safe(value).toLowerCase();
}

function timesEqual(left, right) {
  return normalizeTimeValue(left) === normalizeTimeValue(right);
}

function editKey(employeeId, date, action) {
  return `ATT_EDIT_${safe(employeeId).toUpperCase()}_${normalizedDate(date)}_${safe(action).replace(/\s+/g, '_').toUpperCase()}`;
}

function requireTeamAttendanceReviewer(reviewerId, users) {
  const target = identityKey(reviewerId);
  const reviewer = users.find((user) => {
    const candidates = [
      userId(user),
      first(user, ['User ID', 'Employee ID', 'EMP Code', 'employeeId', 'EmpID']),
      first(user, ['Employee Name', 'Name'], '')
    ];
    return candidates.some((value) => identityKey(value) === target);
  });
  if (!reviewer || !canManageTeamAttendance(reviewer)) return null;
  return reviewer;
}

function attendanceRowsForApp(row = {}) {
  const base = sheetAttendance(row);
  const date = normalizedDate(base.Date);
  const photo = first(base, ['Photo Url', 'Photo URL', 'Photo']);
  const actionValue = safe(first(base, ['Action', 'action'], ''));
  const inferredPunchIn = /punch\s*in/i.test(actionValue) || Boolean(first(base, ['Punch In', 'InTime']));
  const inferredPunchOut = /punch\s*out/i.test(actionValue) || Boolean(first(base, ['Punch Out', 'OutTime']));
  const common = {
    ...base,
    Date: date,
    Lattitude: first(base, ['Lattitude', 'Latitude']),
    Latitude: first(base, ['Latitude', 'Lattitude']),
    Longitude: first(base, ['Longitude']),
    'Photo Url': photo,
    'Photo URL': photo,
    Photo: photo
  };
  const rows = [];
  const punchIn = first(base, ['Punch In', 'InTime']);
  const punchOut = first(base, ['Punch Out', 'OutTime']);

  if (punchIn || inferredPunchIn) {
    const elapsedTime = timestampFromElapsedMinutes(base['Timer Elapsed Minutes']);
    rows.push({
      ...common,
      Action: 'Punch In',
      Time: elapsedTime || timestampForAttendance(date, first(base, ['Time'], punchIn || base.Time), 'Punch In'),
      'Punch In': punchIn || first(base, ['Time']),
      'Punch Out': ''
    });
  }

  if (punchOut || inferredPunchOut) {
    rows.push({
      ...common,
      Action: 'Punch Out',
      Time: timestampForAttendance(date, punchOut || first(base, ['Time']), 'Punch Out'),
      'Punch In': '',
      'Punch Out': punchOut || first(base, ['Time'])
    });
  }

  if (!rows.length) rows.push({ ...common, Action: actionValue || 'Record', Time: timestampForAttendance(date, base.Time, actionValue) });
  return rows;
}

function fromLegacyDocs(docs = []) {
  return docs.map((doc) => ({
    ...stripInternalMetadata(doc.data || {}),
    _id: String(doc._id),
    _legacyId: doc.legacyId
  }));
}

async function findAttendanceRows(query = {}, projection = { data: 1, legacyId: 1 }) {
  const docs = await LegacyModels.Attendance.collection.find(query, { projection }).toArray();
  return fromLegacyDocs(docs);
}

async function findUserRows(query = {}, projection = { data: 1, legacyId: 1 }) {
  const docs = await LegacyModels.User.collection.find(query, { projection }).toArray();
  return fromLegacyDocs(docs);
}

async function findLeaveRows(query = {}, projection = { data: 1, legacyId: 1 }) {
  const docs = await LegacyModels.Leave.collection.find(query, { projection }).toArray();
  return fromLegacyDocs(docs);
}

async function findIntimationRows(query = {}, projection = { data: 1, legacyId: 1 }) {
  const docs = await LegacyModels.Intimation.collection.find(query, { projection }).toArray();
  return fromLegacyDocs(docs);
}

function teamAttendanceUserProjection() {
  return {
    legacyId: 1,
    'data.Employee ID': 1,
    'data.employeeId': 1,
    'data.User ID': 1,
    'data.EmpID': 1,
    'data.Employee Name': 1,
    'data.Name': 1,
    'data.Role': 1,
    'data.role': 1,
    'data.Status': 1,
    'data.status': 1,
    'data.Department': 1,
    'data.department': 1,
    'data.Manager ID': 1,
    'data.Manager': 1,
    'data.managerId': 1,
    'data.Reporting Manager': 1,
    'data.Task Approver': 1,
    'data.Approver ID': 1,
    'data.taskApprover': 1,
    'data.Date of Joining': 1,
    'data.Joining Date': 1,
    'data.Date Of Joining': 1
  };
}

async function loadTeamAttendanceUsers(reviewerId = '', targetEmployeeId = '') {
  const identityClauses = [employeeIdQuery(reviewerId)];
  if (safe(targetEmployeeId)) identityClauses.push(employeeIdQuery(targetEmployeeId));
  return findUserRows(
    {
      $or: [
        {
          $or: [
            { 'data.Status': 'Active' },
            { 'data.status': 'Active' },
            { 'data.Status': { $exists: false } },
            { 'data.status': { $exists: false } }
          ]
        },
        ...identityClauses
      ]
    },
    teamAttendanceUserProjection()
  );
}

function employeeIdQuery(value = '') {
  const employeeId = safe(value).toUpperCase();
  return {
    $or: [
      { 'data.Employee ID': employeeId },
      { 'data.employeeId': employeeId },
      { 'data.EmpID': employeeId },
      { 'data.User ID': employeeId }
    ]
  };
}

function employeeIdsQuery(values = []) {
  const ids = Array.from(new Set(values.map((value) => safe(value).toUpperCase()).filter(Boolean)));
  if (!ids.length) return null;
  return {
    $or: [
      { 'data.Employee ID': { $in: ids } },
      { 'data.employeeId': { $in: ids } },
      { 'data.EmpID': { $in: ids } },
      { 'data.User ID': { $in: ids } }
    ]
  };
}

function dateRangeFieldQuery(keys = [], startDate, endDate) {
  const start = normalizedDate(startDate || today());
  const end = normalizedDate(endDate || startDate || today());
  const variants = [];

  for (const date = new Date(`${start}T12:00:00Z`); date.toISOString().slice(0, 10) <= end; date.setUTCDate(date.getUTCDate() + 1)) {
    const iso = date.toISOString().slice(0, 10);
    const year = date.getUTCFullYear();
    const year2 = String(year).slice(2);
    const month = date.getUTCMonth() + 1;
    const day = date.getUTCDate();
    const monthName = date.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });

    variants.push(escapeRegex(iso));
    variants.push(`0?${day}[/.\\-]0?${month}[/.\\-](?:${year}|${year2})`);
    variants.push(`0?${month}[/.\\-]0?${day}[/.\\-](?:${year}|${year2})`);
    variants.push(`0?${day}[-\\s]${monthName}[a-z]*[-\\s]${year}`);
    variants.push(`${monthName}[a-z]*[-\\s]0?${day}[-,\\s]+${year}`);
  }

  const matching = new RegExp(`^\\s*(?:${variants.join('|')})(?:$|[T\\s])`, 'i');
  const knownDateShape = /^\s*(?:\d{4}-\d{2}-\d{2}|\d{1,2}[/.\-]\d{1,2}[/.\-]\d{2,4}|\d{1,2}[-\s][a-z]{3,9}[-\s]\d{4}|[a-z]{3,9}[-\s]\d{1,2}[-,\s]+\d{4})(?:$|[T\s])/i;

  return {
    $or: keys.flatMap((key) => [
      { [key]: matching },
      { [key]: { $type: 'date' } },
      { $and: [{ [key]: { $type: 'string', $regex: /\S/ } }, { [key]: { $not: knownDateShape } }] }
    ])
  };
}

function userDateRangeQuery(startDate, endDate, keys = ['data.Date', 'data.date']) {
  return dateRangeFieldQuery(keys, startDate, endDate);
}

function attendanceDayQuery(date = today()) {
  return dateRangeFieldQuery(['data.Date', 'data.date'], date, date);
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

function attendanceEventsForRow(row = {}) {
  return attendanceRowsForApp(row)
    .filter((event) => /punch\s*(in|out)/i.test(safe(event.Action)))
    .map((event) => ({
      ...event,
      eventTime: attendanceEventTime(event)
    }));
}

function latestAttendanceEvent(rows, employeeId, date = today()) {
  return rows
    .filter((row) => eq(first(row, ['Employee ID', 'User ID', 'employeeId', 'EmpID']), employeeId))
    .filter((row) => normalizedDate(first(row, ['Date', 'date'], date)) === date)
    .flatMap((row) => attendanceEventsForRow(row))
    .sort((left, right) => right.eventTime - left.eventTime)[0] || null;
}

function hasCapturedPhoto(value) {
  if (value && typeof value === 'object') return Boolean(value.base64 || value.data || value.content);
  return Boolean(safe(value));
}

export async function recordAttendance(attendanceData = {}) {
  const action = safe(attendanceData.Action || attendanceData.action || 'Punch In');
  if (!['Punch In', 'Punch Out'].includes(action)) {
    return { success: false, message: 'Invalid attendance action.' };
  }

  const employeeId = safe(attendanceData['Employee ID'] || attendanceData.employeeId);
  if (!employeeId) return { success: false, message: 'Employee ID is required.' };

  if (!hasCapturedPhoto(attendanceData.Photo)) {
    return { success: false, message: 'Bina photo capture kiye attendance submit nahi ki ja sakti.' };
  }

  const latitude = attendanceData.Lattitude ?? attendanceData.Latitude;
  const longitude = attendanceData.Longitude;
  if (!safe(latitude) || !safe(longitude)) {
    return { success: false, message: 'Live GPS location required hai. Location permission allow karke dobara try karein.' };
  }

  const todayHoliday = (await loadHolidayRowsForRange(today(), today()))[0];
  if (todayHoliday) return fail(`Today is marked as a holiday (${holidayNameOf(todayHoliday)}). Attendance punch is disabled for holidays.`);

  const locationCheck = await canPunchAtLocation(employeeId, latitude, longitude, today());
  if (!locationCheck.allowed) {
    return fail(locationCheck.message || 'Aap allowed location ke bahar hain.');
  }

  const existingAttendance = await findAttendanceRows(
    {
      $and: [
        employeeIdQuery(employeeId),
        attendanceDayQuery(today())
      ]
    },
    {
      legacyId: 1,
      'data.AttendanceID': 1,
      'data.ID': 1,
      'data.attendanceId': 1,
      'data.Employee ID': 1,
      'data.User ID': 1,
      'data.employeeId': 1,
      'data.EmpID': 1,
      'data.Employee Name': 1,
      'data.Name': 1,
      'data.Date': 1,
      'data.date': 1,
      'data.Action': 1,
      'data.Time': 1,
      'data.Punch In': 1,
      'data.Punch Out': 1,
      'data.Status': 1,
      'data.Duration': 1
    }
  );
  const latest = latestAttendanceEvent(existingAttendance, employeeId, today());
  if (action === 'Punch In' && latest?.Action === 'Punch In') {
    return { success: false, message: 'Aap aaj pehle hi Punch In kar chuke hain.' };
  }
  if (action === 'Punch In' && latest?.Action === 'Punch Out') {
    return { success: false, message: 'Aap aaj ka attendance cycle (Punch In & Out) pura kar chuke hain.' };
  }
  if (action === 'Punch Out' && latest?.Action !== 'Punch In') {
    return { success: false, message: 'Pehle Punch In karein! Bina Punch In kiye Punch Out nahi kar sakte.' };
  }

  // Apps Script stamps attendance on the server. Never trust a browser-supplied
  // date/time, otherwise a user could create a record for another day.
  const serverNow = referenceNow();
  const punchTime = serverNow.toLocaleTimeString('en-IN', {
    timeZone: WORKTRACK_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit'
  });

  let finalStatus = 'Need Approval';
  if (action === 'Punch In') {
    const employee = await findOneRowByFilter(
      'EmpMaster',
      employeeIdQuery(employeeId),
      {
        projection: {
          legacyId: 1,
          'data.Employee ID': 1,
          'data.User ID': 1,
          'data.employeeId': 1,
          'data.EmpID': 1,
          'data.In Timing': 1
        }
      }
    );
    const inTimingStr = employee?.['In Timing'];
    if (inTimingStr) {
      const [inHour, inMin] = inTimingStr.split(':').map(Number);
      if (!Number.isNaN(inHour) && !Number.isNaN(inMin)) {
        const expectedInTime = new Date(serverNow);
        expectedInTime.setHours(inHour, inMin, 0, 0);
        const diffMins = (serverNow.getTime() - expectedInTime.getTime()) / 60000;
        if (diffMins <= 15) {
          finalStatus = 'Present';
        }
      }
    }
  } else if (action === 'Punch Out' && latest) {
    const elapsedMinutes = Math.max(0, Math.floor((serverNow.getTime() - latest.eventTime) / 60000));
    if (elapsedMinutes < 8 * 60) {
      finalStatus = 'Half Day';
    } else {
      finalStatus = 'Present';
    }
  }

  const row = sheetAttendance({
    ...attendanceData,
    AttendanceID: attendanceData.AttendanceID || `ATT_${Date.now()}`,
    employeeId,
    employeeName: attendanceData['Employee Name'] || attendanceData.employeeName,
    date: today(),
    action,
    status: finalStatus,
    inTime: action === 'Punch In' ? punchTime : '',
    outTime: action === 'Punch Out' ? punchTime : ''
  });

  row.Time = timestampForAttendance(row.Date, punchTime, action);
  row.Lattitude = latitude;
  row.Latitude = latitude;
  row.Longitude = longitude;
  row['Total Working Hours'] = row.Duration || '';
  row['Admin Approval'] = 'Pending';
  row['Admin Remarks'] = '';
  row['Attendance Mode'] = locationCheck.wfhApproved ? 'Work From Home' : 'Office';
  row['Location Policy'] = locationCheck.wfhApproved ? 'WFH Approved' : locationCheck.policy?.enabled ? 'Office Restricted' : 'Open';
  row['Location Distance (m)'] = locationCheck.distanceMeters ? Math.round(locationCheck.distanceMeters) : '';

  if (action === 'Punch Out' && latest) {
    const elapsedMinutes = Math.max(0, Math.floor((new Date(row.Time).getTime() - latest.eventTime) / 60000));
    row.Duration = `${Math.floor(elapsedMinutes / 60)}h ${elapsedMinutes % 60}m`;
    row['Total Working Hours'] = row.Duration;
  }

  if (attendanceData.Photo?.base64 || String(attendanceData.Photo || '').includes('base64')) {
    row.Photo = await saveBase64File(
      attendanceData.Photo?.base64
        ? attendanceData.Photo
        : { base64: attendanceData.Photo, fileName: `${row.AttendanceID}.jpg` },
      'attendance'
    );
    row['Photo Url'] = row.Photo;
    row['Photo URL'] = row.Photo;
  }

  await insertRow('Attendance', row);
  const message = action === 'Punch In'
    ? 'Punch In Submitted (Waiting for Approval).'
    : `Punch Out Submitted. Duration: ${row.Duration || '0h 0m'}`;
  return ok({ message, item: row });
}

export async function getAttendanceLocationPolicyForUser() {
  const key = attendanceCacheKey('location-policy');
  attendanceCache.delete(key); // Force clear cache
  return withAttendanceCache(key, async () => {
    const policy = await getAttendanceLocationPolicy();
    
    if (Array.isArray(policy.locations)) {
      policy.locations = policy.locations.filter(loc => 
        String(loc.latitude || '').trim() !== '' && 
        String(loc.longitude || '').trim() !== ''
      );
    }

    if (policy.updatedBy) {
      const user = await findOneRowByFilter('User', { 'data.Employee ID': policy.updatedBy.toUpperCase() }, { projection: { 'data.Employee Name': 1, 'data.Name': 1 } });
      if (user) {
        policy.updatedByName = first(user, ['Employee Name', 'Name']);
      }
    }
    return ok({ data: policy });
  });
}

export async function updateAttendanceLocationPolicy(editorId, editorRole, policy = {}) {
  if (!/^super admin$/i.test(safe(editorRole))) {
    return fail('Only Super Admin can update the attendance location policy.');
  }
  
  const editorUser = await findOneRowByFilter('User', { 'data.Employee ID': safe(editorId).toUpperCase() }, { projection: { 'data.Employee Name': 1, 'data.Name': 1 } });
  const editorName = editorUser ? first(editorUser, ['Employee Name', 'Name']) : editorId;

  const currentPolicy = await getAttendanceLocationPolicy();
  const currentLocations = currentPolicy.locations || [];

  if (Array.isArray(policy.locations)) {
    // Filter out completely empty locations before saving
    policy.locations = policy.locations.filter(loc => 
      String(loc.latitude || '').trim() !== '' && 
      String(loc.longitude || '').trim() !== ''
    );

    policy.locations = policy.locations.map((loc, index) => {
      const oldLoc = currentLocations[index];
      const isChanged = !oldLoc || 
        oldLoc.officeName !== loc.officeName || 
        oldLoc.latitude !== loc.latitude || 
        oldLoc.longitude !== loc.longitude || 
        String(oldLoc.radiusMeters) !== String(loc.radiusMeters);

      if (isChanged) {
        return { 
          ...loc, 
          addedBy: editorId, 
          addedByName: editorName,
          updatedAt: new Date().toISOString()
        };
      }
      
      return { 
        ...loc, 
        addedBy: loc.addedBy || oldLoc?.addedBy, 
        addedByName: loc.addedByName || oldLoc?.addedByName,
        updatedAt: loc.updatedAt || oldLoc?.updatedAt
      };
    });
  }

  const saved = await saveAttendanceLocationPolicy(policy, editorId);
  
  const key = attendanceCacheKey('location-policy');
  attendanceCache.delete(key);
  await deleteByPrefix(key);

  return ok({
    message: 'Attendance location policy updated successfully.',
    item: saved,
    data: saved
  });
}

export async function getAttendanceForUser(employeeId, startDate, endDate) {
  const cacheKey = attendanceCacheKey('self', safe(employeeId).toUpperCase(), normalizedDate(startDate || today()), normalizedDate(endDate || startDate || today()));
  return withAttendanceCache(cacheKey, async () => {
  const targetEmployeeId = safe(employeeId).toUpperCase();
  const [users, attendance, leaves, intimations, holidays] = await Promise.all([
    findUserRows(employeeIdQuery(targetEmployeeId), {
      legacyId: 1,
      'data.Employee ID': 1,
      'data.User ID': 1,
      'data.EMP Code': 1,
      'data.employeeId': 1,
      'data.EmpID': 1,
      'data.Employee Name': 1,
      'data.Name': 1,
      'data.Role': 1,
      'data.Department': 1,
      'data.Status': 1,
      'data.Joining Date': 1,
      'data.Date of Joining': 1,
      'data.Date Of Joining': 1
    }),
    findAttendanceRows(
      {
        $and: [
          employeeIdQuery(targetEmployeeId),
          userDateRangeQuery(startDate, endDate)
        ]
      }
    ),
    findLeaveRows(
      {
        $and: [
          employeeIdQuery(targetEmployeeId),
          userDateRangeQuery(startDate, endDate, ['data.Start Date', 'data.startDate'])
        ]
      }
    ),
    findIntimationRows(
      {
        $and: [
          employeeIdQuery(targetEmployeeId),
          userDateRangeQuery(startDate, endDate, ['data.Intimation Date', 'data.Date', 'data.date'])
        ]
      }
    ),
    loadHolidayRowsForRange(startDate, endDate)
  ]);

  const user = users.find((item) => eq(userId(item), targetEmployeeId));
  const joiningDateStr = user ? first(user, ['Date of Joining', 'Joining Date', 'Date Of Joining']) : '';
  const joiningDate = joiningDateStr ? normalizedDate(joiningDateStr) : '';

    return ok({
      data: attendance
        .filter((row) => {
            const rowDate = normalizedDate(first(row, ['Date', 'date']));
            return eq(first(row, ['Employee ID', 'User ID', 'employeeId', 'EmpID']), targetEmployeeId) && 
                   dateInRange(rowDate, startDate, endDate) &&
                   (!joiningDate || rowDate >= joiningDate);
        })
        .map((row) => attendanceRowsForApp(row))
        .flat()
        .concat(holidayAttendanceRows(holidays, startDate, endDate)),
      leaves: leaves.filter((row) => {
          const rowDate = normalizedDate(first(row, ['Start Date', 'Start Date']));
          return eq(first(row, ['Employee ID', 'User ID', 'employeeId', 'EmpID']), targetEmployeeId) && 
                 dateInRange(rowDate, startDate, endDate) &&
                 (!joiningDate || rowDate >= joiningDate);
      }),
      intimations: intimations.filter((row) => {
          const rowDate = normalizedDate(first(row, ['Intimation Date', 'Intimation Date']));
          return eq(first(row, ['Employee ID', 'User ID', 'employeeId', 'EmpID']), targetEmployeeId) && 
                 dateInRange(rowDate, startDate, endDate) &&
                 (!joiningDate || rowDate >= joiningDate);
      })
    });
  });
}

export async function getTeamAttendanceForReviewer(reviewerId, startDate, endDate) {
  const cacheKey = attendanceCacheKey('team-list', safe(reviewerId).toUpperCase(), normalizedDate(startDate || today()), normalizedDate(endDate || startDate || today()));
  return withAttendanceCache(cacheKey, async () => {
  const users = await loadTeamAttendanceUsers(reviewerId);
  const reviewer = requireTeamAttendanceReviewer(reviewerId, users);
  if (!reviewer) return fail('Only Admin, Super Admin, or HR can view team attendance.');

  const visibleIds = teamAttendanceAccessSet(reviewer, users);
  const [attendance, holidays] = await Promise.all([
    visibleIds.size
      ? findAttendanceRows({
          $and: [
            employeeIdsQuery(Array.from(visibleIds)),
            userDateRangeQuery(startDate, endDate)
          ]
        })
      : [],
    loadHolidayRowsForRange(startDate, endDate)
  ]);
  const rows = buildTeamAttendanceGroups(attendance, users, visibleIds, startDate, endDate, holidays);
    return ok({
      data: rows,
      users: users
        .filter((user) => visibleIds.has(safe(userId(user)).toUpperCase()))
        .map((user) => ({
          id: userId(user),
          name: first(user, ['Employee Name', 'Name'], userId(user)),
          role: first(user, ['Role', 'role'], ''),
          department: first(user, ['Department', 'department'], '')
        }))
        .sort((left, right) => left.name.localeCompare(right.name))
    });
  });
}

export async function getTeamAttendanceCalendarForReviewer(reviewerId, employeeId, startDate, endDate) {
  const cacheKey = attendanceCacheKey('team-calendar', safe(reviewerId).toUpperCase(), safe(employeeId).toUpperCase(), normalizedDate(startDate || today()), normalizedDate(endDate || startDate || today()));
  return withAttendanceCache(cacheKey, async () => {
  const targetEmployeeId = safe(employeeId).toUpperCase();
  if (!targetEmployeeId) return fail('Employee ID is required.');

  const users = await loadTeamAttendanceUsers(reviewerId, targetEmployeeId);
  const reviewer = requireTeamAttendanceReviewer(reviewerId, users);
  if (!reviewer) return fail('Only Admin, Super Admin, or HR can view team attendance.');

  const visibleIds = teamAttendanceAccessSet(reviewer, users);
  if (!visibleIds.has(targetEmployeeId)) {
    return fail('You cannot view this employee attendance.');
  }

  const targetUser = users.find((user) => eq(userId(user), targetEmployeeId));
  const joiningDateStr = targetUser ? first(targetUser, ['Date of Joining', 'Joining Date', 'Date Of Joining']) : '';
  const normalizedStart = normalizedDate(startDate || today());
  const normalizedEnd = normalizedDate(endDate || normalizedStart);
  const effectiveStart = joiningDateStr
    ? [normalizedStart, normalizedDate(joiningDateStr)].sort().reverse()[0]
    : normalizedStart;

  const [attendance, holidays] = await Promise.all([findAttendanceRows(
    {
      $and: [
        {
          $or: [
            { 'data.Employee ID': targetEmployeeId },
            { 'data.employeeId': targetEmployeeId },
            { 'data.EmpID': targetEmployeeId },
            { 'data.User ID': targetEmployeeId }
          ]
        },
        {
          $or: [
            { 'data.Date': { $gte: effectiveStart, $lte: `${normalizedEnd}T23:59:59.999Z` } },
            { 'data.date': { $gte: effectiveStart, $lte: `${normalizedEnd}T23:59:59.999Z` } }
          ]
        }
      ]
    },
    {
      legacyId: 1,
      'data.AttendanceID': 1,
      'data.Employee ID': 1,
      'data.employeeId': 1,
      'data.EmpID': 1,
      'data.User ID': 1,
      'data.Employee Name': 1,
      'data.Name': 1,
      'data.Date': 1,
      'data.date': 1,
      'data.Action': 1,
      'data.action': 1,
      'data.Time': 1,
      'data.Punch In': 1,
      'data.Punch Out': 1,
      'data.InTime': 1,
      'data.OutTime': 1,
      'data.Status': 1,
      'data.Duration': 1,
      'data.Total Duration': 1,
      'data.Photo': 1,
      'data.Photo Url': 1,
      'data.Photo URL': 1,
      'data.Latitude': 1,
      'data.Lattitude': 1,
      'data.Longitude': 1,
      'data.Admin Approval': 1,
      'data.Admin Remarks': 1,
      'data.Admin ID': 1,
      'data.adminId': 1,
      'data.AdminID': 1,
      'data.Approved By': 1,
      'data.Approved By ID': 1,
      'data.approvedBy': 1,
      'data.approvedById': 1,
      'data.Edited By': 1,
      'data.Edited By ID': 1,
      'data.editedBy': 1,
      'data.editedById': 1,
      'data.newPunchIn': 1,
      'data.newPunchOut': 1,
      'data.New Punch In': 1,
      'data.New Punch Out': 1
    }
  ), loadHolidayRowsForRange(effectiveStart, normalizedEnd)]);

    const rows = buildTeamAttendanceGroups(attendance, users, new Set([targetEmployeeId]), effectiveStart, normalizedEnd, holidays);
    return ok({ data: rows });
  });
}

export async function updateTeamAttendanceEntry(reviewerId, payload = {}) {
  const employeeId = safe(payload.employeeId);
  const date = normalizedDate(payload.date);
  const nextPunchIn = safe(payload.punchInTime);
  const nextPunchOut = safe(payload.punchOutTime);
  if (!employeeId || !date) return fail('Employee and attendance date are required.');
  if (!nextPunchIn && !nextPunchOut) return fail('Provide punch in or punch out time to update.');

  const [users, attendance] = await Promise.all([
    findUserRows({}, {
      legacyId: 1,
      'data.Employee ID': 1,
      'data.employeeId': 1,
      'data.User ID': 1,
      'data.EmpID': 1,
      'data.Employee Name': 1,
      'data.Name': 1,
      'data.Role': 1,
      'data.role': 1,
      'data.Status': 1,
      'data.status': 1,
      'data.Manager ID': 1,
      'data.Manager': 1,
      'data.managerId': 1,
      'data.Reporting Manager': 1,
      'data.Task Approver': 1,
      'data.Approver ID': 1,
      'data.taskApprover': 1
    }),
    findAttendanceRows(
      {
        $and: [
          employeeIdQuery(employeeId),
          attendanceDayQuery(date)
        ]
      },
      {
        legacyId: 1,
        'data.AttendanceID': 1,
        'data.ID': 1,
        'data.attendanceId': 1,
        'data.Employee ID': 1,
        'data.employeeId': 1,
        'data.EmpID': 1,
        'data.Employee Name': 1,
        'data.Name': 1,
        'data.Date': 1,
        'data.date': 1,
        'data.Action': 1,
        'data.Time': 1,
        'data.Punch In': 1,
        'data.Punch Out': 1,
        'data.Duration': 1,
        'data.Total Working Hours': 1,
        'data.Status': 1,
        'data.Admin Approval': 1,
        'data.Admin Remarks': 1
      }
    )
  ]);

  const reviewer = requireTeamAttendanceReviewer(reviewerId, users);
  if (!reviewer) return fail('Only Admin, Super Admin, HR, or Manager can edit team attendance.');

  const visibleIds = teamAttendanceAccessSet(reviewer, users);
  if (!visibleIds.has(employeeId.toUpperCase())) return fail('You cannot edit this employee attendance.');

  const targetUser = users.find((user) => eq(userId(user), employeeId));
  if (!targetUser) return fail('Target employee not found.');

  const sameDayRows = attendance.filter((row) => (
    eq(first(row, ['Employee ID', 'employeeId', 'EmpID']), employeeId) &&
    normalizedDate(first(row, ['Date', 'date'])) === date
  ));

  const expanded = sameDayRows.flatMap((row) => attendanceRowsForApp(row).map((event) => ({ ...event, _sourceRow: row })));
  const punchInEvent = expanded
    .filter((event) => /punch\s*in/i.test(safe(event.Action)))
    .sort((left, right) => attendanceEventTime(left) - attendanceEventTime(right))[0] || null;
  const punchOutEvent = expanded
    .filter((event) => /punch\s*out/i.test(safe(event.Action)))
    .sort((left, right) => attendanceEventTime(right) - attendanceEventTime(left))[0] || null;

  const updates = new Map();
  const employeeName = first(targetUser, ['Employee Name', 'Name'], employeeId);
  const remark = currentEditorRemark(reviewer);

  function workingRow(sourceRow, action) {
    const key = sourceRow ? getLegacyId('Attendance', sourceRow) : editKey(employeeId, date, action);
    if (!updates.has(key)) {
      updates.set(
        key,
        buildAttendanceEditTarget(sourceRow ? { ...sourceRow } : null, {
          AttendanceID: key,
          employeeId,
          employeeName,
          date,
          action
        })
      );
    }
    return updates.get(key);
  }

  if (nextPunchIn && !timesEqual(nextPunchIn, first(punchInEvent, ['Punch In']))) {
    const sourceRow = punchInEvent?._sourceRow;
    const key = sourceRow ? getLegacyId('Attendance', sourceRow) : editKey(employeeId, date, 'Punch In');
    updates.set(key, mergeAttendanceRow(workingRow(sourceRow, 'Punch In'), {
      AttendanceID: first(sourceRow, ['AttendanceID', 'ID', 'attendanceId'], key),
      'Employee ID': employeeId,
      EmpID: employeeId,
      'Employee Name': employeeName,
      Name: employeeName,
      Date: date,
      Action: 'Punch In',
      'Punch In': nextPunchIn,
      Time: timestampForAttendance(date, nextPunchIn, 'Punch In'),
      Status: 'Present',
      'Admin Approval': 'Approved',
      'Admin Remarks': remark
    }));
  }

  if (nextPunchOut && !timesEqual(nextPunchOut, first(punchOutEvent, ['Punch Out']))) {
    const sourceRow = punchOutEvent?._sourceRow;
    const key = sourceRow ? getLegacyId('Attendance', sourceRow) : editKey(employeeId, date, 'Punch Out');
    updates.set(key, mergeAttendanceRow(workingRow(sourceRow, 'Punch Out'), {
      AttendanceID: first(sourceRow, ['AttendanceID', 'ID', 'attendanceId'], key),
      'Employee ID': employeeId,
      EmpID: employeeId,
      'Employee Name': employeeName,
      Name: employeeName,
      Date: date,
      Action: 'Punch Out',
      'Punch Out': nextPunchOut,
      Time: timestampForAttendance(date, nextPunchOut, 'Punch Out'),
      Status: 'Present',
      'Admin Approval': 'Approved',
      'Admin Remarks': remark
    }));
  }

  if (!updates.size) {
    return ok({ message: 'No attendance changes were needed.' });
  }

  const effectivePunchIn = nextPunchIn || first(punchInEvent, ['Punch In']);
  const effectivePunchOut = nextPunchOut || first(punchOutEvent, ['Punch Out']);
  if (effectivePunchIn && effectivePunchOut) {
    const start = new Date(timestampForAttendance(date, effectivePunchIn, 'Punch In'));
    const end = new Date(timestampForAttendance(date, effectivePunchOut, 'Punch Out'));
    const duration = durationLabel(start, end);
    if (duration) {
      const sourceRow = punchOutEvent?._sourceRow;
      const key = sourceRow ? getLegacyId('Attendance', sourceRow) : editKey(employeeId, date, 'Punch Out');
      updates.set(key, mergeAttendanceRow(workingRow(sourceRow, 'Punch Out'), {
        Duration: duration,
        'Total Working Hours': duration,
        Status: 'Present',
        'Admin Approval': 'Approved',
        'Admin Remarks': remark
      }));
    }
  }

  const saved = [];
  for (const row of updates.values()) {
    const id = first(row, ['AttendanceID', 'ID', 'attendanceId'], getLegacyId('Attendance', row));
    saved.push(await upsertRow('Attendance', 'AttendanceID', id, row));
  }

  return ok({
    message: `Attendance updated for ${employeeName}.`,
    item: saved[0],
    data: saved
  });
}

export async function submitLeaveRequest(leaveData = {}) {
  const employeeId = safe(leaveData['Employee ID'] || leaveData.employeeId);
  const start = normalizedDate(leaveData['Start Date'] || leaveData.startDate);
  const end = normalizedDate(leaveData['End Date'] || leaveData.endDate || start);
  if (!employeeId) return { success: false, message: 'Employee ID is required.' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || start > end) {
    return { success: false, message: 'Leave dates are invalid.' };
  }

  const dayType = safe(leaveData['Day Type'] || leaveData.dayType || 'Full Day');
  const id = leaveData.LeaveID || `LEAVE_${Date.now()}`;
  const row = {
    LeaveID: id,
    'Leave ID': id,
    Timestamp: nowIso(),
    'Employee ID': employeeId,
    EmpID: employeeId,
    'Employee Name': leaveData['Employee Name'] || leaveData.employeeName || employeeId,
    'Leave Type': leaveData['Leave Type'] || leaveData.leaveType || '',
    'Day Type': dayType,
    'Start Date': start,
    'End Date': /half\s*day/i.test(dayType) ? start : end,
    Reason: leaveData.Reason || leaveData.reason || '',
    Status: 'Pending',
    'Admin Remarks': '',
    'Last Update Date': nowIso()
  };
  const saved = await insertRow('Leave', row);
  return ok({ message: `Leave request for ${start}${start !== end ? ` to ${end}` : ''} submitted successfully.`, item: saved, data: [saved] });
}

export async function submitIntimation(intimationData = {}) {
  const employeeId = safe(intimationData['Employee ID'] || intimationData.employeeId);
  if (!employeeId) return { success: false, message: 'Employee ID is required.' };
  const date = normalizedDate(intimationData['Intimation Date'] || intimationData.date);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { success: false, message: 'Intimation date is invalid.' };
  const id = intimationData.IntimationID || `INT_${Date.now()}`;
  const row = {
    IntimationID: id,
    'Intimation ID': id,
    Timestamp: nowIso(),
    'Employee ID': employeeId,
    EmpID: employeeId,
    'Employee Name': intimationData['Employee Name'] || intimationData.employeeName || employeeId,
    'Intimation Date': date,
    'Intimation Type': intimationData['Intimation Type'] || intimationData.type || '',
    Reason: intimationData.Reason || intimationData.reason || '',
    Status: 'Submitted',
    'Admin Remarks': '',
    'Last Update Date': nowIso()
  };
  await insertRow('Intimation', row);
  return ok({ message: 'Intimation submitted successfully.', item: row });
}

export async function checkUserAttendanceActive(employeeId) {
  const attendance = await findAttendanceRows(
    {
      $and: [
        employeeIdQuery(employeeId),
        attendanceDayQuery(today())
      ]
    },
    {
      legacyId: 1,
      'data.Employee ID': 1,
      'data.User ID': 1,
      'data.employeeId': 1,
      'data.EmpID': 1,
      'data.Date': 1,
      'data.date': 1,
      'data.Action': 1,
      'data.Time': 1,
      'data.Punch In': 1,
      'data.Punch Out': 1
    }
  );
  const latest = latestAttendanceEvent(attendance, employeeId, today());
  if (!latest) return ok({ active: false, status: 'Out' });

  const action = safe(latest.Action);
  if (/punch\s*out/i.test(action)) return ok({ active: false, status: 'Out' });
  if (/punch\s*in/i.test(action)) return ok({ active: true, status: 'In' });
  return ok({ active: !!first(latest, ['Punch In', 'Time']) && !first(latest, ['Punch Out']), status: 'In' });
}

export async function enforceAttendanceGate(employeeId) {
  const state = await checkUserAttendanceActive(employeeId);
  if (state.active) return ok({ active: true, status: 'In' });
  return {
    success: false,
    message:
      'Attendance Required: Aapne aaj ki Attendance (Punch In) mark nahi ki hai ya aap already Punch Out kar chuke hain. Kripya pehle Punch In karein!'
  };
}

registerStoreMutationListener((modelName = '') => {
  if (!['Attendance', 'Leave', 'Intimation', 'User', 'AttendancePolicy', 'Holiday'].includes(String(modelName || ''))) return;
  void clearAttendanceCaches();
});

