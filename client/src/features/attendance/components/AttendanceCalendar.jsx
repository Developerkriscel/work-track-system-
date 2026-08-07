import React, { useMemo, useState, useEffect } from 'react';

export function AttendanceCalendar({ rows = [] }) {
  const currentMonthDate = useMemo(() => {
    if (rows.length > 0) {
      // Use the first row's date to determine the month
      const date = new Date(`${rows[0].date}T00:00:00`);
      if (!Number.isNaN(date.getTime())) return date;
    }
    return new Date();
  }, [rows]);

  const [monthOffset, setMonthOffset] = useState(0);

  useEffect(() => {
    setMonthOffset(0);
  }, [rows]);

  const displayDate = useMemo(() => {
    const d = new Date(currentMonthDate);
    d.setMonth(d.getMonth() + monthOffset);
    return d;
  }, [currentMonthDate, monthOffset]);

  const year = displayDate.getFullYear();
  const month = displayDate.getMonth();

  const today = new Date();
  const isCurrentMonthOrFuture = 
    year > today.getFullYear() || 
    (year === today.getFullYear() && month >= today.getMonth());

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0 is Sunday

  // Map dates to status
  const rowMap = useMemo(() => {
    const map = {};
    rows.forEach(row => {
      map[row.date] = row;
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
    const s = String(rawTime).trim();
    if (s.includes('T')) return s.split('T')[1].substring(0, 5);
    if (s.includes(' ')) {
      const parts = s.split(' ');
      return parts[parts.length - 1].substring(0, 5);
    }
    return s.substring(0, 5);
  };

  for (let i = 1; i <= daysInMonth; i++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
    const rowObj = rowMap[dateStr];
    let status = rowObj?.status;

    if (!status) {
      const isSunday = new Date(`${dateStr}T00:00:00`).getDay() === 0;
      status = isSunday ? 'Weekly Off' : 'Unknown';
    }

    days.push({
      day: i,
      date: dateStr,
      status: status,
      punchIn: formatTime(rowObj?.punchIn ? (rowObj.punchIn.Time || rowObj.punchIn['Punch In']) : null),
      punchOut: formatTime(rowObj?.punchOut ? (rowObj.punchOut.Time || rowObj.punchOut['Punch Out']) : null)
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            type="button"
            onClick={() => setMonthOffset(prev => prev - 1)}
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
            onClick={() => setMonthOffset(prev => prev + 1)}
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
        <div style={{ display: 'flex', gap: '12px' }}>
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

      <div style={{
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
                  <span style={{ 
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
                    <div style={{ fontSize: '12px', fontWeight: '800', color: colors.text, opacity: 1, textAlign: 'center', marginTop: '6px', whiteSpace: 'nowrap', letterSpacing: '0.02em' }}>
                      {dayObj.punchIn || '--'} - {dayObj.punchOut || '--'}
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
