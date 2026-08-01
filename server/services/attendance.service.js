import { saveBase64File } from './fileStorage.service.js';
import { getLegacyId, insertRow, listRows, sheetAttendance, upsertRow } from './legacyStore.service.js';

const safe = (value) => String(value ?? '').trim();
const eq = (left, right) => safe(left).toLowerCase() === safe(right).toLowerCase();
const first = (row, keys, fallback = '') => keys.map((key) => row?.[key]).find((value) => safe(value)) ?? fallback;
const num = (value) => Number(String(value ?? 0).replace(/[^0-9.-]/g, '')) || 0;
const ok = (payload = {}) => ({ success: true, ...payload });
const fail = (message) => ({ success: false, message });
const ATTENDANCE_POLICY_ID = 'ATTENDANCE_LOCATION_POLICY';

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
  return /^(admin|super admin|hr)$/i.test(first(user, ['Role', 'role'], ''));
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
  const rows = await listRows('AttendancePolicy');
  const row = [...rows].reverse().find((item) => eq(first(item, ['PolicyID', 'ID', 'policyId', 'AttendancePolicyID']), ATTENDANCE_POLICY_ID)) || rows[rows.length - 1];
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
  const intimationRows = await listRows('Intimation');
  const date = normalizedDate(dateValue || today());
  return intimationRows.some((row) => {
    const rowEmployeeId = safe(first(row, ['Employee ID', 'User ID', 'employeeId', 'EmpID'])).toUpperCase();
    if (!eq(rowEmployeeId, employeeId)) return false;
    const rowDate = normalizedDate(first(row, ['Intimation Date', 'Date', 'date']));
    if (rowDate !== date) return false;
    return isWorkFromHomeIntimation(row) && isApprovedStatus(first(row, ['Status', 'status']));
  });
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

function computeAttendanceStatus(dateValue, punchInRow) {
  if (!punchInRow) {
    const day = new Date(`${normalizedDate(dateValue)}T00:00:00`).getDay();
    return day === 0 ? 'Weekly Off' : 'Absent';
  }

  const punchTime = new Date(timestampForAttendance(dateValue, first(punchInRow, ['Punch In', 'Time']), 'Punch In'));
  if (Number.isNaN(punchTime.getTime())) return 'Present';
  const shiftStart = new Date(`${normalizedDate(dateValue)}T10:00:00+05:30`);
  const difference = (punchTime.getTime() - shiftStart.getTime()) / 60000;
  if (difference < 0) return 'Early';
  if (difference <= 15) return 'On Time';
  if (difference <= 60) return 'Late';
  return 'Very Late';
}

function teamAttendanceAccessSet(reviewer = {}, users = []) {
  if (!canManageTeamAttendance(reviewer)) return new Set();
  return new Set(
    users
      .filter((user) => isActiveUser(user))
      .map((user) => safe(userId(user)).toUpperCase())
      .filter(Boolean)
  );
}

function dateWithinRange(dateValue, startDate, endDate) {
  const date = normalizedDate(dateValue);
  const start = normalizedDate(startDate || date);
  const end = normalizedDate(endDate || start);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && /^\d{4}-\d{2}-\d{2}$/.test(start) && /^\d{4}-\d{2}-\d{2}$/.test(end) && start <= date && date <= end;
}

function buildTeamAttendanceGroups(attendanceRows, users, allowedIds, startDate, endDate) {
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
        status: computeAttendanceStatus(group.date, punchIn),
        duration: durationLabel(inDate, outDate) || first(punchOut, ['Duration', 'Total Duration']) || '-'
      };
    })
    .sort((left, right) => {
      if (left.date === right.date) return left.employeeName.localeCompare(right.employeeName);
      return right.date.localeCompare(left.date);
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
  const reviewer = users.find((user) => eq(userId(user), reviewerId));
  if (!reviewer || !canManageTeamAttendance(reviewer)) return null;
  return reviewer;
}

function attendanceRowsForApp(row = {}) {
  const base = sheetAttendance(row);
  const date = normalizedDate(base.Date);
  const photo = first(base, ['Photo Url', 'Photo URL', 'Photo']);
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

  if (punchIn) {
    const elapsedTime = timestampFromElapsedMinutes(base['Timer Elapsed Minutes']);
    rows.push({
      ...common,
      Action: 'Punch In',
      Time: elapsedTime || timestampForAttendance(date, first(base, ['Time'], punchIn), 'Punch In'),
      'Punch In': punchIn,
      'Punch Out': ''
    });
  }

  if (punchOut) {
    rows.push({
      ...common,
      Action: 'Punch Out',
      Time: timestampForAttendance(date, punchOut, 'Punch Out'),
      'Punch In': '',
      'Punch Out': punchOut
    });
  }

  if (!rows.length) rows.push({ ...common, Time: timestampForAttendance(date, base.Time, common.Action) });
  return rows;
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

  const locationCheck = await canPunchAtLocation(employeeId, latitude, longitude, today());
  if (!locationCheck.allowed) {
    return fail(locationCheck.message || 'Aap allowed location ke bahar hain.');
  }

  const existingAttendance = await listRows('Attendance');
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

  const row = sheetAttendance({
    ...attendanceData,
    AttendanceID: attendanceData.AttendanceID || `ATT_${Date.now()}`,
    employeeId,
    employeeName: attendanceData['Employee Name'] || attendanceData.employeeName,
    date: today(),
    action,
    status: 'Need Approval',
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
  return ok({ data: await getAttendanceLocationPolicy() });
}

export async function updateAttendanceLocationPolicy(editorId, editorRole, policy = {}) {
  if (!/^(admin|super admin|hr)$/i.test(safe(editorRole))) {
    return fail('Only Admin, Super Admin, or HR can update the attendance location policy.');
  }
  const saved = await saveAttendanceLocationPolicy(policy, editorId);
  return ok({
    message: 'Attendance location policy updated successfully.',
    item: saved,
    data: saved
  });
}

export async function getAttendanceForUser(employeeId, startDate, endDate) {
  const [attendance, leaves, intimations, users] = await Promise.all([
    listRows('Attendance'),
    listRows('Leave'),
    listRows('Intimation'),
    listRows('User')
  ]);
  
  const user = users.find(u => eq(userId(u), employeeId));
  const joiningDateStr = user ? first(user, ['Date of Joining', 'Joining Date', 'Date Of Joining']) : '';
  const joiningDate = joiningDateStr ? normalizedDate(joiningDateStr) : '';

  return ok({
    data: attendance
      .filter((row) => {
          const rowDate = normalizedDate(first(row, ['Date', 'date']));
          return eq(first(row, ['Employee ID', 'User ID', 'employeeId', 'EmpID']), employeeId) && 
                 dateInRange(rowDate, startDate, endDate) &&
                 (!joiningDate || rowDate >= joiningDate);
      })
      .map((row) => attendanceRowsForApp(row))
      .flat(),
    leaves: leaves.filter((row) => {
        const rowDate = normalizedDate(first(row, ['Start Date', 'Start Date']));
        return eq(first(row, ['Employee ID', 'User ID', 'employeeId', 'EmpID']), employeeId) && 
               dateInRange(rowDate, startDate, endDate) &&
               (!joiningDate || rowDate >= joiningDate);
    }),
    intimations: intimations.filter((row) => {
        const rowDate = normalizedDate(first(row, ['Intimation Date', 'Intimation Date']));
        return eq(first(row, ['Employee ID', 'User ID', 'employeeId', 'EmpID']), employeeId) && 
               dateInRange(rowDate, startDate, endDate) &&
               (!joiningDate || rowDate >= joiningDate);
    })
  });
}

export async function getTeamAttendanceForReviewer(reviewerId, startDate, endDate) {
  const [users, attendance] = await Promise.all([
    listRows('User'),
    listRows('Attendance')
  ]);
  const reviewer = requireTeamAttendanceReviewer(reviewerId, users);
  if (!reviewer) return fail('Only Admin, Super Admin, or HR can view team attendance.');

  const visibleIds = teamAttendanceAccessSet(reviewer, users);
  const rows = buildTeamAttendanceGroups(attendance, users, visibleIds, startDate, endDate);
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
}

export async function updateTeamAttendanceEntry(reviewerId, payload = {}) {
  const employeeId = safe(payload.employeeId);
  const date = normalizedDate(payload.date);
  const nextPunchIn = safe(payload.punchInTime);
  const nextPunchOut = safe(payload.punchOutTime);
  if (!employeeId || !date) return fail('Employee and attendance date are required.');
  if (!nextPunchIn && !nextPunchOut) return fail('Provide punch in or punch out time to update.');

  const [users, attendance] = await Promise.all([
    listRows('User'),
    listRows('Attendance')
  ]);

  const reviewer = requireTeamAttendanceReviewer(reviewerId, users);
  if (!reviewer) return fail('Only Admin, Super Admin, or HR can edit team attendance.');

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

  const lastDate = /half\s*day/i.test(safe(leaveData['Day Type'] || leaveData.dayType)) ? start : end;
  const rows = [];
  let cursor = new Date(`${start}T00:00:00Z`);
  const limit = new Date(`${lastDate}T00:00:00Z`);
  let index = 0;
  while (cursor <= limit) {
    const date = cursor.toISOString().slice(0, 10);
    const id = leaveData.LeaveID || `LEAVE_${Date.now()}_${index}_${Math.floor(Math.random() * 1000)}`;
    const row = {
      LeaveID: id,
      'Leave ID': id,
      Timestamp: nowIso(),
      'Employee ID': employeeId,
      EmpID: employeeId,
      'Employee Name': leaveData['Employee Name'] || leaveData.employeeName || employeeId,
      'Leave Type': leaveData['Leave Type'] || leaveData.leaveType || '',
      'Day Type': leaveData['Day Type'] || leaveData.dayType || 'Full Day',
      'Start Date': date,
      'End Date': date,
      Reason: leaveData.Reason || leaveData.reason || '',
      Status: 'Pending',
      'Admin Remarks': '',
      'Last Update Date': nowIso()
    };
    rows.push(await insertRow('Leave', row));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    index += 1;
  }
  return ok({ message: `Leave request for ${rows.length} day(s) submitted successfully.`, item: rows[0], data: rows });
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
  const attendance = await listRows('Attendance');
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
