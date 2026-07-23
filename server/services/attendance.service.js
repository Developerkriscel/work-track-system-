import { saveBase64File } from './fileStorage.service.js';
import { insertRow, listRows, sheetAttendance } from './legacyStore.service.js';

const safe = (value) => String(value ?? '').trim();
const eq = (left, right) => safe(left).toLowerCase() === safe(right).toLowerCase();
const first = (row, keys, fallback = '') => keys.map((key) => row?.[key]).find((value) => safe(value)) ?? fallback;
const num = (value) => Number(String(value ?? 0).replace(/[^0-9.-]/g, '')) || 0;
const ok = (payload = {}) => ({ success: true, ...payload });

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

  if (action === 'Punch Out' && latest) {
    const elapsedMinutes = Math.max(0, Math.floor((new Date(row.Time).getTime() - latest.eventTime) / 60000));
    row.Duration = `${Math.floor(elapsedMinutes / 60)}h ${elapsedMinutes % 60}m`;
    row['Total Working Hours'] = row.Duration;
  }

  if (attendanceData.Photo?.base64 || String(attendanceData.Photo || '').includes('base64')) {
    row.Photo = saveBase64File(
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

export async function getAttendanceForUser(employeeId, startDate, endDate) {
  const attendance = await listRows('Attendance');
  return ok({
    data: attendance
      .filter((row) => eq(first(row, ['Employee ID', 'User ID', 'employeeId', 'EmpID']), employeeId) && dateInRange(first(row, ['Date', 'date']), startDate, endDate))
      .map((row) => attendanceRowsForApp(row))
      .flat()
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
