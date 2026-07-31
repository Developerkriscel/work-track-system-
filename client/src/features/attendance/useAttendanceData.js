import { useEffect, useMemo, useRef, useState } from 'react';
import {
  fetchTeamAttendance,
  fetchAttendanceForUser,
  fetchAttendanceLocationPolicy,
  submitAttendanceRecord,
  saveAttendanceLocationPolicy,
  submitIntimation,
  submitLeaveRequest,
  updateTeamAttendance
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
    const day = new Date(`${group.date}T00:00:00`).getDay();
    return day === 0 ? 'Weekly Off' : 'Absent';
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

function rangeIncludesDate(startDate, endDate, dateValue) {
  const start = normalizeDateKey(startDate);
  const end = normalizeDateKey(endDate);
  const current = normalizeDateKey(dateValue);
  return Boolean(start && end && current && start <= current && current <= end);
}

function groupAttendanceRows(rows, bounds) {
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

  const today = todayYmd();

  if (bounds?.startDate && bounds?.endDate) {
    const startD = new Date(`${bounds.startDate}T00:00:00`);
    const endD = new Date(`${bounds.endDate}T00:00:00`);
    const currentD = new Date(startD);

    while (currentD <= endD) {
      const dStr = toYmd(currentD);
      if (dStr <= today) {
        const exists = grouped.some((row) => row.date === dStr);
        if (!exists) {
          grouped.push({
            date: dStr,
            dateLabel: formatDateLabel(dStr),
            punchesIn: [],
            punchesOut: [],
            punchIn: null,
            punchOut: null,
            status: new Date(`${dStr}T00:00:00`).getDay() === 0 ? 'Weekly Off' : 'Absent',
            duration: '-',
            isPendingToday: false
          });
        }
      }
      currentD.setDate(currentD.getDate() + 1);
    }
  }

  grouped = grouped.map((row) => (
    row.date === today && !row.punchIn && !row.punchOut
      ? { ...row, isPendingToday: false, status: new Date(`${row.date}T00:00:00`).getDay() === 0 ? 'Weekly Off' : 'Absent' }
      : row
  ));

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
  const role = String(user?.Role || user?.role || '');
  const canManageTeamAttendance = /^(admin|super admin|hr)$/i.test(role.trim());
  const [range, setRange] = useState('today');
  const [customStart, setCustomStart] = useState(toYmd(new Date()));
  const [customEnd, setCustomEnd] = useState(toYmd(new Date()));
  const [teamFilterDate, setTeamFilterDate] = useState(todayYmd());
  const [attendanceState, setAttendanceState] = useState({ loading: true, error: null, rows: [], leaves: [], intimations: [] });
  const [teamAttendanceState, setTeamAttendanceState] = useState({ loading: false, error: null, rows: [], users: [] });
  const [locationPolicyState, setLocationPolicyState] = useState({ loading: true, error: null, data: null, saving: false });
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
      setAttendanceState({ loading: false, error: null, rows: [], leaves: [], intimations: [] });
      setTodayRows([]);
      return undefined;
    }

    let alive = true;

    async function loadAttendance() {
      setAttendanceState((current) => ({ ...current, loading: true, error: null }));
      if (canManageTeamAttendance) {
        setTeamAttendanceState((current) => ({ ...current, loading: true, error: null }));
      }
      try {
        const teamStartDate = teamFilterDate || bounds.startDate;
        const teamEndDate = teamFilterDate || bounds.endDate;
        const requests = [
          fetchAttendanceForUser(employeeId, bounds.startDate, bounds.endDate),
          fetchAttendanceForUser(employeeId, todayYmd(), todayYmd())
        ];
        if (canManageTeamAttendance) {
          requests.push(fetchTeamAttendance(teamStartDate, teamEndDate));
        }
        const [payload, todayPayload, teamPayload] = await Promise.all(requests);
        if (!alive) return;
        setAttendanceState({
          loading: false,
          error: null,
          rows: payload.data || [],
          leaves: payload.leaves || [],
          intimations: payload.intimations || []
        });
        setTodayRows(todayPayload.data || []);
        if (canManageTeamAttendance) {
          setTeamAttendanceState({
            loading: false,
            error: null,
            rows: teamPayload?.data || [],
            users: teamPayload?.users || []
          });
        } else {
          setTeamAttendanceState({ loading: false, error: null, rows: [], users: [] });
        }
        try {
          const policyPayload = await fetchAttendanceLocationPolicy();
          if (!alive) return;
          setLocationPolicyState({
            loading: false,
            error: null,
            data: policyPayload?.data || null,
            saving: false
          });
        } catch (policyError) {
          if (!alive) return;
          setLocationPolicyState({
            loading: false,
            error: policyError.message || 'Failed to load attendance location policy.',
            data: null,
            saving: false
          });
        }
      } catch (error) {
        if (!alive) return;
        setAttendanceState({
          loading: false,
          error: error.message || 'Failed to load attendance.',
          rows: [],
          leaves: [],
          intimations: []
        });
        setLocationPolicyState((current) => ({
          ...current,
          loading: false,
          error: error.message || 'Failed to load attendance location policy.'
        }));
        if (canManageTeamAttendance) {
          setTeamAttendanceState({
            loading: false,
            error: error.message || 'Failed to load team attendance.',
            rows: [],
            users: []
          });
        }
      }
    }

    loadAttendance();
    return () => {
      alive = false;
    };
  }, [employeeId, bounds.startDate, bounds.endDate, canManageTeamAttendance, teamFilterDate, refreshTick.current]);

  const groupedRows = useMemo(
    () => groupAttendanceRows(attendanceState.rows, bounds),
    [attendanceState.rows, bounds]
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

  async function saveTeamAttendance(payload) {
    if (!canManageTeamAttendance) {
      return { success: false, message: 'Only Admin or HR can edit team attendance.' };
    }
    setSubmitting(true);
    try {
      const response = await updateTeamAttendance(payload);
      if (!response?.success) return { success: false, message: response?.message || 'Attendance update failed.' };
      reload();
      return { success: true, message: response.message, item: response.item };
    } catch (error) {
      return { success: false, message: error.message || 'Attendance update failed.' };
    } finally {
      setSubmitting(false);
    }
  }

  async function saveLocationPolicy(payload) {
    if (!canManageTeamAttendance) {
      return { success: false, message: 'Only Admin, Super Admin, or HR can update the attendance location policy.' };
    }
    setLocationPolicyState((current) => ({ ...current, saving: true, error: null }));
    try {
      const response = await saveAttendanceLocationPolicy(payload);
      if (!response?.success) return { success: false, message: response?.message || 'Policy update failed.' };
      setLocationPolicyState((current) => ({
        ...current,
        data: response.data || response.item || current.data,
        saving: false
      }));
      reload();
      return { success: true, message: response.message, item: response.item };
    } catch (error) {
      setLocationPolicyState((current) => ({ ...current, saving: false, error: error.message || 'Policy update failed.' }));
      return { success: false, message: error.message || 'Policy update failed.' };
    }
  }

  function clearAttendanceError() {
    setAttendanceState((current) => ({ ...current, error: null }));
  }

  function clearTeamAttendanceError() {
    setTeamAttendanceState((current) => ({ ...current, error: null }));
  }

  return {
    employeeId,
    currentUser: user || null,
    role,
    canManageTeamAttendance,
    range,
    setRange,
    customStart,
    setCustomStart,
    customEnd,
    setCustomEnd,
    teamFilterDate,
    setTeamFilterDate,
    bounds,
    attendanceLoading: attendanceState.loading,
    attendanceError: attendanceState.error,
    attendanceRows: groupedRows,
    leaves: attendanceState.leaves,
    intimations: attendanceState.intimations,
    clearAttendanceError,
    teamAttendanceLoading: teamAttendanceState.loading,
    teamAttendanceError: teamAttendanceState.error,
    clearTeamAttendanceError,
    teamAttendanceRows: teamAttendanceState.rows,
    teamAttendanceUsers: teamAttendanceState.users,
    locationPolicy: locationPolicyState.data,
    locationPolicyLoading: locationPolicyState.loading,
    locationPolicyError: locationPolicyState.error,
    locationPolicySaving: locationPolicyState.saving,
    submitting,
    session,
    recordPunch,
    createLeave,
    createIntimation,
    saveTeamAttendance,
    saveLocationPolicy
  };
}
