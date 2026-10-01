import { finishMessage } from './whatsappTemplateRenderer.js';

const SUMMARY_EMPLOYEE_IDS = (process.env.WHATSAPP_ATTENDANCE_SUMMARY_EMPLOYEES || 'AS101,MS101').split(/[,;|]/).map((item) => item.trim()).filter(Boolean);
const field = (row, keys) => keys.map((key) => String(row?.[key] ?? '').trim()).find(Boolean) || '';
const idOf = (row) => field(row, ['Employee ID', 'User ID', 'EMP Code', 'EmpID', 'employeeId']);
const nameOf = (row) => field(row, ['Employee Name', 'Name']) || idOf(row);

function dayOf(value) {
  const raw = String(value || '').trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return match ? `${match[3]}-${match[1].padStart(2, '0')}-${match[2].padStart(2, '0')}` : '';
}

function punchTime(value, day) {
  const raw = String(value || '').trim();
  const clock = raw.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i);
  if (!clock) return raw ? Date.parse(raw) : NaN;
  let hour = Number(clock[1]);
  if (clock[4]) hour = hour % 12 + (/pm/i.test(clock[4]) ? 12 : 0);
  return Date.parse(`${day}T${String(hour).padStart(2, '0')}:${clock[2]}:${clock[3] || '00'}+05:30`);
}

function validRequest(row) {
  return !/^(rejected|cancelled|canceled|deleted)$/i.test(field(row, ['Status', 'status']));
}

function overlapsDay(row, day, startKeys, endKeys = startKeys) {
  const start = dayOf(field(row, startKeys));
  const end = dayOf(field(row, endKeys)) || start;
  return Boolean(start && end && start <= day && end >= day);
}

function isHoliday(rows = {}, day = '') {
  return (rows.Holiday || []).some((row) => validRequest(row) && overlapsDay(row, day, ['Date', 'Holiday Date', 'holidayDate', 'date']));
}
function summaryMessage(rows, states, day) {
  const leaveRows = (rows.Leave || []).filter((row) => validRequest(row) && overlapsDay(row, day, ['Start Date', 'From Date', 'Date', 'Leave Date'], ['End Date', 'To Date', 'Date', 'Leave Date']));
  const intimationRows = (rows.Intimation || []).filter((row) => validRequest(row) && overlapsDay(row, day, ['Intimation Date', 'Date', 'Timestamp', 'Created At']));
  const leaveEmployeeIds = new Set(leaveRows.map(idOf).filter(Boolean));
  const present = states.filter((state) => state.hasIn).length;
  const absent = states.filter((state) => !state.hasIn && !state.excused && !leaveEmployeeIds.has(idOf(state.user))).length;
  const body = [
    'Attendance Summary',
    '---------------------------------',
    `Date: ${day}`,
    '',
    `Total Present: ${present}`,
    `Total Absent: ${absent}`,
    `Leave Requests: ${leaveRows.length}`,
    `Intimations: ${intimationRows.length}`,
    `Total Employees: ${states.length}`,
    '',
    '~ Work Track System'
  ].join('\n');
  return body;
}

export function attendanceSnapshot(rows, day, cutoff) {
  const weeklyOff = new Date(`${day}T12:00:00+05:30`).getUTCDay() === 0;
  const holidayOff = isHoliday(rows, day);
  return (rows.User || [])
    .filter((user) => idOf(user)
      && !/^(inactive|disabled|terminated|deleted)$/i.test(field(user, ['Status', 'status']))
      && !/^client$/i.test(field(user, ['Role', 'role']))
      && (!dayOf(field(user, ['Date of Joining', 'Joining Date', 'Date Of Joining'])) || dayOf(field(user, ['Date of Joining', 'Joining Date', 'Date Of Joining'])) <= day))
    .map((user) => {
      const events = [];
      for (const row of rows.Attendance || []) {
        if (idOf(row) !== idOf(user) || dayOf(row.Date || row.date) !== day || /^rejected$/i.test(field(row, ['Admin Approval']))) continue;
        const action = field(row, ['Action', 'action']);
        for (const kind of ['in', 'out']) {
          const raw = field(row, kind === 'in' ? ['Punch In', 'InTime'] : ['Punch Out', 'OutTime']) || (new RegExp(`punch\\s*${kind}`, 'i').test(action) ? row.Time : '');
          const timestamp = punchTime(raw, day);
          if (Number.isFinite(timestamp) && timestamp <= cutoff) events.push({ kind, timestamp, row });
        }
      }
      events.sort((a, b) => a.timestamp - b.timestamp || (a.kind === 'out' ? 1 : -1));
      const firstIn = events.find((event) => event.kind === 'in');
      const last = events.at(-1);
      const leave = (rows.Leave || []).find((row) => idOf(row) === idOf(user)
        && validRequest(row)
        && overlapsDay(row, day, ['Start Date', 'From Date', 'Date', 'Leave Date'], ['End Date', 'To Date', 'Date', 'Leave Date']));
      const halfLeave = leave && /half/i.test(field(leave, ['Day Type', 'Leave Type']));
      const half = Boolean(halfLeave || (firstIn && (/half\s*day/i.test(field(firstIn.row, ['Status', 'status'])) || firstIn.timestamp > Date.parse(`${day}T10:15:00+05:30`))));
      return { user, hasIn: Boolean(firstIn), punchInAt: firstIn?.timestamp || null, openPunch: last?.kind === 'in', excused: Boolean(leave) || weeklyOff || holidayOff, status: half ? 'half' : firstIn ? 'present' : holidayOff ? 'holiday' : weeklyOff ? 'off' : 'absent' };
    });
}

export function attendanceSchedule(rows, now, { day, time }, { missedIn = '10:15', missedOut = '18:15', summary = '10:30' } = {}) {
  const states = attendanceSnapshot(rows, day, now.getTime());
  const alerts = [];
  const emit = (user, kind, message) => alerts.push({ employeeId: idOf(user), alertType: 'attendance', entityId: day, event: `${kind}:${day}`, message: finishMessage(message) });
  if (time >= summary) {
    const message = summaryMessage(rows, states, day);
    for (const user of rows.User || []) {
      const employeeId = idOf(user);
      if (!SUMMARY_EMPLOYEE_IDS.some((id) => id.toLowerCase() === employeeId.toLowerCase())) continue;
      if (!/^(inactive|disabled|terminated|deleted)$/i.test(field(user, ['Status', 'status']))) emit(user, 'attendance-summary', message);
    }
  }
  for (const state of states) {
    if (time >= missedIn && time < missedOut && !state.hasIn && !state.excused) {
      emit(state.user, 'missed-in', `Hello *${nameOf(state.user)}*,\n\nAttendance Alert: You missed your Punch IN today.\nDate: ${day}\n\nPlease mark your attendance or submit a correction request if needed.\n\n~ Work Track System`);
    }
    if (time >= missedOut && state.openPunch) {
      emit(state.user, 'missed-out', `Hello *${nameOf(state.user)}*,\n\nAttendance Alert: You have not Punched OUT yet. Do not forget to mark it before leaving.\nDate: ${day}\n\n~ Work Track System`);
    }
  }
  return alerts;
}




