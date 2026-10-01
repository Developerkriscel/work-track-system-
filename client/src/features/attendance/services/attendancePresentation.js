export function todayYmd() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function formatElapsed(startedAt) {
  if (!startedAt) return '00:00:00';
  const diff = Date.now() - new Date(startedAt).getTime();
  const hours = `${Math.floor(diff / 3600000)}`.padStart(2, '0');
  const minutes = `${Math.floor((diff % 3600000) / 60000)}`.padStart(2, '0');
  const seconds = `${Math.floor((diff % 60000) / 1000)}`.padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

export function parseTimeToDate(ymd, displayTime, action = 'Punch In') {
  if (!displayTime) return null;
  const raw = String(displayTime).trim();
  if (!raw || raw === '-' || raw === '--') return null;

  if (/T|GMT|UTC|\d{4}-\d{2}-\d{2}/i.test(raw)) {
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  const match = raw.match(/^(\d{1,2})[:.](\d{2})(?:[:.](\d{2}))?\s*(am|pm)?$/i);
  if (!match) {
    const fallback = new Date(raw);
    return Number.isNaN(fallback.getTime()) ? null : fallback;
  }

  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = Number(match[3] || 0);
  const meridian = match[4]?.toLowerCase();

  if (meridian === 'pm' && hour < 12) hour += 12;
  if (meridian === 'am' && hour === 12) hour = 0;
  if (!meridian && /out/i.test(action) && hour > 0 && hour < 9) hour += 12;

  const dateKey = ymd || todayYmd();
  const isoStr = `${dateKey}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}+05:30`;
  const result = new Date(isoStr);
  return Number.isNaN(result.getTime()) ? null : result;
}

export function formatPunchTime(value) {
  if (!value || value === '-' || value === '--') return '-';
  const raw = String(value).trim();
  const parsed = parseTimeToDate(todayYmd(), raw);
  if (!parsed || Number.isNaN(parsed.getTime())) return raw;
  return parsed.toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  }).toLowerCase();
}

export function isSecondOrFourthSaturday(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  if (d.getDay() !== 6) return false; // 6 is Saturday
  const dayOfMonth = d.getDate();
  const satIndex = Math.ceil(dayOfMonth / 7);
  return satIndex === 2 || satIndex === 4;
}

export function computeAttendanceDayStatus({ date, punchInValue, punchOutValue, rawStatus, isHoliday }) {
  const statusStr = String(rawStatus || '').trim();
  if (isHoliday || /holiday/i.test(statusStr)) return 'Holiday';
  if (/leave|casual leave|sick leave|lwp/i.test(statusStr)) return 'Leave';

  const inDate = parseTimeToDate(date, punchInValue, 'Punch In');
  const outDate = parseTimeToDate(date, punchOutValue, 'Punch Out');

  // No punches recorded
  if (!inDate && !outDate) {
    if (statusStr && !/absent|unknown|weekly off/i.test(statusStr)) {
      return statusStr;
    }
    const isSunday = new Date(`${date}T00:00:00`).getDay() === 0;
    return isSunday ? 'Weekly Off' : (date <= todayYmd() ? 'Absent' : 'Unknown');
  }

  const isHalfDaySaturday = isSecondOrFourthSaturday(date);

  // 2nd & 4th Saturday: Half day for company
  // Rule: Check only punch in (must be on time <= 10:15). Out punch can be taken anytime after 1:30 PM.
  if (isHalfDaySaturday) {
    if (inDate) {
      const shiftStartGrace = new Date(`${date}T10:15:00+05:30`);
      if (inDate.getTime() > shiftStartGrace.getTime()) {
        return 'Half Day';
      }
      return 'On Time';
    }
    return 'Half Day';
  }

  // Normal Working Days (Monday - Friday and 1st, 3rd, 5th Saturday)
  // Rule: 
  // 1. If punch in after 10:15 AM -> Half Day
  // 2. If punch out before completing 8 hours (480 minutes) -> Half Day
  // 3. Otherwise -> On Time / Present (Early if before 10:00 AM)
  if (inDate) {
    const shiftStartGrace = new Date(`${date}T10:15:00+05:30`);
    const isLateIn = inDate.getTime() > shiftStartGrace.getTime();

    // Punch in after 10:15 is always Half Day
    if (isLateIn) {
      return 'Half Day';
    }

    // Punch in is on time (<= 10:15). Check punch out if present.
    if (outDate) {
      const workedMinutes = (outDate.getTime() - inDate.getTime()) / 60000;
      if (workedMinutes < 480) { // Left before 8 hours
        return 'Half Day';
      }
    }

    const shiftStart = new Date(`${date}T10:00:00+05:30`);
    if (inDate.getTime() < shiftStart.getTime()) {
      return 'Early';
    }
    return 'On Time';
  }

  if (outDate) {
    return 'Half Day';
  }

  return 'Present';
}

export function toneForAttendanceStatus(status) {
  if (!status) return 'neutral';
  if (/early departure/i.test(status)) return 'warning';
  if (/late departure|on time departure/i.test(status)) return 'success';
  if (/present|on time|early/i.test(status)) return 'success';
  if (/late|half/i.test(status)) return 'warning';
  if (/weekend|weekly off|absent|rejected/i.test(status)) return 'danger';
  if (/pending/i.test(status)) return 'info';
  if (/approved|leave|holiday/i.test(status)) return 'info';
  return 'neutral';
}
