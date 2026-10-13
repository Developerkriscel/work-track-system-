import React, { useState, useMemo } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid
} from 'recharts';

// Legacy status classifications matching Apps Script exactly
const completedStatuses = ['Closed', 'Completed', 'Posted', 'Resolved', 'Finished'];
const approvalStatuses = ['Pending Approval', 'Review', 'Approval', 'Waiting for Approval'];
const inProgressStatuses = ['In Progress', 'Paused', 'Allocated', 'Planned', 'Assigned'];
const pendingStatuses = ['Open', 'Rework', 'Reassigned', 'Re-work', 'Pending', 'Urgent'];
const ignoredStatuses = ['Cancelled', 'Rejected', 'Dropped', 'Void'];

const isClosedGroup = (s = '') => completedStatuses.includes(s) || approvalStatuses.includes(s);
const isInProgressGroup = (s = '') => ['In Progress', 'Paused', 'Allocated', 'Planned', 'Assigned', 'Re-work', 'Rework'].includes(s);
const isPendingGroup = (s = '') => !isClosedGroup(s) && !isInProgressGroup(s) && !ignoredStatuses.includes(s);

function parseDurationMins(str) {
  if (!str) return 0;
  if (typeof str === 'number') return str;
  const raw = String(str).toLowerCase().trim();
  if (!isNaN(raw)) return parseInt(raw, 10);
  if (raw.includes(':')) {
    const parts = raw.split(':');
    const hrs = parseInt(parts[0], 10) || 0;
    const mins = parseInt(parts[1], 10) || 0;
    return hrs * 60 + mins;
  }
  let mins = 0;
  const parts = raw.split(/\s+/);
  let matched = false;
  parts.forEach((p) => {
    const num = parseInt(p, 10);
    if (!isNaN(num)) {
      if (p.includes('h')) {
        mins += num * 60;
        matched = true;
      } else if (p.includes('m')) {
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

function getInvoiceAgingBucket(invoice = {}) {
  const raw = String(invoice.Bucket || invoice['Aging Bucket'] || invoice.AgingBucket || invoice.Aging || '').trim();
  if (raw) {
    const lowered = raw.toLowerCase();
    if (['0-30', '1-30', '0-30 days', '1-30 days'].includes(lowered)) return '0-30 Days';
    if (['30-60', '31-60', '30-60 days', '31-60 days'].includes(lowered)) return '30-60 Days';
    if (['60-90', '61-90', '60-90 days', '61-90 days'].includes(lowered)) return '60-90 Days';
    if (['90+', '90+ days', '91+', '91+ days'].includes(lowered)) return '90+ Days';
    return raw;
  }

  const dueDate = invoice.DueDateFmt || invoice.DueDate || invoice.Date;
  if (!dueDate) return '';
  const due = new Date(dueDate);
  if (Number.isNaN(due.getTime())) return '';
  const diffDays = Math.max(0, Math.floor((new Date().setHours(0, 0, 0, 0) - due.setHours(0, 0, 0, 0)) / 86400000));
  if (diffDays <= 30) return '0-30 Days';
  if (diffDays <= 60) return '30-60 Days';
  if (diffDays <= 90) return '60-90 Days';
  return '90+ Days';
}

export function OverviewDashboardSection({
  kpis = {},
  tickets = [],
  fms = [],
  todo = [],
  users = [],
  clients = [],
  invoices = [],
  attendance = [],
  onOpenBatchModal
}) {
  // Global search & status filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatuses, setSelectedStatuses] = useState([]);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);

  // Section collapsible card states
  const [openTicketsCard, setOpenTicketsCard] = useState(true);
  const [openFmsCard, setOpenFmsCard] = useState(true);
  const [openTodoCard, setOpenTodoCard] = useState(true);
  const [openEffortCard, setOpenEffortCard] = useState(true);
  const [openAuditCard, setOpenAuditCard] = useState(true);

  // Local table filters
  const [filterTicketEmployee, setFilterTicketEmployee] = useState('');
  const [filterTicketClient, setFilterTicketClient] = useState('');
  const [filterFmsEmployee, setFilterFmsEmployee] = useState('');
  const [filterFmsClient, setFilterFmsClient] = useState('');
  const [filterTodoEmployee, setFilterTodoEmployee] = useState('');

  // Expandable row tracking for workload tables
  const [expandedTicketRows, setExpandedTicketRows] = useState({});
  const [expandedFmsRows, setExpandedFmsRows] = useState({});
  const [expandedTodoRows, setExpandedTodoRows] = useState({});

  // 2-level drilldown state for User-wise Client Effort report
  const [expandedEffortUsers, setExpandedEffortUsers] = useState({});
  const [expandedEffortClients, setExpandedEffortClients] = useState({});

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Filter tasks based on global search & status multi-select
  const filterByGlobal = (task) => {
    if (selectedStatuses.length > 0 && !selectedStatuses.includes(task.Status)) {
      return false;
    }
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    const userStr = String(task.User || '').toLowerCase();
    const clientStr = String(task.Client || '').toLowerCase();
    const descStr = String(task.Desc || task.Description || '').toLowerCase();
    return userStr.includes(term) || clientStr.includes(term) || descStr.includes(term);
  };

  const filteredTickets = useMemo(() => tickets.filter(filterByGlobal), [tickets, searchTerm, selectedStatuses]);
  const filteredFms = useMemo(() => fms.filter(filterByGlobal), [fms, searchTerm, selectedStatuses]);
  const filteredTodo = useMemo(() => todo.filter(filterByGlobal), [todo, searchTerm, selectedStatuses]);
  const allFilteredTasks = useMemo(() => [...filteredTickets, ...filteredFms, ...filteredTodo], [filteredTickets, filteredFms, filteredTodo]);

  // All available statuses list
  const availableStatuses = useMemo(() => {
    const set = new Set();
    [...tickets, ...fms, ...todo].forEach((t) => {
      if (t.Status) set.add(t.Status);
    });
    return Array.from(set).sort();
  }, [tickets, fms, todo]);

  const toggleStatusFilter = (st) => {
    setSelectedStatuses((prev) =>
      prev.includes(st) ? prev.filter((s) => s !== st) : [...prev, st]
    );
  };

  const toggleAllStatuses = () => {
    if (selectedStatuses.length === availableStatuses.length) {
      setSelectedStatuses([]);
    } else {
      setSelectedStatuses([...availableStatuses]);
    }
  };

  // ----------------------------------------------------
  // 1. PRIMARY CORE KPI CALCULATIONS matching Apps Script
  // ----------------------------------------------------
  const coreKPIs = useMemo(() => {
    const totalUsers = users.length;
    const uniqueCheckedIn = new Set();
    attendance.forEach((a) => {
      if (String(a.Action || '').toLowerCase().includes('in')) {
        const id = a.EmpID || a['Employee ID'] || a.id;
        if (id) uniqueCheckedIn.add(id);
      }
    });
    const presentCount = uniqueCheckedIn.size;
    const attendancePct = totalUsers > 0 ? Math.round((presentCount / totalUsers) * 100) : (kpis.attendancePct || 0);
    const attendanceCountStr = `${presentCount} of ${totalUsers} Checked In`;

    let outTotal = 0;
    let overdueInvs = 0;
    invoices.forEach((i) => {
      const out = Number(i.Outstanding || 0);
      outTotal += out;
      const due = i.DueDateFmt || i.DueDate || i.Date;
      if (out > 0 && due && due < todayStr) {
        overdueInvs++;
      }
    });

    let plannedMins = 0;
    allFilteredTasks.forEach((t) => {
      if (!ignoredStatuses.includes(t.Status)) {
        plannedMins += parseInt(t.TAT, 10) || 0;
      }
    });

    let completedToday = 0;
    allFilteredTasks.forEach((t) => {
      if (isClosedGroup(t.Status)) {
        const d = String(t.Date || '').slice(0, 10);
        if (d === todayStr || !t.Date) {
          completedToday++;
        }
      }
    });
    const totalActiveTasks = allFilteredTasks.filter((t) => !ignoredStatuses.includes(t.Status)).length;
    const outputRate = totalActiveTasks > 0 ? Math.round((completedToday / totalActiveTasks) * 100) : 0;

    return {
      attendancePct,
      attendanceCountStr,
      plannedTimeStr: fmtMins(plannedMins),
      outstandingTotal: `₹${outTotal.toLocaleString('en-IN')}`,
      overdueInvsStr: `${overdueInvs} Pending Overdue`,
      completedTodayStr: `${completedToday} Tasks`,
      outputRateStr: `${outputRate}% Output rate`
    };
  }, [users, attendance, invoices, allFilteredTasks, todayStr, kpis.attendancePct]);

  // ----------------------------------------------------
  // 2. TASK ALLOCATION DOUGHNUT & CRITICAL ALERTS
  // ----------------------------------------------------
  const taskAllocation = useMemo(() => {
    let closed = 0;
    let inProgress = 0;
    let pending = 0;
    let ignored = 0;

    allFilteredTasks.forEach((t) => {
      const s = t.Status || '';
      if (isClosedGroup(s)) closed++;
      else if (isInProgressGroup(s)) inProgress++;
      else if (isPendingGroup(s)) pending++;
      else ignored++;
    });

    return [
      { name: 'Closed / Completed', value: closed, color: '#10b981' },
      { name: 'In Progress / Paused', value: inProgress, color: '#f59e0b' },
      { name: 'Pending / Open / Rework', value: pending, color: '#f43f5e' },
      { name: 'Cancelled / Other', value: ignored, color: '#94a3b8' }
    ].filter((item) => item.value > 0);
  }, [allFilteredTasks]);

  const criticalAlerts = useMemo(() => {
    const alerts = [];
    allFilteredTasks.forEach((t) => {
      const d = String(t.Date || '').slice(0, 10);
      if (d && d < todayStr && !isClosedGroup(t.Status) && !ignoredStatuses.includes(t.Status)) {
        alerts.push({
          type: 'task',
          title: `Overdue Task: ${t.Desc || t.Description || 'Untitled'}`,
          meta: `Assigned: ${t.User || 'Unassigned'} | Due: ${d} | Client: ${t.Client || '-'}`
        });
      }
    });
    invoices.forEach((i) => {
      const out = Number(i.Outstanding || 0);
      const due = i.DueDateFmt || i.DueDate || i.Date;
      if (out > 0 && due && due < todayStr) {
        alerts.push({
          type: 'invoice',
          title: `Overdue Invoice: ₹${out.toLocaleString('en-IN')} pending (${i.Invoice_No || i.Client_Id || 'Invoice'})`,
          meta: `Client: ${i['Client Name'] || i.Client_Id || '-'} | Due Date: ${due}`
        });
      }
    });
    return alerts.slice(0, 8);
  }, [allFilteredTasks, invoices, todayStr]);

  // ----------------------------------------------------
  // 3. TEAM EFFICIENCY & BILLING AGING CHARTS
  // ----------------------------------------------------
  const teamEfficiencyData = useMemo(() => {
    const userMap = {};
    allFilteredTasks.forEach((t) => {
      if (ignoredStatuses.includes(t.Status)) return;
      const u = t.User || 'Unassigned';
      if (!userMap[u]) userMap[u] = { name: u, planned: 0, actual: 0 };
      userMap[u].planned += (parseInt(t.TAT, 10) || 0) / 60;
      userMap[u].actual += parseDurationMins(t.Duration) / 60;
    });
    return Object.values(userMap)
      .slice(0, 8)
      .map((item) => ({
        ...item,
        planned: parseFloat(item.planned.toFixed(1)),
        actual: parseFloat(item.actual.toFixed(1))
      }));
  }, [allFilteredTasks]);

  const agingBucketsData = useMemo(() => {
    const buckets = { '0-30 Days': 0, '30-60 Days': 0, '60-90 Days': 0, '90+ Days': 0 };
    invoices.forEach((i) => {
      const out = Number(i.Outstanding || 0);
      if (out > 0) {
        const b = getInvoiceAgingBucket(i) || '0-30 Days';
        if (buckets[b] !== undefined) {
          buckets[b] += out;
        } else {
          buckets['90+ Days'] += out;
        }
      }
    });
    return Object.keys(buckets).map((key) => ({ name: key, amount: buckets[key] }));
  }, [invoices]);

  // ----------------------------------------------------
  // 4. EMPLOYEE TIME BALANCE & WORKING HOURS ANALYSIS
  // ----------------------------------------------------
  const employeeTimeBalances = useMemo(() => {
    const empMap = {};
    allFilteredTasks.forEach((t) => {
      if (ignoredStatuses.includes(t.Status)) return;
      const emp = t.User || 'Unassigned';
      if (!empMap[emp]) empMap[emp] = { name: emp, plan: 0, act: 0 };
      empMap[emp].plan += parseInt(t.TAT, 10) || 0;
      empMap[emp].act += parseDurationMins(t.Duration);
    });
    return Object.values(empMap).map((e) => {
      const diff = e.plan - e.act;
      const isSurplus = diff >= 0;
      return {
        ...e,
        diff,
        isSurplus,
        planStr: fmtMins(e.plan),
        actStr: fmtMins(e.act),
        diffStr: isSurplus ? `+${fmtMins(diff)} Saved` : `-${fmtMins(Math.abs(diff))} Overtime`
      };
    });
  }, [allFilteredTasks]);

  // ----------------------------------------------------
  // 5. TICKET & FMS CLOSURE RATE ANALYTICS
  // ----------------------------------------------------
  const ticketClosureAnalytics = useMemo(() => {
    let total = 0;
    let closed = 0;
    let open = 0;
    let overdue = 0;
    const empMap = {};

    filteredTickets.forEach((t) => {
      if (ignoredStatuses.includes(t.Status)) return;
      total++;
      const isCl = isClosedGroup(t.Status);
      if (isCl) closed++;
      else open++;

      const d = String(t.Date || '').slice(0, 10);
      if (d && d < todayStr && !isCl) overdue++;

      const emp = t.User || 'Unassigned';
      if (!empMap[emp]) empMap[emp] = { total: 0, closed: 0 };
      empMap[emp].total++;
      if (isCl) empMap[emp].closed++;
    });

    const rate = total > 0 ? Math.round((closed / total) * 100) : 0;
    const empRows = Object.keys(empMap).map((k) => ({
      name: k,
      total: empMap[k].total,
      closed: empMap[k].closed,
      rate: Math.round((empMap[k].closed / empMap[k].total) * 100)
    }));

    return { total, closed, open, overdue, rate, empRows };
  }, [filteredTickets, todayStr]);

  const fmsClosureAnalytics = useMemo(() => {
    let total = 0;
    let done = 0;
    let pending = 0;
    const empMap = {};

    filteredFms.forEach((t) => {
      if (ignoredStatuses.includes(t.Status)) return;
      total++;
      const isDn = isClosedGroup(t.Status);
      if (isDn) done++;
      else pending++;

      const emp = t.User || 'Unassigned';
      if (!empMap[emp]) empMap[emp] = { total: 0, done: 0 };
      empMap[emp].total++;
      if (isDn) empMap[emp].done++;
    });

    const rate = total > 0 ? Math.round((done / total) * 100) : 0;
    const empRows = Object.keys(empMap).map((k) => ({
      name: k,
      total: empMap[k].total,
      done: empMap[k].done,
      rate: Math.round((empMap[k].done / empMap[k].total) * 100)
    }));

    return { total, done, pending, rate, empRows };
  }, [filteredFms]);

  // ----------------------------------------------------
  // 6. WORKLOAD TABLES (TICKETS, FMS, TO-DO)
  // ----------------------------------------------------
  const ticketEmployees = useMemo(() => {
    return Array.from(new Set(filteredTickets.map((t) => t.User).filter(Boolean))).sort();
  }, [filteredTickets]);
  const ticketClients = useMemo(() => {
    return Array.from(new Set(filteredTickets.map((t) => t.Client).filter(Boolean))).sort();
  }, [filteredTickets]);

  const ticketTableData = useMemo(() => {
    const empMap = {};
    filteredTickets.forEach((t) => {
      if (filterTicketEmployee && t.User !== filterTicketEmployee) return;
      if (filterTicketClient && t.Client !== filterTicketClient) return;

      const emp = t.User || 'Unassigned';
      if (!empMap[emp]) {
        empMap[emp] = {
          name: emp,
          total: 0,
          completed: 0,
          pendingApproval: 0,
          planMins: 0,
          actMins: 0,
          tasks: []
        };
      }
      empMap[emp].total++;
      if (completedStatuses.includes(t.Status)) empMap[emp].completed++;
      if (approvalStatuses.includes(t.Status)) empMap[emp].pendingApproval++;
      empMap[emp].planMins += parseInt(t.TAT, 10) || 0;
      empMap[emp].actMins += parseDurationMins(t.Duration);
      empMap[emp].tasks.push(t);
    });
    return Object.values(empMap);
  }, [filteredTickets, filterTicketEmployee, filterTicketClient]);

  const fmsEmployees = useMemo(() => {
    return Array.from(new Set(filteredFms.map((t) => t.User).filter(Boolean))).sort();
  }, [filteredFms]);
  const fmsClients = useMemo(() => {
    return Array.from(new Set(filteredFms.map((t) => t.Client).filter(Boolean))).sort();
  }, [filteredFms]);

  const fmsTableData = useMemo(() => {
    const empMap = {};
    filteredFms.forEach((t) => {
      if (filterFmsEmployee && t.User !== filterFmsEmployee) return;
      if (filterFmsClient && t.Client !== filterFmsClient) return;

      const emp = t.User || 'Unassigned';
      if (!empMap[emp]) {
        empMap[emp] = {
          name: emp,
          total: 0,
          completed: 0,
          pending: 0,
          tasks: []
        };
      }
      empMap[emp].total++;
      if (isClosedGroup(t.Status)) empMap[emp].completed++;
      else empMap[emp].pending++;
      empMap[emp].tasks.push(t);
    });
    return Object.values(empMap);
  }, [filteredFms, filterFmsEmployee, filterFmsClient]);

  const todoEmployees = useMemo(() => {
    return Array.from(new Set(filteredTodo.map((t) => t.User).filter(Boolean))).sort();
  }, [filteredTodo]);

  const todoTableData = useMemo(() => {
    const empMap = {};
    filteredTodo.forEach((t) => {
      if (filterTodoEmployee && t.User !== filterTodoEmployee) return;

      const emp = t.User || 'Unassigned';
      if (!empMap[emp]) {
        empMap[emp] = {
          name: emp,
          total: 0,
          completed: 0,
          pending: 0,
          tatMins: 0,
          tasks: []
        };
      }
      empMap[emp].total++;
      if (isClosedGroup(t.Status)) empMap[emp].completed++;
      else empMap[emp].pending++;
      empMap[emp].tatMins += parseInt(t.TAT, 10) || 0;
      empMap[emp].tasks.push(t);
    });
    return Object.values(empMap);
  }, [filteredTodo, filterTodoEmployee]);

  // ----------------------------------------------------
  // 7. USER-WISE CLIENT EFFORT REPORT (2-LEVEL DRILLDOWN)
  // ----------------------------------------------------
  const userClientEffortData = useMemo(() => {
    const empMap = {};
    allFilteredTasks.forEach((t) => {
      if (ignoredStatuses.includes(t.Status)) return;

      const emp = t.User || 'Unassigned';
      const client = t.Client || 'General';

      if (!empMap[emp]) {
        empMap[emp] = {
          name: emp,
          totalPlanned: 0,
          totalLogged: 0,
          totalPending: 0,
          clients: {}
        };
      }

      const planMins = parseInt(t.TAT, 10) || 0;
      const actMins = parseDurationMins(t.Duration);
      const isDone = isClosedGroup(t.Status);

      empMap[emp].totalPlanned += planMins;
      if (isDone) empMap[emp].totalLogged += actMins;
      else empMap[emp].totalPending += planMins;

      if (!empMap[emp].clients[client]) {
        empMap[emp].clients[client] = {
          name: client,
          planned: 0,
          logged: 0,
          pending: 0,
          tasks: []
        };
      }

      empMap[emp].clients[client].planned += planMins;
      if (isDone) empMap[emp].clients[client].logged += actMins;
      else empMap[emp].clients[client].pending += planMins;
      empMap[emp].clients[client].tasks.push(t);
    });

    return Object.values(empMap).map((e) => ({
      ...e,
      diff: e.totalPlanned - e.totalLogged,
      clientList: Object.values(e.clients)
    }));
  }, [allFilteredTasks]);

  // ----------------------------------------------------
  // 8. AUDIT: INSTANT CLOSURE DETECTION (<15 MINS)
  // ----------------------------------------------------
  const flaggedInstantClosures = useMemo(() => {
    return filteredTickets.filter((t) => {
      if (!isClosedGroup(t.Status)) return false;
      const planMins = parseInt(t.TAT, 10) || 0;
      const actMins = parseDurationMins(t.Duration);
      return actMins > 0 && actMins < 15 && planMins >= 30;
    });
  }, [filteredTickets]);

  const exportEffortCSV = () => {
    const headers = ['Employee Name', 'Client Name', 'Total Planned (Mins)', 'Total Logged (Mins)', 'Pending (Mins)'];
    const rows = [];
    userClientEffortData.forEach((u) => {
      u.clientList.forEach((c) => {
        rows.push([
          `"${u.name}"`,
          `"${c.name}"`,
          c.planned,
          c.logged,
          c.pending
        ]);
      });
    });
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `user_client_effort_${todayStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* ==================== FILTERS AND REAL-TIME UNIFIED SEARCH BAR ==================== */}
      <div
        style={{
          background: '#fff',
          padding: '16px 20px',
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              background: '#dbeafe',
              color: '#2563eb',
              padding: '10px',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ width: 20, height: 20, minWidth: 20, minHeight: 20 }}
            >
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
            </svg>
          </div>
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: '800', color: '#1e293b', margin: 0 }}>Workspace Master Overview</h2>
            <p style={{ fontSize: '12px', fontWeight: '600', color: '#94a3b8', margin: '2px 0 0 0' }}>Real-time cross-departmental operations audit</p>
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px' }}>
          {/* Search box */}
          <div style={{ position: 'relative', width: '240px' }}>
            <span style={{ position: 'absolute', left: '12px', top: '10px', color: '#94a3b8' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 15, height: 15 }}>
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </span>
            <input
              type="text"
              id="global-search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search Employee or Client..."
              style={{
                width: '100%',
                background: '#f8fafc',
                border: '1px solid #cbd5e1',
                borderRadius: '10px',
                padding: '8px 12px 8px 36px',
                fontSize: '13px',
                fontWeight: '600',
                color: '#334155',
                outline: 'none'
              }}
            />
          </div>

          {/* Status Multi-Select Dropdown */}
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              id="statusDropdownBtn"
              onClick={() => setStatusDropdownOpen(!statusDropdownOpen)}
              style={{
                background: '#fff',
                border: '1px solid #cbd5e1',
                borderRadius: '10px',
                padding: '8px 14px',
                fontSize: '13px',
                fontWeight: '700',
                color: '#334155',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer'
              }}
            >
              <span>{selectedStatuses.length > 0 ? `${selectedStatuses.length} Statuses Selected` : 'Select Statuses'}</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {statusDropdownOpen && (
              <div
                style={{
                  position: 'absolute',
                  right: 0,
                  top: '110%',
                  width: '260px',
                  background: '#fff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                  padding: '12px',
                  zIndex: 50
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '11px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Filter Status</span>
                  <button
                    type="button"
                    onClick={toggleAllStatuses}
                    style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
                  >
                    Toggle All
                  </button>
                </div>
                <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {availableStatuses.map((st) => (
                    <label key={st} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: '600', color: '#334155', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={selectedStatuses.includes(st)}
                        onChange={() => toggleStatusFilter(st)}
                      />
                      <span>{st}</span>
                    </label>
                  ))}
                </div>
                <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '8px', marginTop: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setStatusDropdownOpen(false)}
                    style={{
                      width: '100%',
                      background: '#1e293b',
                      color: '#fff',
                      padding: '6px 12px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: '700',
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    Apply Filter
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ==================== PRIMARY CORE 4 KPIS ==================== */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
        {/* Attendance Today */}
        <div style={{ background: '#fff', padding: '20px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', borderLeft: '5px solid #2563eb' }}>
          <p style={{ fontSize: '11px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Attendance Today</p>
          <div style={{ fontSize: '28px', fontWeight: '800', color: '#2563eb', margin: '6px 0 2px 0' }} id="kpi-attendance-pct">
            {coreKPIs.attendancePct}%
          </div>
          <p style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', margin: 0 }} id="kpi-attendance-count">
            {coreKPIs.attendanceCountStr}
          </p>
        </div>

        {/* Total Work Planned Time */}
        <div style={{ background: '#fff', padding: '20px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', borderLeft: '5px solid #7c3aed' }}>
          <p style={{ fontSize: '11px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Total Work Planned Time</p>
          <div style={{ fontSize: '28px', fontWeight: '800', color: '#7c3aed', margin: '6px 0 2px 0' }} id="kpi-planned-time">
            {coreKPIs.plannedTimeStr}
          </div>
          <p style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', margin: 0 }}>Sum of all planned tasks</p>
        </div>

        {/* Outstanding Receivables */}
        <div style={{ background: '#fff', padding: '20px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', borderLeft: '5px solid #059669' }}>
          <p style={{ fontSize: '11px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Outstanding Receivables</p>
          <div style={{ fontSize: '28px', fontWeight: '800', color: '#059669', margin: '6px 0 2px 0' }} id="kpi-outstanding-total">
            {coreKPIs.outstandingTotal}
          </div>
          <p style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', margin: 0 }} id="kpi-invoice-overdue">
            {coreKPIs.overdueInvsStr}
          </p>
        </div>

        {/* Completed Tasks Today */}
        <div style={{ background: '#fff', padding: '20px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', borderLeft: '5px solid #0d9488' }}>
          <p style={{ fontSize: '11px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Completed Tasks Today</p>
          <div style={{ fontSize: '28px', fontWeight: '800', color: '#0d9488', margin: '6px 0 2px 0' }} id="kpi-completed-today">
            {coreKPIs.completedTodayStr}
          </div>
          <p style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', margin: 0 }} id="kpi-completed-rate">
            {coreKPIs.outputRateStr}
          </p>
        </div>
      </div>

      {/* ==================== QUICK STATS & CHARTS ==================== */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        {/* System Task Doughnut */}
        <div style={{ background: '#fff', padding: '20px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <h3 style={{ fontSize: '15px', fontWeight: '800', color: '#1e293b', margin: '0 0 16px 0' }}>Task Allocation Distribution</h3>
          <div style={{ height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {taskAllocation.length === 0 ? (
              <span style={{ color: '#94a3b8', fontSize: '13px' }}>No task data available</span>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={taskAllocation}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {taskAllocation.map((entry, idx) => (
                      <Cell key={`cell-${idx}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center', marginTop: '10px' }}>
            {taskAllocation.map((item) => (
              <span key={item.name} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: '600', color: '#475569' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: item.color }} />
                {item.name}: <b>{item.value}</b>
              </span>
            ))}
          </div>
        </div>

        {/* Critical Alerts Center */}
        <div style={{ background: '#fff', padding: '20px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: '800', color: '#1e293b', margin: 0 }}>Critical Alerts Center</h3>
              <span style={{ fontSize: '11px', fontWeight: '700', background: '#fee2e2', color: '#b91c1c', padding: '3px 8px', borderRadius: '6px' }}>
                {criticalAlerts.length} Flagged
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '220px', overflowY: 'auto' }} id="dashboard-alerts-container">
              {criticalAlerts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px 0', color: '#94a3b8', fontSize: '13px', fontWeight: '600' }}>
                  No overdue tasks or invoices detected.
                </div>
              ) : (
                criticalAlerts.map((alt, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '10px 14px',
                      borderRadius: '10px',
                      background: alt.type === 'invoice' ? '#fffbeb' : '#fef2f2',
                      borderLeft: alt.type === 'invoice' ? '4px solid #f59e0b' : '4px solid #ef4444'
                    }}
                  >
                    <div style={{ fontSize: '13px', fontWeight: '700', color: '#1e293b' }}>{alt.title}</div>
                    <div style={{ fontSize: '11px', fontWeight: '500', color: '#64748b', marginTop: '2px' }}>{alt.meta}</div>
                  </div>
                ))
              )}
            </div>
          </div>
          <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '10px', marginTop: '12px', fontSize: '11px', color: '#94a3b8', fontWeight: '600' }}>
            To edit tasks, switch to the Client Explorer or User Explorer tab.
          </div>
        </div>
      </div>

      {/* ==================== TEAM EFFICIENCY & BILLING AGING ==================== */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        <div style={{ background: '#fff', padding: '20px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <h3 style={{ fontSize: '15px', fontWeight: '800', color: '#1e293b', margin: '0 0 2px 0' }}>Team Efficiency</h3>
          <p style={{ fontSize: '11px', fontWeight: '600', color: '#94a3b8', margin: '0 0 16px 0' }}>Planned Hours vs Actual Logged Hours</p>
          <div style={{ height: '240px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={teamEfficiencyData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} interval={0} angle={-25} textAnchor="end" />
                <YAxis tick={{ fontSize: 10, fill: '#64748b' }} />
                <RechartsTooltip />
                <Bar dataKey="planned" fill="#6366f1" name="Planned (Hrs)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="actual" fill="#14b8a6" name="Actual (Hrs)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div style={{ background: '#fff', padding: '20px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <h3 style={{ fontSize: '15px', fontWeight: '800', color: '#1e293b', margin: '0 0 2px 0' }}>Billing Aging & Accounts Aging</h3>
          <p style={{ fontSize: '11px', fontWeight: '600', color: '#94a3b8', margin: '0 0 16px 0' }}>Outstanding Payments Buckets</p>
          <div style={{ height: '240px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={agingBucketsData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 10, fill: '#64748b' }} />
                <RechartsTooltip formatter={(val) => `₹${Number(val).toLocaleString('en-IN')}`} />
                <Bar dataKey="amount" fill="#f59e0b" name="Outstanding (₹)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ==================== TICKET & FMS CLOSURE RATE ==================== */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        {/* Ticket Closure Rate */}
        <div style={{ background: '#fff', padding: '20px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: '800', color: '#1e293b', margin: 0 }}>Ticket Closure Rate</h3>
              <p style={{ fontSize: '11px', fontWeight: '600', color: '#94a3b8', margin: '2px 0 0 0' }}>Kitni tickets close ho rahi hain</p>
            </div>
            <div
              style={{
                fontSize: '20px',
                fontWeight: '900',
                color: ticketClosureAnalytics.rate >= 70 ? '#0d9488' : ticketClosureAnalytics.rate >= 40 ? '#f59e0b' : '#ef4444'
              }}
              id="new-tkt-rate-badge"
            >
              {ticketClosureAnalytics.rate}%
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '16px' }}>
            <div style={{ background: '#f8fafc', padding: '10px 6px', borderRadius: '10px', textAlign: 'center', border: '1px solid #f1f5f9' }}>
              <div style={{ fontSize: '18px', fontWeight: '800', color: '#334155' }} id="new-tkt-total">{ticketClosureAnalytics.total}</div>
              <div style={{ fontSize: '10px', fontWeight: '700', color: '#94a3b8' }}>Total</div>
            </div>
            <div style={{ background: '#ecfdf5', padding: '10px 6px', borderRadius: '10px', textAlign: 'center', border: '1px solid #a7f3d0' }}>
              <div style={{ fontSize: '18px', fontWeight: '800', color: '#059669' }} id="new-tkt-closed">{ticketClosureAnalytics.closed}</div>
              <div style={{ fontSize: '10px', fontWeight: '700', color: '#059669' }}>Closed</div>
            </div>
            <div style={{ background: '#fff1f2', padding: '10px 6px', borderRadius: '10px', textAlign: 'center', border: '1px solid #fecdd3' }}>
              <div style={{ fontSize: '18px', fontWeight: '800', color: '#e11d48' }} id="new-tkt-open">{ticketClosureAnalytics.open}</div>
              <div style={{ fontSize: '10px', fontWeight: '700', color: '#e11d48' }}>Open</div>
            </div>
            <div style={{ background: '#fffbeb', padding: '10px 6px', borderRadius: '10px', textAlign: 'center', border: '1px solid #fde68a' }}>
              <div style={{ fontSize: '18px', fontWeight: '800', color: '#d97706' }} id="new-tkt-overdue">{ticketClosureAnalytics.overdue}</div>
              <div style={{ fontSize: '10px', fontWeight: '700', color: '#d97706' }}>Overdue</div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto' }} id="new-ticket-emp-rows">
            {ticketClosureAnalytics.empRows.map((emp) => (
              <div key={emp.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                <span style={{ fontWeight: '700', color: '#334155' }}>{emp.name}</span>
                <span style={{ fontWeight: '600', color: '#64748b' }}>
                  {emp.closed} / {emp.total} (<b style={{ color: emp.rate >= 70 ? '#059669' : '#d97706' }}>{emp.rate}%</b>)
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* FMS Completion Rate */}
        <div style={{ background: '#fff', padding: '20px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: '800', color: '#1e293b', margin: 0 }}>FMS Completion Rate</h3>
              <p style={{ fontSize: '11px', fontWeight: '600', color: '#94a3b8', margin: '2px 0 0 0' }}>FMS tasks kitne complete ho rahe hain</p>
            </div>
            <div
              style={{
                fontSize: '20px',
                fontWeight: '900',
                color: fmsClosureAnalytics.rate >= 70 ? '#7c3aed' : fmsClosureAnalytics.rate >= 40 ? '#f59e0b' : '#ef4444'
              }}
              id="new-fms-rate-badge"
            >
              {fmsClosureAnalytics.rate}%
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '16px' }}>
            <div style={{ background: '#f8fafc', padding: '10px 6px', borderRadius: '10px', textAlign: 'center', border: '1px solid #f1f5f9' }}>
              <div style={{ fontSize: '18px', fontWeight: '800', color: '#334155' }} id="new-fms-total">{fmsClosureAnalytics.total}</div>
              <div style={{ fontSize: '10px', fontWeight: '700', color: '#94a3b8' }}>Total</div>
            </div>
            <div style={{ background: '#ecfdf5', padding: '10px 6px', borderRadius: '10px', textAlign: 'center', border: '1px solid #a7f3d0' }}>
              <div style={{ fontSize: '18px', fontWeight: '800', color: '#059669' }} id="new-fms-done">{fmsClosureAnalytics.done}</div>
              <div style={{ fontSize: '10px', fontWeight: '700', color: '#059669' }}>Completed</div>
            </div>
            <div style={{ background: '#fff1f2', padding: '10px 6px', borderRadius: '10px', textAlign: 'center', border: '1px solid #fecdd3' }}>
              <div style={{ fontSize: '18px', fontWeight: '800', color: '#e11d48' }} id="new-fms-pending">{fmsClosureAnalytics.pending}</div>
              <div style={{ fontSize: '10px', fontWeight: '700', color: '#e11d48' }}>Pending</div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto' }} id="new-fms-emp-rows">
            {fmsClosureAnalytics.empRows.map((emp) => (
              <div key={emp.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                <span style={{ fontWeight: '700', color: '#334155' }}>{emp.name}</span>
                <span style={{ fontWeight: '600', color: '#64748b' }}>
                  {emp.done} / {emp.total} (<b style={{ color: emp.rate >= 70 ? '#7c3aed' : '#d97706' }}>{emp.rate}%</b>)
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ==================== EMPLOYEE TIME BALANCE ==================== */}
      <div style={{ background: '#fff', padding: '20px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
          <div style={{ background: '#e0e7ff', color: '#4f46e5', padding: '8px', borderRadius: '10px' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}>
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: '800', color: '#1e293b', margin: 0 }}>Employee Time Balance & Efficiency</h3>
            <p style={{ fontSize: '11px', fontWeight: '600', color: '#94a3b8', margin: '2px 0 0 0' }}>Kitna time bacha ya kitna overtime hua (Planned vs Actual)</p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px', maxHeight: '240px', overflowY: 'auto' }}>
          {employeeTimeBalances.map((b) => (
            <div
              key={b.name}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 14px',
                borderRadius: '12px',
                background: '#f8fafc',
                border: '1px solid #f1f5f9'
              }}
            >
              <div>
                <div style={{ fontSize: '13px', fontWeight: '800', color: '#1e293b' }}>{b.name}</div>
                <div style={{ fontSize: '11px', fontWeight: '600', color: '#64748b', marginTop: '2px' }}>
                  Plan: {b.planStr} | Logged: {b.actStr}
                </div>
              </div>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: '800',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  background: b.isSurplus ? '#ecfdf5' : '#fef2f2',
                  color: b.isSurplus ? '#059669' : '#dc2626',
                  border: b.isSurplus ? '1px solid #a7f3d0' : '1px solid #fecdd3'
                }}
              >
                {b.diffStr}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ==================== TICKETS WORKLOAD REPORT (COLLAPSIBLE) ==================== */}
      <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
        <div
          onClick={() => setOpenTicketsCard(!openTicketsCard)}
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #f1f5f9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            background: '#fff'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ background: '#dbeafe', color: '#2563eb', padding: '8px', borderRadius: '10px' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}>
                <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
              </svg>
            </div>
            <h2 style={{ fontSize: '15px', fontWeight: '800', color: '#1e293b', margin: 0 }}>Tickets Workload Report</h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (onOpenBatchModal) onOpenBatchModal('ticket');
              }}
              style={{
                background: '#eff6ff',
                color: '#2563eb',
                border: '1px solid #bfdbfe',
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              + Add Tickets
            </button>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                width: 16,
                height: 16,
                transform: openTicketsCard ? 'rotate(0deg)' : 'rotate(-90deg)',
                transition: 'transform 0.2s',
                color: '#94a3b8'
              }}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
        </div>

        {openTicketsCard && (
          <div>
            {/* Filter row */}
            <div style={{ padding: '12px 20px', background: '#f8fafc', borderBottom: '1px solid #f1f5f9', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '11px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase' }}>Filters:</span>
              <select
                value={filterTicketEmployee}
                onChange={(e) => setFilterTicketEmployee(e.target.value)}
                style={{ background: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '6px 10px', fontSize: '12px', fontWeight: '600', color: '#334155' }}
              >
                <option value="">All Employees</option>
                {ticketEmployees.map((emp) => (
                  <option key={emp} value={emp}>{emp}</option>
                ))}
              </select>
              <select
                value={filterTicketClient}
                onChange={(e) => setFilterTicketClient(e.target.value)}
                style={{ background: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '6px 10px', fontSize: '12px', fontWeight: '600', color: '#334155' }}
              >
                <option value="">All Clients</option>
                {ticketClients.map((cl) => (
                  <option key={cl} value={cl}>{cl}</option>
                ))}
              </select>
            </div>

            {/* Table */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase' }}>
                    <th style={{ padding: '10px 12px', textAlign: 'center', width: '36px' }}></th>
                    <th style={{ padding: '10px 16px', textAlign: 'left' }}>Employee Name</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center' }}>Total Assigned</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center' }}>Completed</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center' }}>Pending Approval</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center' }}>Planned TAT</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center' }}>Actual Logged</th>
                    <th style={{ padding: '10px 16px', textAlign: 'right' }}>Efficiency Status</th>
                  </tr>
                </thead>
                <tbody>
                  {ticketTableData.length === 0 ? (
                    <tr>
                      <td colSpan="8" style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>
                        No ticket records found matching filters.
                      </td>
                    </tr>
                  ) : (
                    ticketTableData.map((row) => {
                      const isExpanded = !!expandedTicketRows[row.name];
                      const effDiff = row.planMins - row.actMins;
                      const effText = effDiff >= 0 ? 'On Track / Fast' : 'Overdue TAT';
                      const effColor = effDiff >= 0 ? '#059669' : '#dc2626';

                      return (
                        <React.Fragment key={row.name}>
                          <tr
                            onClick={() => setExpandedTicketRows((prev) => ({ ...prev, [row.name]: !prev[row.name] }))}
                            style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer', background: isExpanded ? '#f8fafc' : '#fff' }}
                          >
                            <td style={{ padding: '10px 12px', textAlign: 'center', color: '#94a3b8' }}>
                              <svg
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                style={{
                                  width: 14,
                                  height: 14,
                                  transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                                  transition: 'transform 0.2s'
                                }}
                              >
                                <polyline points="9 18 15 12 9 6" />
                              </svg>
                            </td>
                            <td style={{ padding: '10px 16px', fontWeight: '800', color: '#1e293b' }}>{row.name}</td>
                            <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: '700' }}>{row.total}</td>
                            <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: '700', color: '#059669' }}>{row.completed}</td>
                            <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: '700', color: '#7c3aed' }}>{row.pendingApproval}</td>
                            <td style={{ padding: '10px 12px', textAlign: 'center', fontFamily: 'monospace', fontWeight: '700', color: '#2563eb' }}>{fmtMins(row.planMins)}</td>
                            <td style={{ padding: '10px 12px', textAlign: 'center', fontFamily: 'monospace', fontWeight: '700', color: '#475569' }}>{fmtMins(row.actMins)}</td>
                            <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                              <span style={{ fontSize: '11px', fontWeight: '800', color: effColor, background: effDiff >= 0 ? '#ecfdf5' : '#fef2f2', padding: '3px 8px', borderRadius: '6px' }}>
                                {effText}
                              </span>
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr>
                              <td colSpan="8" style={{ background: '#f8fafc', padding: '12px 20px', borderBottom: '1px solid #e2e8f0' }}>
                                <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
                                  <thead>
                                    <tr style={{ color: '#64748b', fontSize: '10px', textTransform: 'uppercase', borderBottom: '1px solid #cbd5e1' }}>
                                      <th style={{ textAlign: 'left', padding: '6px 8px' }}>Date</th>
                                      <th style={{ textAlign: 'left', padding: '6px 8px' }}>Client</th>
                                      <th style={{ textAlign: 'left', padding: '6px 8px' }}>Description</th>
                                      <th style={{ textAlign: 'center', padding: '6px 8px' }}>Plan TAT</th>
                                      <th style={{ textAlign: 'center', padding: '6px 8px' }}>Actual Duration</th>
                                      <th style={{ textAlign: 'right', padding: '6px 8px' }}>Status</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {row.tasks.map((t, idx) => (
                                      <tr key={t.ID || idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                        <td style={{ padding: '6px 8px', color: '#64748b' }}>{t.Date || '-'}</td>
                                        <td style={{ padding: '6px 8px', fontWeight: '700', color: '#1e293b' }}>{t.Client || '-'}</td>
                                        <td style={{ padding: '6px 8px', color: '#475569' }}>{t.Desc || t.Description || '-'}</td>
                                        <td style={{ padding: '6px 8px', textAlign: 'center', fontFamily: 'monospace', color: '#2563eb', fontWeight: '700' }}>{t.TAT ? fmtMins(parseInt(t.TAT, 10)) : '-'}</td>
                                        <td style={{ padding: '6px 8px', textAlign: 'center', fontFamily: 'monospace', color: '#64748b' }}>{t.Duration || '-'}</td>
                                        <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: '700' }}>
                                          <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: isClosedGroup(t.Status) ? '#ecfdf5' : '#fff1f2', color: isClosedGroup(t.Status) ? '#059669' : '#e11d48' }}>
                                            {t.Status || 'Open'}
                                          </span>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ==================== FMS TASKS WORKLOAD REPORT (COLLAPSIBLE) ==================== */}
      <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
        <div
          onClick={() => setOpenFmsCard(!openFmsCard)}
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #f1f5f9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            background: '#fff'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ background: '#ccfbf1', color: '#0f766e', padding: '8px', borderRadius: '10px' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}>
                <path d="M9 11l3 3L22 4" />
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
              </svg>
            </div>
            <h2 style={{ fontSize: '15px', fontWeight: '800', color: '#1e293b', margin: 0 }}>FMS Tasks Workload Report</h2>
          </div>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              width: 16,
              height: 16,
              transform: openFmsCard ? 'rotate(0deg)' : 'rotate(-90deg)',
              transition: 'transform 0.2s',
              color: '#94a3b8'
            }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>

        {openFmsCard && (
          <div>
            <div style={{ padding: '12px 20px', background: '#f8fafc', borderBottom: '1px solid #f1f5f9', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '11px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase' }}>Filters:</span>
              <select
                value={filterFmsEmployee}
                onChange={(e) => setFilterFmsEmployee(e.target.value)}
                style={{ background: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '6px 10px', fontSize: '12px', fontWeight: '600', color: '#334155' }}
              >
                <option value="">All Employees</option>
                {fmsEmployees.map((emp) => (
                  <option key={emp} value={emp}>{emp}</option>
                ))}
              </select>
              <select
                value={filterFmsClient}
                onChange={(e) => setFilterFmsClient(e.target.value)}
                style={{ background: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '6px 10px', fontSize: '12px', fontWeight: '600', color: '#334155' }}
              >
                <option value="">All FMS Projects</option>
                {fmsClients.map((cl) => (
                  <option key={cl} value={cl}>{cl}</option>
                ))}
              </select>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase' }}>
                    <th style={{ padding: '10px 12px', textAlign: 'center', width: '36px' }}></th>
                    <th style={{ padding: '10px 16px', textAlign: 'left' }}>Employee Name</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center' }}>Total Assigned</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center' }}>Completed</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center' }}>Pending Tasks</th>
                  </tr>
                </thead>
                <tbody>
                  {fmsTableData.length === 0 ? (
                    <tr>
                      <td colSpan="5" style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>
                        No FMS records found matching filters.
                      </td>
                    </tr>
                  ) : (
                    fmsTableData.map((row) => {
                      const isExpanded = !!expandedFmsRows[row.name];
                      return (
                        <React.Fragment key={row.name}>
                          <tr
                            onClick={() => setExpandedFmsRows((prev) => ({ ...prev, [row.name]: !prev[row.name] }))}
                            style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer', background: isExpanded ? '#f8fafc' : '#fff' }}
                          >
                            <td style={{ padding: '10px 12px', textAlign: 'center', color: '#94a3b8' }}>
                              <svg
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                style={{ width: 14, height: 14, transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
                              >
                                <polyline points="9 18 15 12 9 6" />
                              </svg>
                            </td>
                            <td style={{ padding: '10px 16px', fontWeight: '800', color: '#1e293b' }}>{row.name}</td>
                            <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: '700' }}>{row.total}</td>
                            <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: '700', color: '#059669' }}>{row.completed}</td>
                            <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: '700', color: '#e11d48' }}>{row.pending}</td>
                          </tr>
                          {isExpanded && (
                            <tr>
                              <td colSpan="5" style={{ background: '#f8fafc', padding: '12px 20px', borderBottom: '1px solid #e2e8f0' }}>
                                <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
                                  <thead>
                                    <tr style={{ color: '#64748b', fontSize: '10px', textTransform: 'uppercase', borderBottom: '1px solid #cbd5e1' }}>
                                      <th style={{ textAlign: 'left', padding: '6px 8px' }}>Date</th>
                                      <th style={{ textAlign: 'left', padding: '6px 8px' }}>Project</th>
                                      <th style={{ textAlign: 'left', padding: '6px 8px' }}>Step / Description</th>
                                      <th style={{ textAlign: 'right', padding: '6px 8px' }}>Status</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {row.tasks.map((t, idx) => (
                                      <tr key={t.ID || idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                        <td style={{ padding: '6px 8px', color: '#64748b' }}>{t.Date || '-'}</td>
                                        <td style={{ padding: '6px 8px', fontWeight: '700', color: '#1e293b' }}>{t.Client || '-'}</td>
                                        <td style={{ padding: '6px 8px', color: '#475569' }}>{t.Desc || t.Description || '-'}</td>
                                        <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: '700' }}>
                                          <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: isClosedGroup(t.Status) ? '#ecfdf5' : '#fff1f2', color: isClosedGroup(t.Status) ? '#059669' : '#e11d48' }}>
                                            {t.Status || 'Open'}
                                          </span>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ==================== TO-DO WORKLOAD REPORT (COLLAPSIBLE) ==================== */}
      <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
        <div
          onClick={() => setOpenTodoCard(!openTodoCard)}
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #f1f5f9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            background: '#fff'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ background: '#e0e7ff', color: '#4338ca', padding: '8px', borderRadius: '10px' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}>
                <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
              </svg>
            </div>
            <h2 style={{ fontSize: '15px', fontWeight: '800', color: '#1e293b', margin: 0 }}>To Do (General Tasks) Workload Report</h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (onOpenBatchModal) onOpenBatchModal('todo');
              }}
              style={{
                background: '#e0e7ff',
                color: '#4338ca',
                border: '1px solid #c7d2fe',
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              + Add To-Do Tasks
            </button>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                width: 16,
                height: 16,
                transform: openTodoCard ? 'rotate(0deg)' : 'rotate(-90deg)',
                transition: 'transform 0.2s',
                color: '#94a3b8'
              }}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
        </div>

        {openTodoCard && (
          <div>
            <div style={{ padding: '12px 20px', background: '#f8fafc', borderBottom: '1px solid #f1f5f9', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '11px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase' }}>Filters:</span>
              <select
                value={filterTodoEmployee}
                onChange={(e) => setFilterTodoEmployee(e.target.value)}
                style={{ background: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '6px 10px', fontSize: '12px', fontWeight: '600', color: '#334155' }}
              >
                <option value="">All Employees</option>
                {todoEmployees.map((emp) => (
                  <option key={emp} value={emp}>{emp}</option>
                ))}
              </select>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase' }}>
                    <th style={{ padding: '10px 12px', textAlign: 'center', width: '36px' }}></th>
                    <th style={{ padding: '10px 16px', textAlign: 'left' }}>Employee Name</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center' }}>Total Assigned</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center' }}>Completed</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center' }}>Pending Tasks</th>
                    <th style={{ padding: '10px 16px', textAlign: 'right' }}>Total Planned TAT</th>
                  </tr>
                </thead>
                <tbody>
                  {todoTableData.length === 0 ? (
                    <tr>
                      <td colSpan="6" style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>
                        No to-do records found matching filters.
                      </td>
                    </tr>
                  ) : (
                    todoTableData.map((row) => {
                      const isExpanded = !!expandedTodoRows[row.name];
                      return (
                        <React.Fragment key={row.name}>
                          <tr
                            onClick={() => setExpandedTodoRows((prev) => ({ ...prev, [row.name]: !prev[row.name] }))}
                            style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer', background: isExpanded ? '#f8fafc' : '#fff' }}
                          >
                            <td style={{ padding: '10px 12px', textAlign: 'center', color: '#94a3b8' }}>
                              <svg
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                style={{ width: 14, height: 14, transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
                              >
                                <polyline points="9 18 15 12 9 6" />
                              </svg>
                            </td>
                            <td style={{ padding: '10px 16px', fontWeight: '800', color: '#1e293b' }}>{row.name}</td>
                            <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: '700' }}>{row.total}</td>
                            <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: '700', color: '#059669' }}>{row.completed}</td>
                            <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: '700', color: '#e11d48' }}>{row.pending}</td>
                            <td style={{ padding: '10px 16px', textAlign: 'right', fontFamily: 'monospace', fontWeight: '700', color: '#2563eb' }}>{fmtMins(row.tatMins)}</td>
                          </tr>
                          {isExpanded && (
                            <tr>
                              <td colSpan="6" style={{ background: '#f8fafc', padding: '12px 20px', borderBottom: '1px solid #e2e8f0' }}>
                                <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
                                  <thead>
                                    <tr style={{ color: '#64748b', fontSize: '10px', textTransform: 'uppercase', borderBottom: '1px solid #cbd5e1' }}>
                                      <th style={{ textAlign: 'left', padding: '6px 8px' }}>Date</th>
                                      <th style={{ textAlign: 'left', padding: '6px 8px' }}>Task Description</th>
                                      <th style={{ textAlign: 'center', padding: '6px 8px' }}>TAT</th>
                                      <th style={{ textAlign: 'right', padding: '6px 8px' }}>Status</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {row.tasks.map((t, idx) => (
                                      <tr key={t.ID || idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                        <td style={{ padding: '6px 8px', color: '#64748b' }}>{t.Date || '-'}</td>
                                        <td style={{ padding: '6px 8px', color: '#475569' }}>{t.Desc || t.Description || '-'}</td>
                                        <td style={{ padding: '6px 8px', textAlign: 'center', fontFamily: 'monospace', color: '#2563eb', fontWeight: '700' }}>{t.TAT ? fmtMins(parseInt(t.TAT, 10)) : '-'}</td>
                                        <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: '700' }}>
                                          <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: isClosedGroup(t.Status) ? '#ecfdf5' : '#fff1f2', color: isClosedGroup(t.Status) ? '#059669' : '#e11d48' }}>
                                            {t.Status || 'Open'}
                                          </span>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ==================== USER-WISE CLIENT EFFORT REPORT (2-LEVEL DRILLDOWN) ==================== */}
      <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
        <div
          onClick={() => setOpenEffortCard(!openEffortCard)}
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #f1f5f9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            background: '#fff'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ background: '#e0e7ff', color: '#4338ca', padding: '8px', borderRadius: '10px' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}>
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <h2 style={{ fontSize: '15px', fontWeight: '800', color: '#1e293b', margin: 0 }}>User-wise Client Effort Report</h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                exportEffortCSV();
              }}
              style={{
                background: '#f8fafc',
                color: '#475569',
                border: '1px solid #cbd5e1',
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              Export CSV
            </button>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                width: 16,
                height: 16,
                transform: openEffortCard ? 'rotate(0deg)' : 'rotate(-90deg)',
                transition: 'transform 0.2s',
                color: '#94a3b8'
              }}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
        </div>

        {openEffortCard && (
          <div style={{ overflowX: 'auto', maxHeight: '520px', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase' }}>
                  <th style={{ padding: '10px 12px', textAlign: 'center', width: '36px' }}></th>
                  <th style={{ padding: '10px 16px', textAlign: 'left' }}>Employee Name</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center' }}>Total Planned</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center' }}>Total Logged (Completed)</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center' }}>Total Pending (Remaining)</th>
                  <th style={{ padding: '10px 16px', textAlign: 'right' }}>Difference</th>
                </tr>
              </thead>
              <tbody>
                {userClientEffortData.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>
                      No client effort records available.
                    </td>
                  </tr>
                ) : (
                  userClientEffortData.map((emp) => {
                    const isUserExp = !!expandedEffortUsers[emp.name];
                    return (
                      <React.Fragment key={emp.name}>
                        <tr
                          onClick={() => setExpandedEffortUsers((prev) => ({ ...prev, [emp.name]: !prev[emp.name] }))}
                          style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer', background: isUserExp ? '#f8fafc' : '#fff' }}
                        >
                          <td style={{ padding: '10px 12px', textAlign: 'center', color: '#94a3b8' }}>
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              style={{ width: 14, height: 14, transform: isUserExp ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
                            >
                              <polyline points="9 18 15 12 9 6" />
                            </svg>
                          </td>
                          <td style={{ padding: '10px 16px', fontWeight: '800', color: '#1e293b' }}>{emp.name}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'center', fontFamily: 'monospace', fontWeight: '700', color: '#2563eb' }}>{fmtMins(emp.totalPlanned)}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'center', fontFamily: 'monospace', fontWeight: '700', color: '#059669' }}>{fmtMins(emp.totalLogged)}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'center', fontFamily: 'monospace', fontWeight: '700', color: '#e11d48' }}>{fmtMins(emp.totalPending)}</td>
                          <td style={{ padding: '10px 16px', textAlign: 'right', fontFamily: 'monospace', fontWeight: '800', color: emp.diff >= 0 ? '#059669' : '#dc2626' }}>
                            {emp.diff >= 0 ? `+${fmtMins(emp.diff)}` : `-${fmtMins(Math.abs(emp.diff))}`}
                          </td>
                        </tr>

                        {/* Level 2: Clients of this Employee */}
                        {isUserExp &&
                          emp.clientList.map((cl) => {
                            const clKey = `${emp.name}__${cl.name}`;
                            const isClExp = !!expandedEffortClients[clKey];

                            return (
                              <React.Fragment key={clKey}>
                                <tr
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setExpandedEffortClients((prev) => ({ ...prev, [clKey]: !prev[clKey] }));
                                  }}
                                  style={{ background: '#f1f5f9', borderBottom: '1px solid #e2e8f0', cursor: 'pointer' }}
                                >
                                  <td style={{ padding: '8px 12px', textAlign: 'right', color: '#94a3b8' }}>
                                    <svg
                                      width="12"
                                      height="12"
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth="2"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      style={{ width: 12, height: 12, transform: isClExp ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
                                    >
                                      <polyline points="9 18 15 12 9 6" />
                                    </svg>
                                  </td>
                                  <td style={{ padding: '8px 16px 8px 32px', fontWeight: '700', color: '#334155' }}>
                                    📁 {cl.name} ({cl.tasks.length} tasks)
                                  </td>
                                  <td style={{ padding: '8px 12px', textAlign: 'center', fontFamily: 'monospace', color: '#475569' }}>{fmtMins(cl.planned)}</td>
                                  <td style={{ padding: '8px 12px', textAlign: 'center', fontFamily: 'monospace', color: '#059669' }}>{fmtMins(cl.logged)}</td>
                                  <td style={{ padding: '8px 12px', textAlign: 'center', fontFamily: 'monospace', color: '#e11d48' }}>{fmtMins(cl.pending)}</td>
                                  <td style={{ padding: '8px 16px', textAlign: 'right', fontFamily: 'monospace', color: '#64748b' }}>-</td>
                                </tr>

                                {/* Level 3: Individual task rows */}
                                {isClExp &&
                                  cl.tasks.map((t, idx) => (
                                    <tr key={t.ID || idx} style={{ background: '#fff', borderBottom: '1px solid #f1f5f9', fontSize: '11px' }}>
                                      <td></td>
                                      <td style={{ padding: '6px 16px 6px 48px', color: '#475569' }}>
                                        <span style={{ fontWeight: '600', color: '#1e293b' }}>{t.Date || '-'}</span>: {t.Desc || t.Description || '-'}
                                      </td>
                                      <td style={{ padding: '6px 12px', textAlign: 'center', fontFamily: 'monospace', color: '#2563eb' }}>{t.TAT ? fmtMins(parseInt(t.TAT, 10)) : '-'}</td>
                                      <td style={{ padding: '6px 12px', textAlign: 'center', fontFamily: 'monospace', color: '#059669' }}>{t.Duration || '-'}</td>
                                      <td style={{ padding: '6px 12px', textAlign: 'center' }}>-</td>
                                      <td style={{ padding: '6px 16px', textAlign: 'right' }}>
                                        <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: isClosedGroup(t.Status) ? '#ecfdf5' : '#fff1f2', color: isClosedGroup(t.Status) ? '#059669' : '#e11d48', fontWeight: '700' }}>
                                          {t.Status || 'Open'}
                                        </span>
                                      </td>
                                    </tr>
                                  ))}
                              </React.Fragment>
                            );
                          })}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ==================== AUDIT: INSTANT CLOSURE DETECTION CARD (<15 MINS) ==================== */}
      <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
        <div
          onClick={() => setOpenAuditCard(!openAuditCard)}
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #f1f5f9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            background: '#fff'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ background: '#fee2e2', color: '#dc2626', padding: '8px', borderRadius: '10px' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}>
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
            </div>
            <h3 style={{ fontSize: '15px', fontWeight: '800', color: '#dc2626', margin: 0 }}>
              Instant Ticket Closure Audit (Flagged &lt; 15 mins)
            </h3>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '10px', fontWeight: '800', background: '#fee2e2', color: '#b91c1c', padding: '4px 8px', borderRadius: '6px', textTransform: 'uppercase' }}>
              Fraud Detection Mode
            </span>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                width: 16,
                height: 16,
                transform: openAuditCard ? 'rotate(0deg)' : 'rotate(-90deg)',
                transition: 'transform 0.2s',
                color: '#94a3b8'
              }}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
        </div>

        {openAuditCard && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ background: '#fef2f2', color: '#991b1b', fontSize: '10px', fontWeight: '800', textTransform: 'uppercase', borderBottom: '1px solid #fecdd3' }}>
                  <th style={{ padding: '10px 14px', textAlign: 'left' }}>Employee</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left' }}>Ticket / Task</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left' }}>Client</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left' }}>Date</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center' }}>Planned TAT</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right' }}>Duration Recorded</th>
                </tr>
              </thead>
              <tbody>
                {flaggedInstantClosures.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '24px', color: '#94a3b8' }}>
                      No flagged instant ticket closures detected.
                    </td>
                  </tr>
                ) : (
                  flaggedInstantClosures.map((t, idx) => (
                    <tr key={t.ID || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 14px', fontWeight: '800', color: '#1e293b' }}>{t.User || 'Unassigned'}</td>
                      <td style={{ padding: '10px 14px', color: '#475569' }}>{t.Desc || t.Description || '-'}</td>
                      <td style={{ padding: '10px 14px', color: '#64748b' }}>{t.Client || '-'}</td>
                      <td style={{ padding: '10px 14px', color: '#64748b' }}>{t.Date || '-'}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'center', fontFamily: 'monospace', color: '#2563eb', fontWeight: '700' }}>
                        {t.TAT ? fmtMins(parseInt(t.TAT, 10)) : '-'}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'monospace', color: '#dc2626', fontWeight: '800' }}>
                        {t.Duration || '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
