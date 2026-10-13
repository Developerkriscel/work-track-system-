import React, { useMemo, useState } from 'react';
import { StatusPill } from '@/components/common/StatusPill';
import { managementStatusTone } from '@/features/management-dashboard/services/managementDashboardPresentation';

function parseDurationMins(durationStr) {
  if (!durationStr) return 0;
  const str = String(durationStr).toLowerCase().trim();
  let mins = 0;
  const hMatch = str.match(/(\d+)\s*h/);
  const mMatch = str.match(/(\d+)\s*m/);
  if (hMatch) mins += parseInt(hMatch[1], 10) * 60;
  if (mMatch) mins += parseInt(mMatch[1], 10);
  return mins;
}

function formatMins(mins) {
  if (isNaN(mins)) return '0h 0m';
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return `${h}h ${m}m`;
}

export function ClientEffortDrillDown({ tickets = [], fms = [] }) {
  const [expandedUser, setExpandedUser] = useState(null);
  const [expandedClient, setExpandedClient] = useState(null);

  const reportData = useMemo(() => {
    const userMap = {};
    const processTask = (t, type) => {
      const u = t.User || 'Unassigned';
      let c = t.Client || 'Internal / General';
      
      let planMins = 0;
      if (t.TAT !== undefined && t.TAT !== null) {
        planMins = parseInt(t.TAT, 10);
        if (isNaN(planMins)) planMins = 0;
      }
      
      const actMins = parseDurationMins(t.Duration);
      
      const status = String(t.Status || '').toLowerCase();
      const isComp = status.includes('complete') || status.includes('close') || status.includes('approve');
      
      if (!userMap[u]) {
        userMap[u] = {
          name: u,
          planMins: 0,
          compPlanMins: 0,
          compMins: 0,
          pendMins: 0,
          breakdown: {}
        };
      }
      
      userMap[u].planMins += planMins;
      if (isComp) {
        userMap[u].compMins += actMins;
        userMap[u].compPlanMins += planMins;
      } else {
        userMap[u].pendMins += planMins;
      }
      
      let isFMS = (type === 'FMS' || c.toLowerCase().includes('fms'));
      let displayClientName = c;
      if (isFMS) {
        const cleanFmsName = c.replace(/fms/gi, '').trim() + ' FMS';
        displayClientName = `Kriscel Tech Private Limited (${cleanFmsName})`;
      }
      
      if (!userMap[u].breakdown[displayClientName]) {
        userMap[u].breakdown[displayClientName] = {
          clientName: displayClientName,
          planMins: 0,
          compPlanMins: 0,
          compMins: 0,
          pendMins: 0,
          isFMS: isFMS,
          tasks: []
        };
      }
      
      userMap[u].breakdown[displayClientName].planMins += planMins;
      if (isComp) {
        userMap[u].breakdown[displayClientName].compMins += actMins;
        userMap[u].breakdown[displayClientName].compPlanMins += planMins;
      } else {
        userMap[u].breakdown[displayClientName].pendMins += planMins;
      }
      
      userMap[u].breakdown[displayClientName].tasks.push({
        ...t,
        actMins,
        planMins
      });
    };
    
    tickets.forEach(t => processTask(t, 'Ticket'));
    fms.forEach(t => processTask(t, 'FMS'));
    
    return Object.values(userMap).sort((a, b) => b.planMins - a.planMins);
  }, [tickets, fms]);

  const toggleUser = (u) => {
    setExpandedUser(expandedUser === u ? null : u);
    setExpandedClient(null);
  };
  
  const toggleClient = (c, e) => {
    e.stopPropagation();
    setExpandedClient(expandedClient === c ? null : c);
  };

  return (
    <article className="migration-panel migration-panel--full mt-6">
      <div className="migration-panel__row">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ background: '#e0e7ff', color: '#4f46e5', padding: '8px', borderRadius: '8px' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg>
          </div>
          <h2 style={{ color: '#1e293b', fontSize: '16px', fontWeight: '700' }}>Client Effort Drill Down</h2>
        </div>
      </div>
      <div className="dashboard-table-wrap" style={{ overflow: 'visible' }}>
        <table className="dashboard-table approval-table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th style={{ width: '40px' }}></th>
              <th>Employee Name</th>
              <th>Total Planned</th>
              <th>Total Completed Logged</th>
              <th>Total Pending TAT</th>
              <th style={{ textAlign: 'right' }}>Difference</th>
            </tr>
          </thead>
          <tbody>
            {reportData.length === 0 ? (
              <tr>
                <td colSpan="6" className="dashboard-table__empty" style={{ padding: '24px' }}>No active work hours recorded.</td>
              </tr>
            ) : reportData.map((user, uIdx) => {
              const diff = user.compPlanMins - user.compMins;
              let diffStr = '';
              let diffStyle = {};
              if (diff < 0) {
                diffStr = `-${formatMins(Math.abs(diff))} Over`;
                diffStyle = { color: '#ef4444', fontWeight: 'bold' };
              } else if (diff > 0) {
                diffStr = `+${formatMins(diff)} Saved`;
                diffStyle = { color: '#10b981', fontWeight: 'bold' };
              } else {
                diffStr = '0h 0m';
                diffStyle = { color: '#94a3b8' };
              }
              const isExpanded = expandedUser === user.name;
              
              return (
                <React.Fragment key={user.name}>
                  <tr onClick={() => toggleUser(user.name)} style={{ cursor: 'pointer', backgroundColor: isExpanded ? '#f8fafc' : 'white' }}>
                    <td style={{ textAlign: 'center', color: '#94a3b8' }}>
                      <span style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', display: 'inline-block', transition: 'transform 0.2s' }}>▶</span>
                    </td>
                    <td style={{ fontWeight: '700', color: '#1e293b' }}>{user.name}</td>
                    <td style={{ fontFamily: 'monospace', fontWeight: 'bold', color: '#2563eb' }}>{formatMins(user.planMins)}</td>
                    <td style={{ fontFamily: 'monospace', fontWeight: 'bold', color: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.1)' }}>{formatMins(user.compMins)}</td>
                    <td style={{ fontFamily: 'monospace', fontWeight: 'bold', color: '#f43f5e', backgroundColor: 'rgba(244, 63, 94, 0.1)' }}>{formatMins(user.pendMins)}</td>
                    <td style={{ fontFamily: 'monospace', textAlign: 'right', ...diffStyle }}>{diffStr}</td>
                  </tr>
                  
                  {isExpanded && (
                    <tr>
                      <td colSpan="6" style={{ padding: 0, backgroundColor: '#f1f5f9' }}>
                        <div style={{ padding: '16px', margin: '12px', backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)' }}>
                          <div style={{ fontSize: '10px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px' }}>Client / Project Breakdown</div>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                            <thead>
                              <tr style={{ borderBottom: '1px solid #e2e8f0', color: '#94a3b8', textTransform: 'uppercase', fontSize: '10px' }}>
                                <th style={{ padding: '8px', textAlign: 'left' }}>Client Name</th>
                                <th style={{ padding: '8px', textAlign: 'center' }}>Type</th>
                                <th style={{ padding: '8px', textAlign: 'center' }}>Planned</th>
                                <th style={{ padding: '8px', textAlign: 'center' }}>Logged (Completed)</th>
                                <th style={{ padding: '8px', textAlign: 'center' }}>Pending (Remaining)</th>
                                <th style={{ padding: '8px', textAlign: 'right' }}>Difference</th>
                              </tr>
                            </thead>
                            <tbody>
                              {Object.values(user.breakdown).sort((a, b) => b.planMins - a.planMins).map((b, cIdx) => {
                                const clientDiff = b.compPlanMins - b.compMins;
                                let cDiffStr = '';
                                let cDiffStyle = {};
                                if (clientDiff < 0) {
                                  cDiffStr = `-${formatMins(Math.abs(clientDiff))} Over`;
                                  cDiffStyle = { color: '#ef4444', fontWeight: 'bold' };
                                } else if (clientDiff > 0) {
                                  cDiffStr = `+${formatMins(clientDiff)} Saved`;
                                  cDiffStyle = { color: '#10b981', fontWeight: 'bold' };
                                } else {
                                  cDiffStr = '0h 0m';
                                  cDiffStyle = { color: '#94a3b8' };
                                }
                                
                                const isCExpanded = expandedClient === b.clientName;
                                return (
                                  <React.Fragment key={b.clientName}>
                                    <tr onClick={(e) => toggleClient(b.clientName, e)} style={{ cursor: 'pointer', borderBottom: '1px solid #f1f5f9' }}>
                                      <td style={{ padding: '8px', fontWeight: '700', color: '#334155' }}>
                                        <span style={{ transform: isCExpanded ? 'rotate(90deg)' : 'rotate(0deg)', display: 'inline-block', transition: 'transform 0.2s', marginRight: '6px', color: '#94a3b8' }}>▶</span>
                                        {b.clientName}
                                      </td>
                                      <td style={{ padding: '8px', textAlign: 'center' }}>
                                        <span style={{ padding: '2px 6px', borderRadius: '4px', fontSize: '9px', fontWeight: 'bold', backgroundColor: b.isFMS ? '#ccfbf1' : '#dbeafe', color: b.isFMS ? '#0f766e' : '#1d4ed8' }}>
                                          {b.isFMS ? 'FMS' : 'TICKET'}
                                        </span>
                                      </td>
                                      <td style={{ padding: '8px', textAlign: 'center', fontFamily: 'monospace', color: '#64748b', fontWeight: '600' }}>{formatMins(b.planMins)}</td>
                                      <td style={{ padding: '8px', textAlign: 'center', fontFamily: 'monospace', color: '#10b981', fontWeight: 'bold', backgroundColor: 'rgba(16, 185, 129, 0.05)' }}>{formatMins(b.compMins)}</td>
                                      <td style={{ padding: '8px', textAlign: 'center', fontFamily: 'monospace', color: '#f43f5e', fontWeight: 'bold', backgroundColor: 'rgba(244, 63, 94, 0.05)' }}>{formatMins(b.pendMins)}</td>
                                      <td style={{ padding: '8px', textAlign: 'right', fontFamily: 'monospace', ...cDiffStyle }}>{cDiffStr}</td>
                                    </tr>
                                    
                                    {isCExpanded && (
                                      <tr>
                                        <td colSpan="6" style={{ padding: 0 }}>
                                          <div style={{ padding: '8px 12px', backgroundColor: '#f8fafc', borderLeft: '2px solid #6366f1' }}>
                                            <div style={{ fontSize: '9px', fontWeight: 'bold', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>Task / Step Details</div>
                                            <table style={{ width: '100%', fontSize: '11px', textAlign: 'left' }}>
                                              <thead>
                                                <tr style={{ color: '#94a3b8', borderBottom: '1px solid #e2e8f0', fontSize: '9px', textTransform: 'uppercase' }}>
                                                  <th style={{ paddingBottom: '4px' }}>Planned Date</th>
                                                  <th style={{ paddingBottom: '4px' }}>Task Detail / Step Name</th>
                                                  <th style={{ paddingBottom: '4px', textAlign: 'center' }}>Plan TAT</th>
                                                  <th style={{ paddingBottom: '4px', textAlign: 'center' }}>Actual</th>
                                                  <th style={{ paddingBottom: '4px', textAlign: 'right' }}>Status</th>
                                                </tr>
                                              </thead>
                                              <tbody>
                                                {b.tasks.sort((tA, tB) => {
                                                  const isPendingA = !String(tA.Status || '').toLowerCase().includes('complete') && !String(tA.Status || '').toLowerCase().includes('close');
                                                  const isPendingB = !String(tB.Status || '').toLowerCase().includes('complete') && !String(tB.Status || '').toLowerCase().includes('close');
                                                  if (isPendingA !== isPendingB) return isPendingB - isPendingA;
                                                  return (tB.Date || '').localeCompare(tA.Date || '');
                                                }).map((t, idx) => {
                                                  const isPending = !String(t.Status || '').toLowerCase().includes('complete') && !String(t.Status || '').toLowerCase().includes('close');
                                                  return (
                                                    <tr key={idx} style={{ borderBottom: '1px solid rgba(226, 232, 240, 0.5)' }}>
                                                      <td style={{ padding: '4px 0', color: '#64748b' }}>{t.Date || 'No Date'}</td>
                                                      <td style={{ padding: '4px 0', color: '#334155' }}>
                                                        {t.Step ? <span style={{ backgroundColor: '#f1f5f9', padding: '2px 4px', borderRadius: '4px', fontSize: '9px', marginRight: '4px' }}>Step {t.Step}</span> : null}
                                                        {t.Desc || t.Description || '-'}
                                                      </td>
                                                      <td style={{ padding: '4px 0', textAlign: 'center', fontFamily: 'monospace', color: '#2563eb', fontWeight: 'bold' }}>{formatMins(t.planMins)}</td>
                                                      <td style={{ padding: '4px 0', textAlign: 'center', fontFamily: 'monospace', color: '#64748b' }}>{t.Duration || '0h 0m'}</td>
                                                      <td style={{ padding: '4px 0', textAlign: 'right' }}>
                                                        <StatusPill tone={managementStatusTone(t.Status)}>{t.Status || 'Pending'}</StatusPill>
                                                      </td>
                                                    </tr>
                                                  );
                                                })}
                                              </tbody>
                                            </table>
                                          </div>
                                        </td>
                                      </tr>
                                    )}
                                  </React.Fragment>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </article>
  );
}
