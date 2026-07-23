import { useEffect, useMemo, useRef, useState } from 'react';
import {
  fetchAttendanceForUser,
  submitAttendanceRecord,
  submitIntimation,
  submitLeaveRequest
} from '@/features/attendance/api';
import { useAuth } from '@/features/auth/AuthProvider';
import { todayYmd } from '@/features/attendance/services/attendancePresentation';

function toYmd(date) {
  if (date instanceof Date && Number.isNaN(date.getTime())) return todayYmd();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date(date));
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function rangeBounds(range, customStart, customEnd) {
  const today = new Date(`${todayYmd()}T00:00:00+05:30`);

  const end = new Date(today);
  const start = new Date(today);

  switch (range) {
    case 'today':
      break;
    case 'week': {
      const day = today.getDay();
      const diff = day === 0 ? 6 : day - 1;
      start.setDate(today.getDate() - diff);
      break;
    }
    case 'last_week': {
      const day = today.getDay();
      const diff = day === 0 ? 6 : day - 1;
      start.setDate(today.getDate() - diff - 7);
      end.setDate(today.getDate() - diff - 1);
      break;
    }
    case 'month':
      start.setDate(1);
      break;
    case 'last_month':
      start.setMonth(today.getMonth() - 1, 1);
      end.setDate(0);
      break;
    case 'all':
      start.setFullYear(today.getFullYear() - 3, 0, 1);
      break;
    case 'custom':
      return {
        startDate: customStart || toYmd(today),
        endDate: customEnd || toYmd(today)
      };
    default:
      break;
  }

  return {
    startDate: toYmd(start),
    endDate: toYmd(end)
  };
}

function formatDateLabel(ymd) {
  const date = new Date(`${ymd}T00:00:00`);
  if (Number.isNaN(date.getTime())) return String(ymd || '-');
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'short'
  });
}

function parseTimeToDate(ymd, displayTime) {
  if (!displayTime) return null;
  const raw = String(displayTime).trim();
  const parsed = /T|GMT|UTC|\d{4}-\d{2}-\d{2}/i.test(raw)
    ? new Date(raw)
    : new Date(`${ymd}T${raw.replace(/\s+/g, '')}+05:30`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeDateKey(value) {
  const raw = String(value || '').trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const dmy = raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
  if (dmy) return `${dmy[3]}-${String(dmy[2]).padStart(2, '0')}-${String(dmy[1]).padStart(2, '0')}`;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? raw : toYmd(parsed);
}

function attendanceStatus(group, punchIn) {
  if (!punchIn) {
    if (group.date === todayYmd()) return 'Pending Punch In';
    const day = new Date(`${group.date}T00:00:00`).getDay();
    return day === 0 ? 'Weekend' : 'Absent';
  }

  const punchTime = parseTimeToDate(group.date, punchIn.Time || punchIn['Punch In']);
  if (!punchTime) return 'Present';
  const shiftStart = new Date(`${group.date}T10:00:00+05:30`);
  const difference = (punchTime.getTime() - shiftStart.getTime()) / 60000;
  if (difference < 0) return 'Early';
  if (difference <= 15) return 'On Time';
  if (difference <= 60) return 'Late';
  return 'Very Late';
}

function durationLabel(start, end) {
  if (!start || !end || end < start) return '-';
  const diff = Math.round((end - start) / 60000);
  const hours = Math.floor(diff / 60);
  const minutes = diff % 60;
  return `${hours}h ${minutes}m`;
}

function groupAttendanceRows(rows, range) {
  const groups = new Map();

  rows.forEach((row) => {
    const key = normalizeDateKey(row.Date);
    if (!groups.has(key)) {
      groups.set(key, {
        date: key,
        dateLabel: formatDateLabel(key),
        punchesIn: [],
        punchesOut: []
      });
    }
    const group = groups.get(key);
    if (row.Action === 'Punch In') group.punchesIn.push(row);
    if (row.Action === 'Punch Out') group.punchesOut.push(row);
  });

  let grouped = Array.from(groups.values()).map((group) => {
    const eventTime = (row, action) => {
      const value = row?.Time || row?.[action === 'in' ? 'Punch In' : 'Punch Out'];
      const parsed = parseTimeToDate(group.date, value);
      return parsed ? parsed.getTime() : 0;
    };
    const punchIn = group.punchesIn.sort((a, b) => eventTime(a, 'in') - eventTime(b, 'in'))[0] || null;
    const punchOut = group.punchesOut.sort((a, b) => eventTime(b, 'out') - eventTime(a, 'out'))[0] || null;
    const inAt = parseTimeToDate(group.date, punchIn?.['Punch In']);
    const outAt = parseTimeToDate(group.date, punchOut?.['Punch Out']);

    return {
      ...group,
      punchIn,
      punchOut,
      status: attendanceStatus({ date: group.date }, punchIn),
      duration: durationLabel(inAt, outAt) !== '-'
        ? durationLabel(inAt, outAt)
        : punchOut?.Duration || punchOut?.['Total Duration'] || '-'
    };
  });

  if (!grouped.length && range === 'today') {
    const today = todayYmd();
    grouped = [{
      date: today,
      dateLabel: formatDateLabel(today),
      punchesIn: [],
      punchesOut: [],
      punchIn: null,
      punchOut: null,
      status: 'Pending Punch In',
      duration: '-',
      isPendingToday: true
    }];
  }

  return grouped.sort((a, b) => new Date(a.date) - new Date(b.date));
}

function inferAttendanceSession(rows) {
  const ordered = [...rows].sort((a, b) => {
    const left = parseTimeToDate(normalizeDateKey(a.Date), a.Time || a['Punch In'] || a['Punch Out'])?.getTime() || 0;
    const right = parseTimeToDate(normalizeDateKey(b.Date), b.Time || b['Punch In'] || b['Punch Out'])?.getTime() || 0;
    return left - right || (/punch\s*out/i.test(a.Action) ? 1 : 0) - (/punch\s*out/i.test(b.Action) ? 1 : 0);
  });
  const last = ordered[ordered.length - 1];
  if (!last) return { isPunchedIn: false, startedAt: null };
  return {
    isPunchedIn: last.Action === 'Punch In',
    startedAt: last.Action === 'Punch In' ? last.Time : null
  };
}

export function useAttendanceData() {
  const { user } = useAuth();
  const employeeId = user?.['Employee ID'] || '';
  const employeeName = user?.['Employee Name'] || user?.Name || employeeId;
  const [range, setRange] = useState('today');
  const [customStart, setCustomStart] = useState(toYmd(new Date()));
  const [customEnd, setCustomEnd] = useState(toYmd(new Date()));
  const [attendanceState, setAttendanceState] = useState({ loading: true, error: null, rows: [] });
  const [todayRows, setTodayRows] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const refreshTick = useRef(0);

  const bounds = useMemo(
    () => rangeBounds(range, customStart, customEnd),
    [range, customStart, customEnd]
  );

  const reload = () => {
    refreshTick.current += 1;
    setAttendanceState((current) => ({ ...current }));
  };

  useEffect(() => {
    if (!employeeId) {
      setAttendanceState({ loading: false, error: null, rows: [] });
      setTodayRows([]);
      return undefined;
    }

    let alive = true;

    async function loadAttendance() {
      setAttendanceState((current) => ({ ...current, loading: true, error: null }));
      try {
        const [payload, todayPayload] = await Promise.all([
          fetchAttendanceForUser(employeeId, bounds.startDate, bounds.endDate),
          fetchAttendanceForUser(employeeId, todayYmd(), todayYmd())
        ]);
        if (!alive) return;
        setAttendanceState({
          loading: false,
          error: null,
          rows: payload.data || []
        });
        setTodayRows(todayPayload.data || []);
      } catch (error) {
        if (!alive) return;
        setAttendanceState({
          loading: false,
          error: error.message || 'Failed to load attendance.',
          rows: []
        });
      }
    }

    loadAttendance();
    return () => {
      alive = false;
    };
  }, [employeeId, bounds.startDate, bounds.endDate, refreshTick.current]);

  const groupedRows = useMemo(
    () => groupAttendanceRows(attendanceState.rows, range),
    [attendanceState.rows, range]
  );

  const session = useMemo(
    () => inferAttendanceSession(todayRows),
    [todayRows]
  );

  async function recordPunch(action, payload = {}) {
    setSubmitting(true);
    try {
      const response = await submitAttendanceRecord({
        'Employee ID': employeeId,
        'Employee Name': payload.employeeName || employeeName,
        Date: todayYmd(),
        Action: action,
        Latitude: payload.latitude,
        Longitude: payload.longitude,
        Photo: payload.photoBase64
          ? {
              base64: payload.photoBase64,
              fileName: `${employeeId}-${Date.now()}.jpg`
            }
          : undefined
      });
      if (!response?.success) {
        return { success: false, message: response?.message || 'Punch failed.' };
      }
      reload();
      return { success: true, message: response.message, item: response.item };
    } catch (error) {
      return { success: false, message: error.message || 'Punch failed.' };
    } finally {
      setSubmitting(false);
    }
  }

  async function createLeave(payload) {
    setSubmitting(true);
    try {
      const response = await submitLeaveRequest({
        'Employee ID': employeeId,
        'Employee Name': payload.employeeName || employeeName,
        'Leave Type': payload.leaveType,
        'Day Type': payload.dayType,
        'Start Date': payload.startDate,
        'End Date': payload.endDate,
        Reason: payload.reason
      });
      if (!response?.success) return { success: false, message: response?.message || 'Leave submit failed.' };
      reload();
      return { success: true, message: response.message, item: response.item };
    } catch (error) {
      return { success: false, message: error.message || 'Leave submit failed.' };
    } finally {
      setSubmitting(false);
    }
  }

  async function createIntimation(payload) {
    setSubmitting(true);
    try {
      const response = await submitIntimation({
        'Employee ID': employeeId,
        'Employee Name': payload.employeeName || employeeName,
        'Intimation Date': payload.date,
        'Intimation Type': payload.type,
        Reason: payload.reason
      });
      if (!response?.success) return { success: false, message: response?.message || 'Intimation submit failed.' };
      reload();
      return { success: true, message: response.message, item: response.item };
    } catch (error) {
      return { success: false, message: error.message || 'Intimation submit failed.' };
    } finally {
      setSubmitting(false);
    }
  }

  return {
    employeeId,
    currentUser: user || null,
    range,
    setRange,
    customStart,
    setCustomStart,
    customEnd,
    setCustomEnd,
    bounds,
    attendanceLoading: attendanceState.loading,
    attendanceError: attendanceState.error,
    attendanceRows: groupedRows,
    submitting,
    session,
    recordPunch,
    createLeave,
    createIntimation
  };
}
