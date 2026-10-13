import React, { useState, useMemo } from 'react';

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

function sortTasksByStatusPriority(tasks = []) {
  const priority = (s) => {
    if (isPendingGroup(s)) return 1;
    if (isInProgressGroup(s)) return 2;
    if (approvalStatuses.includes(s)) return 3;
    if (completedStatuses.includes(s)) return 4;
    return 5;
  };
  return [...tasks].sort((a, b) => {
    const pDiff = priority(a.Status) - priority(b.Status);
    if (pDiff !== 0) return pDiff;
    return String(b.Date || '').localeCompare(String(a.Date || ''));
  });
}

export function ClientExplorerSection({
  clients = [],
  selectedClientId = '',
  onClientChange,
  selectedClient = null,
  explorer = {},
  tickets = [],
  fms = [],
  todo = [],
  invoices = []
}) {
  // Collapsible cards state
  const [openInvoices, setOpenInvoices] = useState(true);
  const [openWorkItems, setOpenWorkItems] = useState(true);
  const [openBandwidth, setOpenBandwidth] = useState(true);

  // Active client object
  const currentClient = useMemo(() => {
    if (!selectedClientId) return null;
    return (
      selectedClient ||
      clients.find(
        (c) =>
          String(c.Client_Id || c.id || '').trim().toUpperCase() ===
          String(selectedClientId || '').trim().toUpperCase()
      ) ||
      null
    );
  }, [clients, selectedClientId, selectedClient]);

  const clientName = currentClient ? (currentClient['Client Name'] || currentClient.name || '') : '';
  const clientId = currentClient ? (currentClient.Client_Id || currentClient.id || '') : '';

  // Filter tasks for this client (tickets, fms, todo)
  const clientTasks = useMemo(() => {
    if (!currentClient) return [];
    const targetName = clientName.toLowerCase().trim();
    const targetId = clientId.toLowerCase().trim();

    const matchesClient = (item = {}) => {
      const c = String(item.Client || item.ClientName || item['Client Name'] || '').toLowerCase().trim();
      const cId = String(item.Client_Id || item.ClientID || item.clientId || '').toLowerCase().trim();
      if (targetId && (cId === targetId || c === targetId)) return true;
      if (targetName && (c === targetName || c.includes(targetName) || (targetName.length > 3 && targetName.includes(c)))) return true;
      return false;
    };

    const tFiltered = tickets.filter(matchesClient).map((t) => ({ ...t, Type: 'Ticket' }));
    const fFiltered = fms.filter(matchesClient).map((t) => ({ ...t, Type: 'FMS' }));
    const toFiltered = todo.filter(matchesClient).map((t) => ({ ...t, Type: 'Todo' }));

    return [...tFiltered, ...fFiltered, ...toFiltered];
  }, [currentClient, clientName, clientId, tickets, fms, todo]);

  // Filter invoices for this client
  const clientInvoices = useMemo(() => {
    if (!currentClient) return [];
    const targetName = clientName.toLowerCase().trim();
    const targetId = clientId.toLowerCase().trim();

    return invoices.filter((inv) => {
      const cId = String(inv.Client_Id || inv.ClientID || inv.id || '').toLowerCase().trim();
      const cName = String(inv['Client Name'] || inv.Client || inv.ClientName || '').toLowerCase().trim();
      if (targetId && (cId === targetId || cName === targetId)) return true;
      if (targetName && (cName === targetName || cName.includes(targetName) || (targetName.length > 3 && targetName.includes(cName)))) return true;
      return false;
    });
  }, [currentClient, clientName, clientId, invoices]);

  // KPI Calculations matching Apps Script lines 3042-3085
  const {
    totalCount,
    pendingCount,
    progressCount,
    closedCount,
    totalPlanMins,
    pendingPlanMins,
    progressPlanMins,
    closedLoggedMins
  } = useMemo(() => {
    let tot = 0;
    let pend = 0;
    let prog = 0;
    let clos = 0;

    let totPlan = 0;
    let pendPlan = 0;
    let progPlan = 0;
    let closAct = 0;

    clientTasks.forEach((t) => {
      const s = t.Status || '';
      if (ignoredStatuses.includes(s)) return;

      tot++;
      const pMins = parseInt(t.TAT, 10) || 0;
      const aMins = parseDurationMins(t.Duration);
      totPlan += pMins;

      if (isClosedGroup(s)) {
        clos++;
        closAct += aMins;
      } else if (isInProgressGroup(s)) {
        prog++;
        progPlan += pMins;
      } else {
        pend++;
        pendPlan += pMins;
      }
    });

    return {
      totalCount: tot,
      pendingCount: pend,
      progressCount: prog,
      closedCount: clos,
      totalPlanMins: totPlan,
      pendingPlanMins: pendPlan,
      progressPlanMins: progPlan,
      closedLoggedMins: closAct
    };
  }, [clientTasks]);

  // Invoice breakdown summary
  const { totalInvoices, pendingInvoices, clearedInvoices, outstandingTotal } = useMemo(() => {
    const totalInv = clientInvoices.length;
    let pendInv = 0;
    let clrInv = 0;
    let totalOut = 0;

    clientInvoices.forEach((i) => {
      const outAmt = Number(i.Outstanding || 0);
      totalOut += outAmt;
      if (outAmt > 0) {
        pendInv++;
      } else {
        clrInv++;
      }
    });

    return {
      totalInvoices: totalInv,
      pendingInvoices: pendInv,
      clearedInvoices: clrInv,
      outstandingTotal: totalOut
    };
  }, [clientInvoices]);

  // Bandwidth by employee matching Apps Script lines 3086-3137
  const bandwidthData = useMemo(() => {
    const empMap = {};
    let totalAct = 0;
    let totalPlan = 0;

    clientTasks.forEach((t) => {
      if (ignoredStatuses.includes(t.Status)) return;

      const empName = t.User || 'Unassigned';
      if (!empMap[empName]) {
        empMap[empName] = {
          name: empName,
          count: 0,
          plan: 0,
          act: 0
        };
      }

      empMap[empName].count++;
      const planMins = parseInt(t.TAT, 10) || 0;
      empMap[empName].plan += planMins;
      totalPlan += planMins;

      const actMins = parseDurationMins(t.Duration);
      empMap[empName].act += actMins;
      totalAct += actMins;
    });

    const sorted = Object.values(empMap).sort((a, b) => b.act - a.act);
    return {
      employees: sorted,
      totalActMins: totalAct,
      totalPlanMins: totalPlan
    };
  }, [clientTasks]);

  const sortedTasks = useMemo(() => sortTasksByStatusPriority(clientTasks), [clientTasks]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* ==================== PREMIUM COMPACT SELECTION BAR WITH DUAL-ROW RULES ==================== */}
      <div
        style={{
          background: '#fff',
          padding: '20px',
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}
      >
        {/* Top Row: Title on Left, Dropdown strictly on the Right */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                background: '#f3e8ff',
                color: '#9333ea',
                padding: '10px',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ width: 22, height: 22, minWidth: 22, minHeight: 22 }}
              >
                <path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: '800', color: '#1e293b', margin: 0 }}>Client Explorer</h2>
              <p style={{ fontSize: '12px', fontWeight: '600', color: '#94a3b8', margin: '4px 0 0 0' }}>
                Consolidated workload, tickets & billing details
              </p>
            </div>
          </div>

          <select
            id="cx-client-selector"
            value={selectedClientId}
            onChange={(e) => onClientChange(e.target.value)}
            style={{
              background: '#f8fafc',
              border: '1px solid #cbd5e1',
              borderRadius: '10px',
              padding: '10px 16px',
              fontSize: '13px',
              fontWeight: '700',
              color: '#334155',
              outline: 'none',
              minWidth: '240px',
              cursor: 'pointer'
            }}
          >
            <option value="">Select a Client...</option>
            {clients.map((c) => (
              <option key={c.Client_Id || c.id} value={c.Client_Id || c.id}>
                {c['Client Name'] || c.name}
              </option>
            ))}
          </select>
        </div>

        {/* Bottom Row: Explicit Rules Strip matching Apps Script lines 1251-1277 */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '12px',
            fontSize: '11px',
            fontWeight: '700',
            fontFamily: 'monospace',
            color: '#64748b',
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            padding: '8px 14px',
            borderRadius: '10px'
          }}
        >
          <span style={{ color: '#94a3b8', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
              <circle cx="12" cy="12" r="10" />
              <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
            </svg>
            Rules:
          </span>

          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }} />
            <span style={{ color: '#1e293b' }}>Closed</span>
            <span style={{ color: '#94a3b8', fontWeight: '500' }}>(= Closed + Pending Approval)</span>
          </span>

          <span style={{ color: '#cbd5e1' }}>|</span>

          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f59e0b' }} />
            <span style={{ color: '#1e293b' }}>In Progress</span>
            <span style={{ color: '#94a3b8', fontWeight: '500' }}>(= In Progress + Paused)</span>
          </span>

          <span style={{ color: '#cbd5e1' }}>|</span>

          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f43f5e' }} />
            <span style={{ color: '#1e293b' }}>Pending</span>
            <span style={{ color: '#94a3b8', fontWeight: '500' }}>(= Open + Rework + Reassigned)</span>
          </span>
        </div>
      </div>

      {/* ==================== PLACEHOLDER STATE (WHEN NO CLIENT IS SELECTED) ==================== */}
      {!currentClient ? (
        <div
          style={{
            background: '#fff',
            borderRadius: '16px',
            border: '1px dashed #cbd5e1',
            padding: '56px 20px',
            textAlign: 'center'
          }}
        >
          <div style={{ color: '#94a3b8', marginBottom: '14px' }}>
            <svg
              width="44"
              height="44"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ margin: '0 auto', width: 44, height: 44 }}
            >
              <path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <p style={{ fontSize: '14px', fontWeight: '600', color: '#64748b', margin: 0 }}>
            Select a Client from the dropdown list to audit their work items, outstanding balances, and open projects.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* ==================== 4 CLIENT KPI SUMMARY CARDS ==================== */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '16px' }}>
            {/* Card 1: Total Tickets */}
            <div
              style={{
                background: '#fff',
                padding: '18px 20px',
                borderRadius: '16px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                borderBottom: '4px solid #6366f1',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <div>
                <span style={{ fontSize: '11px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Total Tickets Raised
                </span>
                <div style={{ fontSize: '28px', fontWeight: '900', color: '#1e293b', marginTop: '4px' }} id="cx-kpi-total">
                  {totalCount}
                </div>
              </div>
              <div style={{ background: '#e0e7ff', color: '#6366f1', padding: '12px', borderRadius: '50%' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 22, height: 22 }}>
                  <path d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                </svg>
              </div>
            </div>

            {/* Card 2: Active Pending */}
            <div
              style={{
                background: '#fff',
                padding: '18px 20px',
                borderRadius: '16px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                borderBottom: '4px solid #f59e0b',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <div>
                <span style={{ fontSize: '11px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Active Pending Work
                </span>
                <div style={{ fontSize: '28px', fontWeight: '900', color: '#f59e0b', marginTop: '4px' }} id="cx-kpi-pending">
                  {pendingCount}
                </div>
              </div>
              <div style={{ background: '#fef3c7', color: '#d97706', padding: '12px', borderRadius: '50%' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 22, height: 22 }}>
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </div>
            </div>

            {/* Card 3: Time Allocation */}
            <div
              style={{
                background: '#fff',
                padding: '18px 20px',
                borderRadius: '16px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                borderBottom: '4px solid #3b82f6',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <div>
                <span style={{ fontSize: '11px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Time Allocation
                </span>
                <div style={{ fontSize: '28px', fontWeight: '900', color: '#2563eb', marginTop: '4px' }} id="cx-kpi-time">
                  {fmtMins(totalPlanMins)}
                </div>
              </div>
              <div style={{ background: '#dbeafe', color: '#2563eb', padding: '12px', borderRadius: '50%' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 22, height: 22 }}>
                  <path d="M21.21 15.89A10 10 0 118 2.83" />
                  <path d="M22 12A10 10 0 0012 2v10z" />
                </svg>
              </div>
            </div>

            {/* Card 4: Outstanding Dues */}
            <div
              style={{
                background: '#fff',
                padding: '18px 20px',
                borderRadius: '16px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                borderBottom: '4px solid #10b981',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <div>
                <span style={{ fontSize: '11px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Outstanding Dues
                </span>
                <div style={{ fontSize: '28px', fontWeight: '900', color: '#059669', marginTop: '4px' }} id="cx-kpi-bills">
                  ₹{outstandingTotal.toLocaleString('en-IN')}
                </div>
              </div>
              <div style={{ background: '#d1fae5', color: '#059669', padding: '12px', borderRadius: '50%' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 22, height: 22 }}>
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <line x1="12" y1="8" x2="12" y2="16" />
                  <line x1="8" y1="12" x2="16" y2="12" />
                </svg>
              </div>
            </div>
          </div>

          {/* ==================== CARD 1: INVOICE BREAKDOWN ==================== */}
          <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
            <div
              onClick={() => setOpenInvoices(!openInvoices)}
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
                <div style={{ background: '#d1fae5', color: '#059669', padding: '8px', borderRadius: '10px' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}>
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                    <polyline points="10 9 9 9 8 9" />
                  </svg>
                </div>
                <h3 style={{ fontSize: '15px', fontWeight: '800', color: '#1e293b', margin: 0 }}>Invoice Breakdown</h3>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', fontWeight: '700', fontFamily: 'monospace' }}>
                  <span style={{ color: '#2563eb' }}>Total: {totalInvoices}</span>
                  <span style={{ color: '#cbd5e1' }}>|</span>
                  <span style={{ color: '#e11d48' }}>Pending: {pendingInvoices}</span>
                  <span style={{ color: '#cbd5e1' }}>|</span>
                  <span style={{ color: '#059669' }}>Cleared: {clearedInvoices}</span>
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
                    transform: openInvoices ? 'rotate(0deg)' : 'rotate(-90deg)',
                    transition: 'transform 0.2s',
                    color: '#94a3b8'
                  }}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>
            </div>

            {openInvoices && (
              <div style={{ padding: '20px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
                  {clientInvoices.length === 0 ? (
                    <div style={{ padding: '24px', textAlign: 'center', fontSize: '13px', color: '#94a3b8', fontWeight: '600', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1', gridColumn: '1 / -1' }}>
                      No ledger balances recorded for this client.
                    </div>
                  ) : (
                    clientInvoices.map((inv, idx) => {
                      const outAmt = Number(inv.Outstanding || 0);
                      const isOverdue = outAmt > 0;
                      return (
                        <div
                          key={inv.InvoiceID || inv._id || idx}
                          style={{
                            padding: '16px',
                            background: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            borderRadius: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                          }}
                        >
                          <div>
                            <span style={{ fontSize: '13px', fontWeight: '800', color: '#1e293b', display: 'block' }}>
                              {inv.Invoice_No || inv.InvoiceID || 'General Invoice'}
                            </span>
                            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '600', display: 'block', marginTop: '4px' }}>
                              Due: {inv.DueDateFmt || inv.DueDate || inv.Date || '-'} | Collector: {inv.AssignedCollector || inv.Collector || 'Internal'}
                            </span>
                          </div>
                          <span
                            style={{
                              padding: '6px 10px',
                              borderRadius: '8px',
                              fontFamily: 'monospace',
                              fontWeight: '800',
                              fontSize: '13px',
                              background: isOverdue ? '#fff1f2' : '#ecfdf5',
                              color: isOverdue ? '#e11d48' : '#059669',
                              border: isOverdue ? '1px solid #fecdd3' : '1px solid #a7f3d0'
                            }}
                          >
                            ₹{outAmt.toLocaleString('en-IN')}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ==================== CARD 2: CLIENT SUPPORT WORK ITEMS ==================== */}
          <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
            <div
              onClick={() => setOpenWorkItems(!openWorkItems)}
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
                <div style={{ background: '#f3e8ff', color: '#9333ea', padding: '8px', borderRadius: '10px' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}>
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                  </svg>
                </div>
                <h3 style={{ fontSize: '15px', fontWeight: '800', color: '#1e293b', margin: 0 }}>Client Support Work Items</h3>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', fontWeight: '700', fontFamily: 'monospace' }}>
                  <span style={{ color: '#2563eb' }}>Total: {fmtMins(totalPlanMins)} ({totalCount})</span>
                  <span style={{ color: '#cbd5e1' }}>|</span>
                  <span style={{ color: '#e11d48' }}>Pending: {fmtMins(pendingPlanMins)} ({pendingCount})</span>
                  <span style={{ color: '#cbd5e1' }}>|</span>
                  <span style={{ color: '#d97706' }}>In Progress: {fmtMins(progressPlanMins)} ({progressCount})</span>
                  <span style={{ color: '#cbd5e1' }}>|</span>
                  <span style={{ color: '#059669' }}>Closed: {fmtMins(closedLoggedMins)} ({closedCount})</span>
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
                    transform: openWorkItems ? 'rotate(0deg)' : 'rotate(-90deg)',
                    transition: 'transform 0.2s',
                    color: '#94a3b8'
                  }}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>
            </div>

            {openWorkItems && (
              <div style={{ padding: '16px 20px', overflowX: 'auto', maxHeight: '500px', overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ color: '#64748b', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                      <th style={{ padding: '10px 12px', textAlign: 'left' }}>Date</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left' }}>Type</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left' }}>Description</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left' }}>Engineer</th>
                      <th style={{ padding: '10px 12px', textAlign: 'center', width: '100px' }}>Plan TAT</th>
                      <th style={{ padding: '10px 12px', textAlign: 'center', width: '100px' }}>Actual TAT</th>
                      <th style={{ padding: '10px 16px', textAlign: 'right' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedTasks.length === 0 ? (
                      <tr>
                        <td colSpan="7" style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>
                          All work clear! No support records pending.
                        </td>
                      </tr>
                    ) : (
                      sortedTasks.map((t, idx) => {
                        const isFms = t.Type === 'FMS';
                        const isTodo = t.Type === 'Todo' || t.Type === 'To-Do';

                        let badgeBg = '#dbeafe';
                        let badgeColor = '#1d4ed8';
                        let badgeLabel = 'TKT';

                        if (isFms) {
                          badgeBg = '#ccfbf1';
                          badgeColor = '#0f766e';
                          badgeLabel = 'FMS';
                        } else if (isTodo) {
                          badgeBg = '#e0e7ff';
                          badgeColor = '#4338ca';
                          badgeLabel = 'TODO';
                        }

                        let statusBg = '#f1f5f9';
                        let statusColor = '#475569';
                        if (isClosedGroup(t.Status)) {
                          statusBg = '#ecfdf5';
                          statusColor = '#059669';
                        } else if (approvalStatuses.includes(t.Status)) {
                          statusBg = '#f3e8ff';
                          statusColor = '#9333ea';
                        } else if (isInProgressGroup(t.Status)) {
                          statusBg = '#fef3c7';
                          statusColor = '#d97706';
                        } else if (isPendingGroup(t.Status)) {
                          statusBg = '#fff1f2';
                          statusColor = '#e11d48';
                        }

                        const actualFormatted = t.Duration || '0h 0m';
                        const planMins = parseInt(t.TAT, 10) || 0;
                        const actualMins = parseDurationMins(actualFormatted);

                        let timeWarnStyle = {};
                        if (!isFms && planMins > 0) {
                          if (actualMins > planMins) {
                            timeWarnStyle = { color: '#e11d48', background: '#fff1f2', padding: '2px 6px', borderRadius: '6px', fontWeight: '800' };
                          } else if (actualMins > 0) {
                            timeWarnStyle = { color: '#059669', background: '#ecfdf5', padding: '2px 6px', borderRadius: '6px', fontWeight: '800' };
                          }
                        }

                        return (
                          <tr key={t.ID || t._id || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '10px 12px', color: '#64748b', fontSize: '11px', whiteSpace: 'nowrap' }}>
                              {t.Date || '-'}
                            </td>
                            <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                              <span style={{ background: badgeBg, color: badgeColor, padding: '3px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: '800' }}>
                                {badgeLabel}
                              </span>
                            </td>
                            <td style={{ padding: '10px 12px', fontWeight: '600', color: '#1e293b', maxWidth: '300px' }} title={t.Desc || t.Description || '-'}>
                              {t.Desc || t.Description || '-'}
                            </td>
                            <td style={{ padding: '10px 12px', fontWeight: '700', color: '#475569', whiteSpace: 'nowrap' }}>
                              {t.User || 'Unassigned'}
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'center', fontFamily: 'monospace', fontWeight: '700', color: '#2563eb', whiteSpace: 'nowrap' }}>
                              {fmtMins(planMins)}
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'center', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                              <span style={timeWarnStyle}>{actualFormatted}</span>
                            </td>
                            <td style={{ padding: '10px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                              <span style={{ background: statusBg, color: statusColor, padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '800' }}>
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
          </div>

          {/* ==================== CARD 3: EMPLOYEE BANDWIDTH & RESOURCE DISTRIBUTION ==================== */}
          <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
            <div
              onClick={() => setOpenBandwidth(!openBandwidth)}
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
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                </div>
                <h3 style={{ fontSize: '15px', fontWeight: '800', color: '#1e293b', margin: 0 }}>
                  Employee Bandwidth & Resource Distribution
                </h3>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', fontWeight: '700', fontFamily: 'monospace' }}>
                  <span style={{ color: '#2563eb' }}>Employees: {bandwidthData.employees.length}</span>
                  <span style={{ color: '#cbd5e1' }}>|</span>
                  <span style={{ color: '#d97706' }}>Planned: {fmtMins(bandwidthData.totalPlanMins)}</span>
                  <span style={{ color: '#cbd5e1' }}>|</span>
                  <span style={{ color: '#059669' }}>Logged: {fmtMins(bandwidthData.totalActMins)}</span>
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
                    transform: openBandwidth ? 'rotate(0deg)' : 'rotate(-90deg)',
                    transition: 'transform 0.2s',
                    color: '#94a3b8'
                  }}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>
            </div>

            {openBandwidth && (
              <div style={{ padding: '16px 20px', overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ color: '#64748b', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                      <th style={{ padding: '10px 12px', textAlign: 'left' }}>Employee Name</th>
                      <th style={{ padding: '10px 12px', textAlign: 'center' }}>Assigned Tasks</th>
                      <th style={{ padding: '10px 12px', textAlign: 'center' }}>Total Planned TAT</th>
                      <th style={{ padding: '10px 12px', textAlign: 'center' }}>Total Actual Logged</th>
                      <th style={{ padding: '10px 16px', textAlign: 'right' }}>Time Share (%)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bandwidthData.employees.length === 0 ? (
                      <tr>
                        <td colSpan="5" style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>
                          No active resource logs recorded for this client.
                        </td>
                      </tr>
                    ) : (
                      bandwidthData.employees.map((e, idx) => {
                        const sharePct =
                          bandwidthData.totalActMins > 0
                            ? Math.round((e.act / bandwidthData.totalActMins) * 100)
                            : 0;

                        let progressColor = '#94a3b8';
                        if (sharePct > 50) progressColor = '#9333ea';
                        else if (sharePct > 25) progressColor = '#2563eb';
                        else if (sharePct > 10) progressColor = '#0d9488';

                        return (
                          <tr key={e.name || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '12px', fontWeight: '800', color: '#1e293b', whiteSpace: 'nowrap' }}>
                              {e.name}
                            </td>
                            <td style={{ padding: '12px', textAlign: 'center', fontWeight: '700', color: '#334155' }}>
                              {e.count}
                            </td>
                            <td style={{ padding: '12px', textAlign: 'center', fontFamily: 'monospace', fontWeight: '700', color: '#94a3b8' }}>
                              {fmtMins(e.plan)}
                            </td>
                            <td style={{ padding: '12px', textAlign: 'center', fontFamily: 'monospace', fontWeight: '700', color: '#1e293b' }}>
                              {fmtMins(e.act)}
                            </td>
                            <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end' }}>
                                <span style={{ fontFamily: 'monospace', fontWeight: '800', color: '#475569', fontSize: '12px' }}>
                                  {sharePct}%
                                </span>
                                <div style={{ width: '80px', height: '6px', background: '#f1f5f9', borderRadius: '999px', overflow: 'hidden' }}>
                                  <div style={{ width: `${Math.min(sharePct, 100)}%`, height: '100%', background: progressColor, borderRadius: '999px' }} />
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
          </div>
        </div>
      )}
    </div>
  );
}
