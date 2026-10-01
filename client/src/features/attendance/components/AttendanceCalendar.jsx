import React, { useMemo, useState, useEffect, useRef } from 'react';
import { formatPunchTime, todayYmd, computeAttendanceDayStatus } from '@/features/attendance/services/attendancePresentation';

function normalizeDateKey(value) {
  const raw = String(value || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const dmy = raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
  if (dmy) {
    return `${dmy[3]}-${String(dmy[2]).padStart(2, '0')}-${String(dmy[1]).padStart(2, '0')}`;
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(parsed);
  const values = Object.fromEntries(parts.map(({ type, value: partValue }) => [type, partValue]));
  return `${values.year}-${values.month}-${values.day}`;
}

function firstValue(...values) {
  return values.find((value) => String(value ?? '').trim()) ?? '';
}

function rowAction(row = {}) {
  return String(row.Action || row.action || '').trim().toLowerCase();
}

function isPunchOutAction(row = {}) {
  return /punch\s*out/.test(rowAction(row));
}

function isPunchInAction(row = {}) {
  return /punch\s*in/.test(rowAction(row));
}

function punchInValue(row = {}) {
  return firstValue(
    row.punchIn?.['Punch In'],
    row.punchIn?.InTime,
    row.punchIn?.inTime,
    row.punchIn?.['Punch In Time'],
    row.punchIn?.Time,
    row.punchInTime,
    row['Punch In'],
    row.InTime,
    row.inTime,
    row['Punch In Time'],
    isPunchOutAction(row) ? '' : row.Time
  );
}

function punchOutValue(row = {}) {
  return firstValue(
    row.punchOut?.['Punch Out'],
    row.punchOut?.OutTime,
    row.punchOut?.outTime,
    row.punchOut?.['Punch Out Time'],
    row.punchOut?.Time,
    row.punchOutTime,
    row['Punch Out'],
    row.OutTime,
    row.outTime,
    row['Punch Out Time'],
    isPunchInAction(row) ? '' : row.Time
  );
}

function mergeAttendanceDayRows(existing = {}, incoming = {}) {
  return {
    ...existing,
    ...incoming,
    punchIn: existing.punchIn || incoming.punchIn || (punchInValue(incoming) ? incoming : null),
    punchOut: existing.punchOut || incoming.punchOut || (punchOutValue(incoming) ? incoming : null),
    punchInTime: firstValue(existing.punchInTime, incoming.punchInTime, punchInValue(existing), punchInValue(incoming)),
    punchOutTime: firstValue(existing.punchOutTime, incoming.punchOutTime, punchOutValue(existing), punchOutValue(incoming))
  };
}

function hasAttendancePunch(row) {
  if (!row) return false;
  return Boolean(firstValue(punchInValue(row), punchOutValue(row)));
}

function isPlaceholderAttendanceRow(row) {
  if (!row || hasAttendancePunch(row)) return false;
  const status = String(row.status || row.Status || '').trim().toLowerCase();
  return status.includes('absent') || status.includes('weekly off') || status.includes('unknown') || status.includes('holiday');
}

function attendanceRowRank(row) {
  if (!row) return 0;
  if (/holiday/i.test(String(row.status || row.Status || '')) || row.isHoliday) return 4;
  if (hasAttendancePunch(row)) return 3;
  if (!isPlaceholderAttendanceRow(row) && String(row.status || row.Status || '').trim()) return 2;
  return 1;
}

function resolveCellStatus(row, dateStr) {
  return computeAttendanceDayStatus({
    date: dateStr,
    punchInValue: punchInValue(row),
    punchOutValue: punchOutValue(row),
    rawStatus: row?.status || row?.Status,
    isHoliday: Boolean(row?.isHoliday || /holiday/i.test(String(row?.status || row?.Status || '')))
  });
}

export function AttendanceCalendar({ rows = [], onMonthChange }) {
  const seedMonthDate = useMemo(() => {
    if (rows.length > 0) {
      const firstKnownDate = rows
        .map((row) => normalizeDateKey(row.date || row.Date))
        .find((value) => /^\d{4}-\d{2}-\d{2}$/.test(value));
      if (firstKnownDate) {
        const date = new Date(`${firstKnownDate}T00:00:00`);
        if (!Number.isNaN(date.getTime())) return date;
      }
    }
    return new Date();
  }, [rows]);

  const [viewMonthDate, setViewMonthDate] = useState(seedMonthDate);
  const hasLockedInitialMonthRef = useRef(rows.length > 0);

  useEffect(() => {
    if (hasLockedInitialMonthRef.current || rows.length === 0) return;
    setViewMonthDate(seedMonthDate);
    hasLockedInitialMonthRef.current = true;
  }, [rows, seedMonthDate]);

  const displayDate = useMemo(() => {
    const d = new Date(viewMonthDate);
    return d;
  }, [viewMonthDate]);

  const year = displayDate.getFullYear();
  const month = displayDate.getMonth();

  useEffect(() => {
    if (!onMonthChange) return;
    const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const endDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(new Date(year, month + 1, 0).getDate()).padStart(2, '0')}`;
    onMonthChange({ startDate, endDate });
  }, [year, month, onMonthChange]);

  const today = new Date();
  const isCurrentMonthOrFuture = 
    year > today.getFullYear() || 
    (year === today.getFullYear() && month >= today.getMonth());

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0 is Sunday

  // Map dates to status
  const rowMap = useMemo(() => {
    const map = new Map();
    rows.forEach((row) => {
      const key = normalizeDateKey(row.date || row.Date);
      if (!key) return;
      const existing = map.get(key);
      if (!existing) {
        map.set(key, row);
        return;
      }

      const existingRank = attendanceRowRank(existing);
      const incomingRank = attendanceRowRank(row);
      if (incomingRank > existingRank) {
        map.set(key, mergeAttendanceDayRows(existing, row));
        return;
      }
      if (incomingRank === existingRank && hasAttendancePunch(row)) {
        map.set(key, mergeAttendanceDayRows(existing, row));
        return;
      }
      if (incomingRank === existingRank && !hasAttendancePunch(existing) && !isPlaceholderAttendanceRow(row)) {
        map.set(key, row);
      }
    });
    return map;
  }, [rows]);

  // Generate calendar grid
  const days = [];
  for (let i = 0; i < firstDayOfMonth; i++) {
    days.push(null);
  }
  const formatTime = (rawTime) => {
    if (!rawTime) return null;
    return formatPunchTime(rawTime);
  };

  for (let i = 1; i <= daysInMonth; i++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
    const rowObj = rowMap.get(dateStr);
    let status = resolveCellStatus(rowObj, dateStr);

    if (!rowObj) {
      const isSunday = new Date(`${dateStr}T00:00:00`).getDay() === 0;
      const isPastOrToday = dateStr <= todayYmd();
      status = isSunday ? 'Weekly Off' : (isPastOrToday ? 'Absent' : 'Unknown');
    }

    days.push({
      day: i,
      date: dateStr,
      status: status,
      punchIn: formatTime(punchInValue(rowObj)),
      punchOut: formatTime(punchOutValue(rowObj))
    });
  }

  const getStatusColor = (status) => {
    const s = String(status).toLowerCase();
    if (
      s.includes('present') || 
      s.includes('on time') || 
      s.includes('late') || 
      s.includes('early')
    ) return { 
      bg: 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)', 
      border: 'rgba(34, 197, 94, 0.3)', 
      text: '#166534',
      badgeBg: '#16a34a',
      badgeText: '#ffffff'
    };
    if (s.includes('absent')) return { 
      bg: 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)', 
      border: 'rgba(239, 68, 68, 0.3)', 
      text: '#991b1b',
      badgeBg: '#dc2626',
      badgeText: '#ffffff'
    };
    if (s.includes('half')) return { 
      bg: 'linear-gradient(135deg, #fef9c3 0%, #fef08a 100%)', 
      border: 'rgba(234, 179, 8, 0.3)', 
      text: '#854d0e',
      badgeBg: '#d97706',
      badgeText: '#ffffff'
    };
    if (s.includes('leave') || s.includes('off') || s.includes('holiday')) return { 
      bg: 'linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%)', 
      border: 'rgba(99, 102, 241, 0.3)', 
      text: '#3730a3',
      badgeBg: '#4f46e5',
      badgeText: '#ffffff'
    };
    return { 
      bg: '#ffffff', 
      border: '#e2e8f0', 
      text: '#64748b',
      badgeBg: 'transparent',
      badgeText: 'transparent'
    };
  };

  const monthName = displayDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="attendance-calendar-container" style={{
      background: '#ffffff',
      borderRadius: '16px',
      border: '1px solid #e2e8f0',
      padding: '24px',
      marginBottom: '24px',
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)'
    }}>
      <div className="attendance-calendar-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            type="button"
            onClick={() => {
              hasLockedInitialMonthRef.current = true;
              setViewMonthDate((prev) => {
                const next = new Date(prev);
                next.setMonth(next.getMonth() - 1);
                return next;
              });
            }}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc', color: '#64748b', cursor: 'pointer', transition: 'all 0.2s ease' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#e2e8f0'; e.currentTarget.style.color = '#0f172a'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.color = '#64748b'; }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
          </button>
          
          <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', margin: 0, minWidth: '150px', textAlign: 'center' }}>
            {monthName}
          </h2>

          <button
            type="button"
            disabled={isCurrentMonthOrFuture}
            onClick={() => {
              if (isCurrentMonthOrFuture) return;
              hasLockedInitialMonthRef.current = true;
              setViewMonthDate((prev) => {
                const next = new Date(prev);
                next.setMonth(next.getMonth() + 1);
                return next;
              });
            }}
            style={{ 
              display: 'flex', alignItems: 'center', justifyContent: 'center', 
              width: '32px', height: '32px', borderRadius: '8px', 
              border: '1px solid #e2e8f0', 
              background: isCurrentMonthOrFuture ? '#f8fafc' : '#f8fafc', 
              color: isCurrentMonthOrFuture ? '#cbd5e1' : '#64748b', 
              cursor: isCurrentMonthOrFuture ? 'not-allowed' : 'pointer', 
              transition: 'all 0.2s ease',
              opacity: isCurrentMonthOrFuture ? 0.6 : 1
            }}
            onMouseEnter={(e) => { if (!isCurrentMonthOrFuture) { e.currentTarget.style.background = '#e2e8f0'; e.currentTarget.style.color = '#0f172a'; } }}
            onMouseLeave={(e) => { if (!isCurrentMonthOrFuture) { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.color = '#64748b'; } }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
          </button>
        </div>
        <div className="attendance-calendar-legend" style={{ display: 'flex', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '600', color: '#64748b' }}>
            <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#22c55e' }}></span> Present
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '600', color: '#64748b' }}>
            <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#ef4444' }}></span> Absent
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '600', color: '#64748b' }}>
            <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#eab308' }}></span> Half Day
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '600', color: '#64748b' }}>
            <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#6366f1' }}></span> Leave/Off
          </div>
        </div>
      </div>

      <div className="attendance-calendar-grid" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        gap: '12px',
        textAlign: 'center'
      }}>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} style={{ fontSize: '12px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', paddingBottom: '8px' }}>
            {day}
          </div>
        ))}

        {days.map((dayObj, index) => {
          if (!dayObj) {
            return <div key={`empty-${index}`} style={{ padding: '12px' }}></div>;
          }

          const colors = getStatusColor(dayObj.status);
          const isKnown = dayObj.status !== 'Unknown';

          return (
            <div
              key={dayObj.date}
              className="attendance-calendar-cell"
              style={{
                aspectRatio: '1',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                background: colors.bg,
                border: `1px solid ${colors.border}`,
                borderRadius: '16px',
                padding: '8px',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                cursor: 'pointer',
                position: 'relative',
                boxShadow: isKnown ? '0 2px 4px rgba(0,0,0,0.02)' : 'none'
              }}
              onMouseEnter={(e) => { 
                e.currentTarget.style.transform = 'translateY(-4px)'; 
                e.currentTarget.style.boxShadow = '0 12px 20px -8px rgba(0,0,0,0.15)'; 
                e.currentTarget.style.borderColor = 'transparent';
              }}
              onMouseLeave={(e) => { 
                e.currentTarget.style.transform = 'translateY(0)'; 
                e.currentTarget.style.boxShadow = isKnown ? '0 2px 4px rgba(0,0,0,0.02)' : 'none'; 
                e.currentTarget.style.borderColor = colors.border;
              }}
            >
              <span style={{ fontSize: '18px', fontWeight: '800', color: colors.text, marginBottom: isKnown ? '6px' : '0' }}>
                {dayObj.day}
              </span>
              {isKnown && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
                  <span className="attendance-calendar-badge" style={{ 
                    fontSize: '10px', 
                    fontWeight: '700', 
                    color: colors.badgeText, 
                    textTransform: 'uppercase', 
                    letterSpacing: '0.05em', 
                    background: colors.badgeBg, 
                    padding: '4px 8px', 
                    borderRadius: '12px', 
                    textAlign: 'center', 
                    lineHeight: '1',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                  }}>
                    {dayObj.status}
                  </span>
                  {(dayObj.punchIn || dayObj.punchOut) && (
                    <div style={{ fontSize: '11px', fontWeight: '800', color: colors.text, opacity: 1, textAlign: 'center', marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '2px', lineHeight: '1.2' }}>
                      <span>In: {dayObj.punchIn || '--'}</span>
                      <span>Out: {dayObj.punchOut || '--'}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

