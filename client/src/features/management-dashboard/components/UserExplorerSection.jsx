import React, { useState, useMemo } from 'react';
import { StatusPill } from '@/components/common/StatusPill';

// Legacy status classifications
const completedStatuses = ['Closed', 'Completed', 'Posted', 'Resolved', 'Finished'];
const approvalStatuses = ['Pending Approval', 'Review', 'Approval', 'Waiting for Approval'];
const inProgressStatuses = ['In Progress', 'Paused', 'Allocated', 'Planned', 'Assigned'];
const pendingStatuses = ['Open', 'Rework', 'Reassigned', 'Re-work', 'Pending', 'Urgent'];
const ignoredStatuses = ['Cancelled', 'Rejected', 'Dropped', 'Void'];

const isClosedGroup = (status) => completedStatuses.includes(status) || approvalStatuses.includes(status);

function parseDurationMins(str) {
  if (!str) return 0;
  if (typeof str === 'number') return str;
  const raw = String(str).toLowerCase().trim();
  let mins = 0;
  const parts = raw.split(/\s+/);
  let matched = false;
  parts.forEach((p) => {
    const x = p.trim();
    const num = parseInt(x, 10);
    if (!isNaN(num)) {
      if (x.includes('h')) {
        mins += num * 60;
        matched = true;
      } else if (x.includes('m')) {
        mins += num;
        matched = true;
      }
    }
  });
  if (!matched && parts.length === 1) {
    const num = parseInt(raw, 10);
    if (!isNaN(num)) return num;
  }
  return mins;
}

function fmtMins(m) {
  if (isNaN(m) || m === null || m === undefined) return '0h 0m';
  const h = Math.floor(m / 60);
  const r = Math.round(m % 60);
  return `${h}h ${r}m`;
}

function toYMD(val) {
  if (!val) return '';
  const str = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
  const dmy = str.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);
  if (dmy) {
    return `${dmy[3]}-${String(dmy[2]).padStart(2, '0')}-${String(dmy[1]).padStart(2, '0')}`;
  }
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return str;
}

function getDatesInRange(startDateStr, endDateStr) {
  const dates = [];
  if (!startDateStr || !endDateStr) return dates;
  let curr = new Date(startDateStr);
  const end = new Date(endDateStr);
  let limit = 0;
  while (curr <= end && limit < 120) {
    limit++;
    const yyyy = curr.getFullYear();
    const mm = String(curr.getMonth() + 1).padStart(2, '0');
    const dd = String(curr.getDate()).padStart(2, '0');
    dates.push(`${yyyy}-${mm}-${dd}`);
    curr.setDate(curr.getDate() + 1);
  }
  return dates;
}

const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
function getDayName(dayIndex) {
  return dayNames[dayIndex] || '';
}

function parseTimeMinutes(rawTime) {
  if (!rawTime) return null;
  const str = String(rawTime).trim();
  if (!str || str === '-' || str === '--') return null;

  // 1. Check for standard 12/24 hour time strings (e.g. "10:00", "10:00 am", "10:00:00", "02:15 pm")
  const match = str.match(/(?:^|\s)(\d{1,2})[:.](\d{2})(?:[:.](\d{2}))?\s*(am|pm)?/i);
  if (match) {
    let h = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    const mer = match[4]?.toLowerCase();
    if (mer === 'pm' && h < 12) h += 12;
    if (mer === 'am' && h === 12) h = 0;
    return h * 60 + m;
  }

  // 2. If it's an ISO or valid Date string (e.g. "2026-10-01T04:30:00.000Z")
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    const parts = new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: 'numeric',
      minute: 'numeric',
      hour12: false
    }).formatToParts(d);
    const h = parseInt(parts.find((x) => x.type === 'hour')?.value || '0', 10);
    const m = parseInt(parts.find((x) => x.type === 'minute')?.value || '0', 10);
    return h * 60 + m;
  }

  return null;
}

function formatPunchTimeDisplay(p) {
  if (!p) return '-';
  const explicit = p['Punch In'] || p['Punch Out'] || p.InTime || p.OutTime || p.newPunchIn || p.newPunchOut;
  if (explicit && explicit !== '-' && explicit !== '--' && !String(explicit).includes('T')) {
    const m = String(explicit).trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(am|pm)?$/i);
    if (m && !m[3]) {
      let h = parseInt(m[1], 10);
      const min = m[2];
      const mer = h >= 12 ? 'pm' : 'am';
      if (h > 12) h -= 12;
      if (h === 0) h = 12;
      return `${String(h).padStart(2, '0')}:${min} ${mer}`;
    }
    return String(explicit);
  }
  const raw = p.Time || explicit;
  if (!raw || raw === '-' || raw === '--') return '-';
  const d = new Date(raw);
  if (!isNaN(d.getTime())) {
    return d.toLocaleTimeString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).toLowerCase();
  }
  return String(raw);
}

function getPunchInMinutes(p) {
  if (!p) return null;
  const statusStr = String(p.Status || p.status || p['Admin Approval'] || '').toLowerCase();
  if (statusStr === 'on time' || statusStr.includes('on time')) return 600; // 10:00 AM

  const explicit = p['Punch In'] || p.InTime || p.newPunchIn;
  const explicitMins = parseTimeMinutes(explicit);
  if (explicitMins !== null) return explicitMins;

  const rawMins = parseTimeMinutes(p.Time);
  if (rawMins !== null) return rawMins;

  return null;
}

function isPunchInLate(p) {
  if (!p) return false;
  const statusStr = String(p.Status || p.status || '').toLowerCase();
  if (statusStr === 'on time' || statusStr.includes('on time')) return false;

  const hasInField = Boolean(p['Punch In'] || p.InTime || p.newPunchIn);
  const actionStr = String(p.Action || p.action || (hasInField ? 'In' : '')).toLowerCase();
  const isCheckIn = (actionStr.includes('in') && !actionStr.includes('out')) || (hasInField && !actionStr.includes('out'));
  if (!isCheckIn) return false;

  const mins = getPunchInMinutes(p);
  if (mins === null) return false;

  // Shift starts at 10:00 AM with grace period till 10:15 AM (615 minutes from midnight)
  return mins > (10 * 60 + 15);
}

function calculateSubTableStats(tasksList, itemLabel = 'Task') {
  let planMins = 0;
  let compPlanMins = 0;
  let compMins = 0;
  let pendMins = 0;
  let plannedCount = 0;
  let completedCount = 0;
  let pendingCount = 0;

  tasksList.forEach((t) => {
    if (ignoredStatuses.includes(t.Status)) return;
    plannedCount++;
    const p = parseInt(t.TAT, 10) || 0;
    const a = parseDurationMins(t.Duration);
    const isComp = isClosedGroup(t.Status);

    planMins += p;
    if (isComp) {
      completedCount++;
      compMins += a;
      compPlanMins += p;
    } else {
      pendingCount++;
      pendMins += p;
    }
  });

  const diff = compPlanMins - compMins;
  let diffStr = '0h 0m';
  let diffClass = '#94a3b8'; // text-slate-400
  if (diff < 0) {
    diffStr = `-${fmtMins(Math.abs(diff))} Over`;
    diffClass = '#ef4444'; // text-rose-500
  } else if (diff > 0) {
    diffStr = `+${fmtMins(diff)} Saved`;
    diffClass = '#10b981'; // text-emerald-500
  }

  const pSuffix = plannedCount === 1 ? itemLabel : `${itemLabel}s`;
  const cSuffix = completedCount === 1 ? itemLabel : `${itemLabel}s`;
  const penSuffix = pendingCount === 1 ? itemLabel : `${itemLabel}s`;

  return {
    planMins,
    plannedCount,
    pSuffix,
    compMins,
    completedCount,
    cSuffix,
    pendMins,
    pendingCount,
    penSuffix,
    diffStr,
    diffClass
  };
}

function getPunchDisplayItems(punch) {
  const inVal = punch['Punch In'] || punch.InTime || punch.newPunchIn;
  const outVal = punch['Punch Out'] || punch.OutTime || punch.newPunchOut;
  const hasIn = inVal && inVal !== '-' && inVal !== '--' && !String(inVal).includes('T');
  const hasOut = outVal && outVal !== '-' && outVal !== '--' && !String(outVal).includes('T');

  if (hasIn && hasOut) {
    return [
      {
        time: inVal,
        action: 'In',
        isLate: isPunchInLate(punch),
        rawPunch: punch
      },
      {
        time: outVal,
        action: 'Out',
        isLate: false,
        rawPunch: punch
      }
    ];
  }

  const actStr = String(punch.Action || punch.action || (hasIn ? 'In' : hasOut ? 'Out' : 'In')).toLowerCase();
  const isIn = actStr.includes('in') && !actStr.includes('out');
  return [
    {
      time: formatPunchTimeDisplay(punch),
      action: isIn ? 'In' : 'Out',
      isLate: isIn && isPunchInLate(punch),
      rawPunch: punch
    }
  ];
}

export function UserExplorerSection({ users = [], selectedUserId, onUserChange, selectedUser, explorer = {} }) {
  const [expandedSections, setExpandedSections] = useState({
    attendance: true,
    tickets: true,
    fms: true,
    todo: true,
    clientDist: true
  });
  const [photoModalUrl, setPhotoModalUrl] = useState(null);

  const toggleSection = (sectionKey) => {
    setExpandedSections((prev) => ({
      ...prev,
      [sectionKey]: !prev[sectionKey]
    }));
  };

  const isAllUsers = selectedUserId === 'ALL_USERS';

  const allTickets = explorer.tickets || [];
  const allFms = explorer.fms || [];
  const allTodos = explorer.todo || [];
  const userAttendance = explorer.attendance || [];
  const userLeaves = explorer.leaves || [];
  const userIntimations = explorer.intimations || [];

  // Breakdown calculations
  const getBreakdown = (list) => {
    const total = list.filter((t) => !ignoredStatuses.includes(t.Status)).length;
    const comp = list.filter((t) => isClosedGroup(t.Status)).length;
    const appr = list.filter((t) => approvalStatuses.includes(t.Status)).length;
    const pend = total - comp;
    return { total, comp, appr, pend };
  };

  const tktB = useMemo(() => getBreakdown(allTickets), [allTickets]);
  const fmsB = useMemo(() => getBreakdown(allFms), [allFms]);
  const todoB = useMemo(() => getBreakdown(allTodos), [allTodos]);

  // Stopwatch KPI calculations (exclude FMS)
  const { stopwatchTasksCount, planMins, actMins, balanceStr, balancePositive, indexScore, effText, effFast } = useMemo(() => {
    let pMins = 0;
    let aMins = 0;
    let count = 0;

    [...allTickets, ...allTodos].forEach((t) => {
      count++;
      if (!ignoredStatuses.includes(t.Status)) {
        pMins += parseInt(t.TAT, 10) || 0;
        aMins += parseDurationMins(t.Duration);
      }
    });

    const bal = pMins - aMins;
    const balPositive = bal >= 0;
    const balStr = balPositive ? `+${fmtMins(bal)}` : `-${fmtMins(Math.abs(bal))}`;

    const score = pMins > 0 ? Math.round((aMins / pMins) * 100) : 100;
    const isFast = score <= 100;
    const effStr = score > 100 ? `${score}% (Slow)` : `${score}% (Fast)`;

    return {
      stopwatchTasksCount: count,
      planMins: pMins,
      actMins: aMins,
      balanceStr: balStr,
      balancePositive: balPositive,
      indexScore: score,
      effText: effStr,
      effFast: isFast
    };
  }, [allTickets, allTodos]);


  // Pre-index attendance punches, leaves, and intimations by date
  const { attendanceRows, totalPresent, totalLate, totalAbsent, totalLeave, totalIntimations } = useMemo(() => {
    const punchesByDate = {};
    userAttendance.forEach((a) => {
      const ymd = toYMD(a.Date);
      if (ymd) {
        if (!punchesByDate[ymd]) punchesByDate[ymd] = [];
        punchesByDate[ymd].push(a);
      }
    });

    const leavesByDate = {};
    userLeaves.forEach((l) => {
      const sDateStr = toYMD(l['Start Date'] || l.startDate || l.Date || l.date);
      const eDateStr = toYMD(l['End Date'] || l.endDate || sDateStr);
      if (sDateStr) {
        let curr = new Date(sDateStr);
        const end = new Date(eDateStr || sDateStr);
        let limit = 0;
        while (curr <= end && limit < 100) {
          limit++;
          const ymd = curr.toISOString().slice(0, 10);
          leavesByDate[ymd] = l['Reason'] || l.reason || l['Leave Type'] || l.leaveType || 'Leave Approved';
          curr.setDate(curr.getDate() + 1);
        }
      }
    });

    const intimationsByDate = {};
    userIntimations.forEach((i) => {
      const ymd = toYMD(i['Intimation Date'] || i.Date || i.date);
      if (ymd) {
        intimationsByDate[ymd] = i['Reason'] || i.reason || i['Intimation Type'] || 'Intimation Filed';
      }
    });

    const start = explorer.startDate || (userAttendance[0] ? toYMD(userAttendance[0].Date) : new Date().toISOString().slice(0, 10));
    const end = explorer.endDate || (userAttendance[userAttendance.length - 1] ? toYMD(userAttendance[userAttendance.length - 1].Date) : new Date().toISOString().slice(0, 10));
    const datesSeq = getDatesInRange(start, end);

    let pres = 0;
    let late = 0;
    let abs = 0;
    let leav = 0;
    let intim = 0;

    const rows = datesSeq.map((dateStr) => {
      const dateObj = new Date(dateStr);
      const dayOfWeek = dateObj.getDay();
      const isSunday = dayOfWeek === 0;
      const dayName = getDayName(dayOfWeek);

      const punches = punchesByDate[dateStr] || [];
      const leaveReason = leavesByDate[dateStr];
      const intimationReason = intimationsByDate[dateStr];

      if (intimationReason) intim++;
      if (punches.length > 0) {
        pres++;
      } else if (leaveReason) {
        leav++;
      } else if (!isSunday) {
        abs++;
      }

      const punchIns = punches.filter((p) => {
        const hasInField = Boolean(p['Punch In'] || p.InTime || p.newPunchIn);
        const act = String(p.Action || p.action || (hasInField ? 'In' : '')).toLowerCase();
        return (act.includes('in') && !act.includes('out')) || (hasInField && !act.includes('out'));
      });
      let isDayLate = false;
      if (punchIns.length > 0) {
        isDayLate = punchIns.some((p) => isPunchInLate(p));
        if (isDayLate) {
          late++;
        }
      }

      return {
        dateStr,
        dayName,
        isSunday,
        punches,
        isDayLate,
        leaveReason,
        intimationReason
      };
    });

    return {
      attendanceRows: rows,
      totalPresent: pres,
      totalLate: late,
      totalAbsent: abs,
      totalLeave: leav,
      totalIntimations: intim
    };
  }, [userAttendance, userLeaves, userIntimations, explorer.startDate, explorer.endDate]);

  // Attendance KPI score based on total present and working days in range
  const attendanceScoreText = useMemo(() => {
    if (isAllUsers) {
      const uniqueUsersCount = users.length;
      const totalCheckedIn = new Set(
        userAttendance
          .filter((a) => {
            const act = String(a.Action || '').toLowerCase();
            return act.includes('in') && !act.includes('out');
          })
          .map((a) => a.Name || a['Employee Name'] || a['Employee ID'])
      ).size;
      return `${totalCheckedIn} / ${uniqueUsersCount} Active`;
    }
    const workingDaysCount = attendanceRows.filter((r) => !r.isSunday).length;
    return `${totalPresent} / ${workingDaysCount || 1} Days`;
  }, [isAllUsers, users, userAttendance, attendanceRows, totalPresent]);

  // SubTable summary stats
  const ticketStats = useMemo(() => calculateSubTableStats(allTickets, 'Ticket'), [allTickets]);
  const fmsStats = useMemo(() => calculateSubTableStats(allFms, 'Task'), [allFms]);
  const todoStats = useMemo(() => calculateSubTableStats(allTodos, 'Task'), [allTodos]);

  // Client-wise distribution
  const { sortedClients, totalUserActMins, distTasksStats } = useMemo(() => {
    const map = {};
    let totalAct = 0;
    const allUserTasks = [...allTickets, ...allFms, ...allTodos];
    const distTasks = [];

    allUserTasks.forEach((t) => {
      if (ignoredStatuses.includes(t.Status)) return;
      const cName = t.Client || 'Internal / General';
      if (!map[cName]) {
        map[cName] = { name: cName, count: 0, plan: 0, act: 0 };
      }
      map[cName].count++;
      map[cName].plan += parseInt(t.TAT, 10) || 0;
      const act = parseDurationMins(t.Duration);
      map[cName].act += act;
      totalAct += act;
      distTasks.push(t);
    });

    const sorted = Object.values(map).sort((a, b) => b.act - a.act);
    return {
      sortedClients: sorted,
      totalUserActMins: totalAct,
      distTasksStats: calculateSubTableStats(distTasks, 'Item')
    };
  }, [allTickets, allFms, allTodos]);

  const hasSelected = Boolean(selectedUserId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* 1. SELECTION BAR */}
      <article className="migration-panel migration-panel--full" style={{ padding: '20px 24px', borderRadius: '16px', background: '#fff', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ background: '#dbeafe', color: '#2563eb', padding: '10px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#1e293b', margin: 0 }}>User Performance Explorer</h2>
              <p style={{ fontSize: '12px', fontWeight: '600', color: '#94a3b8', margin: '4px 0 0 0' }}>Deep dive into selected employee attendance & workload logs</p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <select
              value={selectedUserId || ''}
              onChange={(e) => onUserChange(e.target.value)}
              style={{
                background: '#f8fafc',
                border: '1px solid #cbd5e1',
                borderRadius: '10px',
                padding: '10px 16px',
                fontSize: '14px',
                fontWeight: '700',
                color: '#334155',
                outline: 'none',
                minWidth: '260px',
                cursor: 'pointer'
              }}
            >
              <option value="">Select an Employee...</option>
              <option value="ALL_USERS" style={{ color: '#2563eb', fontWeight: 'bold' }}>
                ★ All Employees / Users
              </option>
              {users.map((user) => {
                const uId = user['Employee ID'] || user.id;
                const uName = user['Employee Name'] || user.name;
                return (
                  <option key={uId} value={uId}>
                    {uName} ({uId})
                  </option>
                );
              })}
            </select>
          </div>
        </div>
      </article>

      {!hasSelected ? (
        /* PLACEHOLDER WHEN NO USER SELECTED */
        <article className="migration-panel migration-panel--full" style={{ padding: '64px 24px', textAlign: 'center', background: '#fff', borderRadius: '16px', border: '1px dashed #cbd5e1' }}>
          <div style={{ color: '#94a3b8', marginBottom: '16px' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto' }}>
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <line x1="19" y1="8" x2="19" y2="14" />
              <line x1="22" y1="11" x2="16" y2="11" />
            </svg>
          </div>
          <p style={{ fontSize: '15px', color: '#64748b', fontWeight: '600', margin: 0 }}>
            Choose an employee from the dropdown above to audit their performance metrics.
          </p>
        </article>
      ) : (
        <>
          {/* 2. DAILY WORK BREAKDOWN CARDS (3 CARDS) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
            {/* Tickets Card */}
            <div style={{ background: '#fff', padding: '20px', borderRadius: '16px', borderLeft: '5px solid #3b82f6', borderTop: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tickets Dashboard</span>
                <div style={{ fontSize: '24px', fontWeight: '800', color: '#1e293b', marginTop: '4px' }}>{tktB.total} Assigned</div>
                <div style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', marginTop: '4px' }}>
                  <b style={{ color: '#10b981' }}>{tktB.comp - tktB.appr} Done</b> | <b style={{ color: '#9333ea' }}>{tktB.appr} Approval</b> | <b style={{ color: '#f43f5e' }}>{tktB.pend} Pending</b>
                </div>
              </div>
              <div style={{ background: '#eff6ff', color: '#3b82f6', padding: '12px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M13 5v2"/><path d="M13 17v2"/><path d="M13 11v2"/></svg>
              </div>
            </div>

            {/* FMS Card */}
            <div style={{ background: '#fff', padding: '20px', borderRadius: '16px', borderLeft: '5px solid #14b8a6', borderTop: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em' }}>FMS Tasks Tracker</span>
                <div style={{ fontSize: '24px', fontWeight: '800', color: '#1e293b', marginTop: '4px' }}>{fmsB.total} Assigned</div>
                <div style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', marginTop: '4px' }}>
                  <b style={{ color: '#10b981' }}>{fmsB.comp - fmsB.appr} Done</b> | <b style={{ color: '#9333ea' }}>{fmsB.appr} Approval</b> | <b style={{ color: '#f43f5e' }}>{fmsB.pend} Pending</b>
                </div>
              </div>
              <div style={{ background: '#f0fdfa', color: '#14b8a6', padding: '12px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
              </div>
            </div>

            {/* To-Do Card */}
            <div style={{ background: '#fff', padding: '20px', borderRadius: '16px', borderLeft: '5px solid #6366f1', borderTop: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em' }}>General To-Do Tasks</span>
                <div style={{ fontSize: '24px', fontWeight: '800', color: '#1e293b', marginTop: '4px' }}>{todoB.total} Assigned</div>
                <div style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', marginTop: '4px' }}>
                  <b style={{ color: '#10b981' }}>{todoB.comp - todoB.appr} Done</b> | <b style={{ color: '#9333ea' }}>{todoB.appr} Approval</b> | <b style={{ color: '#f43f5e' }}>{todoB.pend} Pending</b>
                </div>
              </div>
              <div style={{ background: '#eef2ff', color: '#6366f1', padding: '12px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>
              </div>
            </div>
          </div>

          {/* 3. USER KPI SUMMARY ROW (4 CARDS) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
            <div style={{ background: '#fff', padding: '20px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '800', textTransform: 'uppercase' }}>Total Work Items</span>
              <div style={{ fontSize: '24px', fontWeight: '900', color: '#1e293b', marginTop: '4px' }}>{stopwatchTasksCount}</div>
            </div>

            <div style={{ background: '#fff', padding: '20px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '800', textTransform: 'uppercase' }}>Time Logs Margin</span>
              <div style={{ fontSize: '24px', fontWeight: '900', color: balancePositive ? '#10b981' : '#ef4444', marginTop: '4px' }}>{balanceStr}</div>
            </div>

            <div style={{ background: '#fff', padding: '20px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '800', textTransform: 'uppercase' }}>Efficiency Index</span>
              <div style={{ fontSize: '24px', fontWeight: '900', color: effFast ? '#10b981' : '#ef4444', marginTop: '4px' }}>{effText}</div>
            </div>

            <div style={{ background: '#fff', padding: '20px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '800', textTransform: 'uppercase' }}>Attendance Score</span>
              <div style={{ fontSize: '24px', fontWeight: '900', color: '#059669', marginTop: '4px' }}>{attendanceScoreText}</div>
            </div>
          </div>

          {/* 4. ATTENDANCE LOG DETAILS TABLE (COLLAPSIBLE) */}
          <article className="migration-panel migration-panel--full" style={{ padding: 0, overflow: 'hidden', borderRadius: '16px', border: '1px solid #e2e8f0', background: '#fff' }}>
            <div
              onClick={() => toggleSection('attendance')}
              style={{ padding: '16px 24px', borderBottom: expandedSections.attendance ? '1px solid #f1f5f9' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', background: '#fff' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ background: '#dbeafe', color: '#2563eb', padding: '8px', borderRadius: '8px' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><line x1="15" y1="8" x2="17" y2="8"/><line x1="15" y1="12" x2="17" y2="12"/><line x1="7" y1="16" x2="17" y2="16"/></svg>
                </div>
                <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#1e293b', margin: 0 }}>Attendance Log Details</h3>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', fontSize: '12px', fontWeight: '700', fontFamily: 'monospace' }}>
                  <span style={{ color: '#10b981' }}>Present: {totalPresent}</span> | <span style={{ color: '#f59e0b' }}>Late: {totalLate}</span> | <span style={{ color: '#ef4444' }}>Absent: {totalAbsent}</span> | <span style={{ color: '#9333ea' }}>Leave: {totalLeave}</span> | <span style={{ color: '#6366f1' }}>Intimation: {totalIntimations}</span>
                </div>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ transform: expandedSections.attendance ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.2s', color: '#94a3b8' }}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>
            </div>

            {expandedSections.attendance && (
              <div style={{ padding: '16px 24px', overflowX: 'auto', maxHeight: '380px', overflowY: 'auto' }}>
                <table className="dashboard-table" style={{ width: '100%', textAlign: 'left', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ color: '#94a3b8', textTransform: 'uppercase', fontSize: '11px', borderBottom: '1px solid #f1f5f9' }}>
                      <th style={{ paddingBottom: '8px' }}>Date</th>
                      <th style={{ paddingBottom: '8px' }}>Employee Name</th>
                      <th style={{ paddingBottom: '8px' }}>Time</th>
                      <th style={{ paddingBottom: '8px' }}>Action</th>
                      <th style={{ paddingBottom: '8px', textAlign: 'right', paddingRight: '16px' }}>Details / Map / Photo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {attendanceRows.length === 0 ? (
                      <tr>
                        <td colSpan="5" style={{ textAlign: 'center', padding: '24px 0', color: '#94a3b8', fontWeight: '500' }}>No date range selected.</td>
                      </tr>
                    ) : (
                      attendanceRows.map((row, idx) => {
                        const { dateStr, dayName, isSunday, punches, leaveReason, intimationReason } = row;
                        const empDisplay = isAllUsers
                          ? (punches[0]?.Name || punches[0]?.['Employee Name'] || 'All Users')
                          : (selectedUser?.['Employee Name'] || selectedUser?.name || 'Selected User');

                        const displayItems = punches.flatMap(getPunchDisplayItems);

                        return (
                          <tr key={`att-row-${dateStr}-${idx}`} style={{ borderBottom: '1px solid #f8fafc' }}>
                            <td style={{ padding: '10px 0', fontWeight: '700', color: '#475569' }}>
                              {dateStr} <span style={{ fontSize: '11px', fontWeight: '400', color: '#94a3b8' }}>({dayName})</span>
                            </td>
                            <td style={{ padding: '10px 0', fontWeight: '800', color: '#1e293b' }}>{empDisplay}</td>
                            <td style={{ padding: '10px 0' }}>
                              {displayItems.length > 0 ? (
                                displayItems.map((item, itemIdx) => (
                                  <div key={`punch-t-${itemIdx}`} style={{ padding: '2px 0', fontWeight: '600', color: '#475569' }}>
                                    {item.time}
                                    {item.isLate && (
                                      <span style={{ background: '#fef3c7', color: '#92400e', fontSize: '9px', padding: '2px 6px', borderRadius: '4px', marginLeft: '6px', fontWeight: '800' }}>
                                        Late
                                      </span>
                                    )}
                                  </div>
                                ))
                              ) : leaveReason ? (
                                <span style={{ color: '#94a3b8', fontWeight: '500', fontStyle: 'italic' }}>Full Day Leave</span>
                              ) : intimationReason ? (
                                <span style={{ color: '#94a3b8', fontWeight: '500', fontStyle: 'italic' }}>Intimation Filed</span>
                              ) : isSunday ? (
                                <span style={{ color: '#94a3b8', fontWeight: '500', fontStyle: 'italic' }}>Weekly Off</span>
                              ) : (
                                <span style={{ color: '#ef4444', fontWeight: '800', fontStyle: 'italic' }}>No Entry</span>
                              )}
                            </td>
                            <td style={{ padding: '10px 0' }}>
                              {displayItems.length > 0 ? (
                                <>
                                  {displayItems.map((item, itemIdx) => {
                                    const isIn = item.action === 'In';
                                    return (
                                      <div key={`punch-act-${itemIdx}`} style={{ padding: '2px 0' }}>
                                        <span
                                          style={{
                                            background: isIn ? '#ecfdf5' : '#fff1f2',
                                            color: isIn ? '#047857' : '#be123c',
                                            border: `1px solid ${isIn ? '#a7f3d0' : '#fecdd3'}`,
                                            fontSize: '10px',
                                            fontWeight: '700',
                                            padding: '2px 8px',
                                            borderRadius: '6px',
                                            display: 'inline-block'
                                          }}
                                        >
                                          {isIn ? 'Punch In' : 'Punch Out'}
                                        </span>
                                      </div>
                                    );
                                  })}
                                  {intimationReason && (
                                    <div style={{ marginTop: '4px' }}>
                                      <span style={{ background: '#fffbeb', color: '#b45309', border: '1px solid #fde68a', fontSize: '9px', fontWeight: '700', padding: '2px 6px', borderRadius: '4px' }}>
                                        Intimation: {intimationReason}
                                      </span>
                                    </div>
                                  )}
                                </>
                              ) : leaveReason ? (
                                <span style={{ background: '#f3e8ff', color: '#7e22ce', border: '1px solid #e9d5ff', fontSize: '10px', fontWeight: '700', padding: '2px 8px', borderRadius: '6px' }}>
                                  {leaveReason}
                                </span>
                              ) : intimationReason ? (
                                <span style={{ background: '#fffbeb', color: '#b45309', border: '1px solid #fde68a', fontSize: '10px', fontWeight: '700', padding: '2px 8px', borderRadius: '6px' }}>
                                  {intimationReason}
                                </span>
                              ) : isSunday ? (
                                <span style={{ background: '#f1f5f9', color: '#64748b', border: '1px solid #e2e8f0', fontSize: '10px', fontWeight: '700', padding: '2px 8px', borderRadius: '6px' }}>
                                  Sunday Off
                                </span>
                              ) : (
                                <span style={{ background: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5', fontSize: '10px', fontWeight: '700', padding: '2px 8px', borderRadius: '6px' }}>
                                  Absent
                                </span>
                              )}
                            </td>
                            <td style={{ padding: '10px 0', textAlign: 'right', paddingRight: '16px' }}>
                              {displayItems.length > 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-end' }}>
                                  {displayItems.map((item, itemIdx) => {
                                    const p = item.rawPunch;
                                    const lat = p.Latitude || p.Lattitude || p.Lat || p.lat;
                                    const long = p.Longitude || p.Long || p.long;
                                    const photo = p.Photo || p['Photo Url'] || p['Photo URL'] || p.photo;

                                    return (
                                      <div key={`punch-meta-${itemIdx}`} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', fontWeight: '700' }}>
                                        {lat && long && (
                                          <a
                                            href={`https://maps.google.com/?q=${lat},${long}`}
                                            target="_blank"
                                            rel="noreferrer"
                                            style={{ color: '#2563eb', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '2px' }}
                                          >
                                            📍 Map
                                          </a>
                                        )}
                                        {photo && (
                                          <button
                                            type="button"
                                            onClick={() => setPhotoModalUrl(photo)}
                                            style={{ color: '#9333ea', background: 'none', border: 'none', cursor: 'pointer', fontWeight: '700', padding: 0 }}
                                          >
                                            📷 View Photo
                                          </button>
                                        )}
                                        {!lat && !long && !photo && <span style={{ color: '#cbd5e1' }}>-</span>}
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <span style={{ color: '#cbd5e1' }}>-</span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </article>

          {/* 5. SUPPORT TICKETS TABLE (COLLAPSIBLE) */}
          <article className="migration-panel migration-panel--full" style={{ padding: 0, overflow: 'hidden', borderRadius: '16px', border: '1px solid #e2e8f0', background: '#fff' }}>
            <div
              onClick={() => toggleSection('tickets')}
              style={{ padding: '16px 24px', borderBottom: expandedSections.tickets ? '1px solid #f1f5f9' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', background: '#fff' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ background: '#dbeafe', color: '#2563eb', padding: '8px', borderRadius: '8px' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/></svg>
                </div>
                <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#1e293b', margin: 0 }}>Support Tickets</h3>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', fontSize: '11px', fontWeight: '700', fontFamily: 'monospace' }}>
                  <span style={{ color: '#2563eb' }}>Planned: {fmtMins(ticketStats.planMins)} ({ticketStats.plannedCount} {ticketStats.pSuffix})</span> |{' '}
                  <span style={{ color: '#10b981' }}>Completed (Logged): {fmtMins(ticketStats.compMins)} ({ticketStats.completedCount} {ticketStats.cSuffix})</span> |{' '}
                  <span style={{ color: '#f43f5e' }}>Pending: {fmtMins(ticketStats.pendMins)} ({ticketStats.pendingCount} {ticketStats.penSuffix})</span> |{' '}
                  <span style={{ color: ticketStats.diffClass, fontWeight: '800' }}>Diff: {ticketStats.diffStr}</span>
                </div>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ transform: expandedSections.tickets ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.2s', color: '#94a3b8' }}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>
            </div>

            {expandedSections.tickets && (
              <div style={{ padding: '16px 24px', overflowX: 'auto' }}>
                <table className="dashboard-table" style={{ width: '100%', textAlign: 'left', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ color: '#94a3b8', textTransform: 'uppercase', fontSize: '11px', borderBottom: '1px solid #f1f5f9' }}>
                      <th style={{ paddingBottom: '8px' }}>Date</th>
                      <th style={{ paddingBottom: '8px' }}>Details</th>
                      <th style={{ paddingBottom: '8px' }}>Client/Project</th>
                      <th style={{ paddingBottom: '8px', textAlign: 'center', width: '96px' }}>Plan TAT</th>
                      <th style={{ paddingBottom: '8px', textAlign: 'center', width: '96px' }}>Actual Logged</th>
                      <th style={{ paddingBottom: '8px', textAlign: 'right', paddingRight: '8px', width: '112px' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {allTickets.length === 0 ? (
                      <tr>
                        <td colSpan="6" style={{ textAlign: 'center', padding: '16px 0', color: '#94a3b8' }}>No Tickets found.</td>
                      </tr>
                    ) : (
                      allTickets.map((t, idx) => {
                        const isPending = !completedStatuses.includes(t.Status) && !approvalStatuses.includes(t.Status);
                        const plannedMins = parseInt(t.TAT, 10) || 0;
                        return (
                          <tr key={`tkt-${t.ID || idx}`} style={{ borderBottom: '1px solid #f8fafc' }}>
                            <td style={{ padding: '10px 0', fontWeight: '700', color: '#64748b', whiteSpace: 'nowrap' }}>{t.Date || '-'}</td>
                            <td style={{ padding: '10px 0', fontWeight: '600', color: '#334155', maxWidth: '300px', wordBreak: 'break-word', paddingRight: '8px' }}>{t.Description || t.Desc || t.Task || '-'}</td>
                            <td style={{ padding: '10px 0', fontWeight: '700', color: '#94a3b8', maxWidth: '200px', wordBreak: 'break-word', paddingRight: '8px' }}>{t.Client || 'Internal'}</td>
                            <td style={{ padding: '10px 0', textAlign: 'center', fontFamily: 'monospace', fontWeight: '700', color: '#2563eb' }}>{fmtMins(plannedMins)}</td>
                            <td style={{ padding: '10px 0', textAlign: 'center', fontFamily: 'monospace', color: '#64748b' }}>{t.Duration || '0h 0m'}</td>
                            <td style={{ padding: '10px 0', textAlign: 'right', paddingRight: '8px' }}>
                              <span
                                style={{
                                  background: isPending ? '#fff1f2' : '#ecfdf5',
                                  color: isPending ? '#be123c' : '#047857',
                                  fontSize: '10px',
                                  fontWeight: '800',
                                  padding: '2px 8px',
                                  borderRadius: '6px',
                                  display: 'inline-block'
                                }}
                              >
                                {t.Status || 'Open'}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </article>

          {/* 6. FMS TRACKER TASKS TABLE (COLLAPSIBLE) */}
          <article className="migration-panel migration-panel--full" style={{ padding: 0, overflow: 'hidden', borderRadius: '16px', border: '1px solid #e2e8f0', background: '#fff' }}>
            <div
              onClick={() => toggleSection('fms')}
              style={{ padding: '16px 24px', borderBottom: expandedSections.fms ? '1px solid #f1f5f9' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', background: '#fff' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ background: '#f0fdfa', color: '#14b8a6', padding: '8px', borderRadius: '8px' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
                </div>
                <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#1e293b', margin: 0 }}>FMS Tracker Tasks</h3>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', fontSize: '11px', fontWeight: '700', fontFamily: 'monospace' }}>
                  <span style={{ color: '#2563eb' }}>Planned: {fmtMins(fmsStats.planMins)} ({fmsStats.plannedCount} {fmsStats.pSuffix})</span> |{' '}
                  <span style={{ color: '#10b981' }}>Completed (Logged): {fmtMins(fmsStats.compMins)} ({fmsStats.completedCount} {fmsStats.cSuffix})</span> |{' '}
                  <span style={{ color: '#f43f5e' }}>Pending: {fmtMins(fmsStats.pendMins)} ({fmsStats.pendingCount} {fmsStats.penSuffix})</span> |{' '}
                  <span style={{ color: fmsStats.diffClass, fontWeight: '800' }}>Diff: {fmsStats.diffStr}</span>
                </div>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ transform: expandedSections.fms ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.2s', color: '#94a3b8' }}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>
            </div>

            {expandedSections.fms && (
              <div style={{ padding: '16px 24px', overflowX: 'auto' }}>
                <table className="dashboard-table" style={{ width: '100%', textAlign: 'left', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ color: '#94a3b8', textTransform: 'uppercase', fontSize: '11px', borderBottom: '1px solid #f1f5f9' }}>
                      <th style={{ paddingBottom: '8px' }}>Date</th>
                      <th style={{ paddingBottom: '8px' }}>Step Name</th>
                      <th style={{ paddingBottom: '8px' }}>FMS Name / Project</th>
                      <th style={{ paddingBottom: '8px', textAlign: 'center', width: '96px' }}>Plan TAT</th>
                      <th style={{ paddingBottom: '8px', textAlign: 'center', width: '96px' }}>Actual Logged</th>
                      <th style={{ paddingBottom: '8px', textAlign: 'right', paddingRight: '8px', width: '112px' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {allFms.length === 0 ? (
                      <tr>
                        <td colSpan="6" style={{ textAlign: 'center', padding: '16px 0', color: '#94a3b8' }}>No FMS Tasks found.</td>
                      </tr>
                    ) : (
                      allFms.map((t, idx) => {
                        const isPending = !completedStatuses.includes(t.Status) && !approvalStatuses.includes(t.Status);
                        const plannedMins = parseInt(t.TAT, 10) || 0;
                        const stepBadge = t.Step ? `Step ${t.Step}` : '';

                        return (
                          <tr key={`fms-${t.ID || idx}`} style={{ borderBottom: '1px solid #f8fafc' }}>
                            <td style={{ padding: '10px 0', fontWeight: '700', color: '#64748b', whiteSpace: 'nowrap' }}>{t.Date || '-'}</td>
                            <td style={{ padding: '10px 0', fontWeight: '600', color: '#334155', maxWidth: '300px', wordBreak: 'break-word', paddingRight: '8px' }}>
                              {stepBadge && (
                                <span style={{ background: '#f1f5f9', color: '#475569', padding: '2px 6px', borderRadius: '4px', fontSize: '9px', fontWeight: '700', marginRight: '6px' }}>
                                  {stepBadge}
                                </span>
                              )}
                              {t.Description || t.Desc || t.Task || '-'}
                            </td>
                            <td style={{ padding: '10px 0', fontWeight: '700', color: '#94a3b8', maxWidth: '200px', wordBreak: 'break-word', paddingRight: '8px' }}>{t.Client || 'FMS Project'}</td>
                            <td style={{ padding: '10px 0', textAlign: 'center', fontFamily: 'monospace', fontWeight: '700', color: '#2563eb' }}>{fmtMins(plannedMins)}</td>
                            <td style={{ padding: '10px 0', textAlign: 'center', fontFamily: 'monospace', color: '#64748b' }}>{t.Duration || '0h 0m'}</td>
                            <td style={{ padding: '10px 0', textAlign: 'right', paddingRight: '8px' }}>
                              <span
                                style={{
                                  background: isPending ? '#fff1f2' : '#ecfdf5',
                                  color: isPending ? '#be123c' : '#047857',
                                  fontSize: '10px',
                                  fontWeight: '800',
                                  padding: '2px 8px',
                                  borderRadius: '6px',
                                  display: 'inline-block'
                                }}
                              >
                                {t.Status || 'Open'}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </article>

          {/* 7. TO-DO (GENERAL TASKS) TABLE (COLLAPSIBLE) */}
          <article className="migration-panel migration-panel--full" style={{ padding: 0, overflow: 'hidden', borderRadius: '16px', border: '1px solid #e2e8f0', background: '#fff' }}>
            <div
              onClick={() => toggleSection('todo')}
              style={{ padding: '16px 24px', borderBottom: expandedSections.todo ? '1px solid #f1f5f9' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', background: '#fff' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ background: '#eef2ff', color: '#6366f1', padding: '8px', borderRadius: '8px' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>
                </div>
                <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#1e293b', margin: 0 }}>To Do (General Tasks)</h3>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', fontSize: '11px', fontWeight: '700', fontFamily: 'monospace' }}>
                  <span style={{ color: '#2563eb' }}>Planned: {fmtMins(todoStats.planMins)} ({todoStats.plannedCount} {todoStats.pSuffix})</span> |{' '}
                  <span style={{ color: '#10b981' }}>Completed (Logged): {fmtMins(todoStats.compMins)} ({todoStats.completedCount} {todoStats.cSuffix})</span> |{' '}
                  <span style={{ color: '#f43f5e' }}>Pending: {fmtMins(todoStats.pendMins)} ({todoStats.pendingCount} {todoStats.penSuffix})</span> |{' '}
                  <span style={{ color: todoStats.diffClass, fontWeight: '800' }}>Diff: {todoStats.diffStr}</span>
                </div>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ transform: expandedSections.todo ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.2s', color: '#94a3b8' }}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>
            </div>

            {expandedSections.todo && (
              <div style={{ padding: '16px 24px', overflowX: 'auto' }}>
                <table className="dashboard-table" style={{ width: '100%', textAlign: 'left', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ color: '#94a3b8', textTransform: 'uppercase', fontSize: '11px', borderBottom: '1px solid #f1f5f9' }}>
                      <th style={{ paddingBottom: '8px' }}>Date</th>
                      <th style={{ paddingBottom: '8px' }}>Details</th>
                      <th style={{ paddingBottom: '8px', textAlign: 'center', width: '96px' }}>Plan TAT</th>
                      <th style={{ paddingBottom: '8px', textAlign: 'center', width: '96px' }}>Actual Logged</th>
                      <th style={{ paddingBottom: '8px', textAlign: 'right', paddingRight: '8px', width: '112px' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {allTodos.length === 0 ? (
                      <tr>
                        <td colSpan="5" style={{ textAlign: 'center', padding: '16px 0', color: '#94a3b8' }}>No General Tasks found.</td>
                      </tr>
                    ) : (
                      allTodos.map((t, idx) => {
                        const isPending = !completedStatuses.includes(t.Status) && !approvalStatuses.includes(t.Status);
                        const plannedMins = parseInt(t.TAT, 10) || 0;
                        return (
                          <tr key={`todo-${t.ID || idx}`} style={{ borderBottom: '1px solid #f8fafc' }}>
                            <td style={{ padding: '10px 0', fontWeight: '700', color: '#64748b', whiteSpace: 'nowrap' }}>{t.Date || '-'}</td>
                            <td style={{ padding: '10px 0', fontWeight: '600', color: '#334155', maxWidth: '350px', wordBreak: 'break-word', paddingRight: '8px' }}>{t.Description || t.Desc || t.Task || '-'}</td>
                            <td style={{ padding: '10px 0', textAlign: 'center', fontFamily: 'monospace', fontWeight: '700', color: '#2563eb' }}>{fmtMins(plannedMins)}</td>
                            <td style={{ padding: '10px 0', textAlign: 'center', fontFamily: 'monospace', color: '#64748b' }}>{t.Duration || '0h 0m'}</td>
                            <td style={{ padding: '10px 0', textAlign: 'right', paddingRight: '8px' }}>
                              <span
                                style={{
                                  background: isPending ? '#fff1f2' : '#ecfdf5',
                                  color: isPending ? '#be123c' : '#047857',
                                  fontSize: '10px',
                                  fontWeight: '800',
                                  padding: '2px 8px',
                                  borderRadius: '6px',
                                  display: 'inline-block'
                                }}
                              >
                                {t.Status || 'Pending'}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </article>

          {/* 8. CLIENT-WISE WORK & TIME DISTRIBUTION (COLLAPSIBLE) */}
          <article className="migration-panel migration-panel--full" style={{ padding: 0, overflow: 'hidden', borderRadius: '16px', border: '1px solid #e2e8f0', background: '#fff' }}>
            <div
              onClick={() => toggleSection('clientDist')}
              style={{ padding: '16px 24px', borderBottom: expandedSections.clientDist ? '1px solid #f1f5f9' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', background: '#fff' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ background: '#dbeafe', color: '#2563eb', padding: '8px', borderRadius: '8px' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 1 10 10h-10z"/></svg>
                </div>
                <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#1e293b', margin: 0 }}>Client-wise Work & Time Distribution</h3>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', fontSize: '11px', fontWeight: '700', fontFamily: 'monospace' }}>
                  <span style={{ color: '#2563eb' }}>Planned: {fmtMins(distTasksStats.planMins)} ({distTasksStats.plannedCount} {distTasksStats.pSuffix})</span> |{' '}
                  <span style={{ color: '#10b981' }}>Completed (Logged): {fmtMins(distTasksStats.compMins)} ({distTasksStats.completedCount} {distTasksStats.cSuffix})</span> |{' '}
                  <span style={{ color: '#f43f5e' }}>Pending: {fmtMins(distTasksStats.pendMins)} ({distTasksStats.pendingCount} {distTasksStats.penSuffix})</span> |{' '}
                  <span style={{ color: distTasksStats.diffClass, fontWeight: '800' }}>Diff: {distTasksStats.diffStr}</span>
                </div>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ transform: expandedSections.clientDist ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.2s', color: '#94a3b8' }}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>
            </div>

            {expandedSections.clientDist && (
              <div style={{ padding: '16px 24px', overflowX: 'auto' }}>
                <table className="dashboard-table" style={{ width: '100%', textAlign: 'left', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ color: '#94a3b8', textTransform: 'uppercase', fontSize: '11px', borderBottom: '1px solid #f1f5f9' }}>
                      <th style={{ paddingBottom: '8px' }}>Client / Project Name</th>
                      <th style={{ paddingBottom: '8px', textAlign: 'center' }}>Total Tasks</th>
                      <th style={{ paddingBottom: '8px', textAlign: 'center' }}>Total Planned TAT</th>
                      <th style={{ paddingBottom: '8px', textAlign: 'center' }}>Total Actual Logged</th>
                      <th style={{ paddingBottom: '8px', textAlign: 'right', paddingRight: '8px' }}>Time Share (%)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {sortedClients.length === 0 ? (
                      <tr>
                        <td colSpan="5" style={{ textAlign: 'center', padding: '16px 0', color: '#94a3b8' }}>No active work logs to aggregate.</td>
                      </tr>
                    ) : (
                      sortedClients.map((c, idx) => {
                        const sharePct = totalUserActMins > 0 ? Math.round((c.act / totalUserActMins) * 100) : 0;
                        let barColor = '#3b82f6';
                        if (sharePct > 50) barColor = '#9333ea';
                        else if (sharePct > 25) barColor = '#2563eb';
                        else if (sharePct > 10) barColor = '#14b8a6';
                        else barColor = '#94a3b8';

                        return (
                          <tr key={`client-dist-${c.name}-${idx}`} style={{ borderBottom: '1px solid #f8fafc' }}>
                            <td style={{ padding: '10px 0', fontWeight: '800', color: '#1e293b' }}>{c.name}</td>
                            <td style={{ padding: '10px 0', textAlign: 'center', fontWeight: '700', color: '#475569' }}>{c.count}</td>
                            <td style={{ padding: '10px 0', textAlign: 'center', fontFamily: 'monospace', fontWeight: '700', color: '#94a3b8' }}>{fmtMins(c.plan)}</td>
                            <td style={{ padding: '10px 0', textAlign: 'center', fontFamily: 'monospace', fontWeight: '700', color: '#334155' }}>{fmtMins(c.act)}</td>
                            <td style={{ padding: '10px 0' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end' }}>
                                <span style={{ fontFamily: 'monospace', fontWeight: '700', color: '#475569', fontSize: '11px' }}>{sharePct}%</span>
                                <div style={{ width: '80px', background: '#f1f5f9', borderRadius: '9999px', height: '6px', overflow: 'hidden' }}>
                                  <div style={{ background: barColor, height: '6px', borderRadius: '9999px', width: `${sharePct}%` }} />
                                </div>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </article>
        </>
      )}

      {/* PHOTO MODAL */}
      {photoModalUrl && (
        <div
          onClick={() => setPhotoModalUrl(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.65)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#fff',
              borderRadius: '16px',
              maxWidth: '480px',
              width: '100%',
              overflow: 'hidden',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3)',
              position: 'relative'
            }}
          >
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: '#1e293b' }}>Attendance Photo Verification</h4>
              <button
                type="button"
                onClick={() => setPhotoModalUrl(null)}
                style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#94a3b8' }}
              >
                ✕
              </button>
            </div>
            <div style={{ padding: '16px', textAlign: 'center', background: '#000' }}>
              <img
                src={photoModalUrl}
                alt="Attendance selfie"
                style={{ maxWidth: '100%', maxHeight: '420px', borderRadius: '8px', objectFit: 'contain' }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
