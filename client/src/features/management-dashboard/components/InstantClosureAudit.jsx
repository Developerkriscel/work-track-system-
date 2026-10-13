import React from 'react';
import { StatusPill } from '@/components/common/StatusPill';

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

export function InstantClosureAudit({ tickets = [] }) {
  const flagged = tickets.filter(t => {
    const status = String(t.Status || '').toLowerCase();
    const isCompleted = status.includes('complete') || status.includes('close');
    if (!isCompleted) return false;
    
    const mins = parseDurationMins(t.Duration);
    return mins > 0 && mins < 15;
  });

  return (
    <article className="migration-panel migration-panel--full mt-6">
      <div className="migration-panel__row">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ background: '#fee2e2', color: '#ef4444', padding: '8px', borderRadius: '8px' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
          </div>
          <h2 style={{ color: '#1e293b', fontSize: '16px', fontWeight: '700' }}>Instant Closure Audit ({"< 15 mins"})</h2>
        </div>
        <StatusPill tone="danger">{flagged.length} alerts</StatusPill>
      </div>
      <div className="dashboard-table-wrap">
        <table className="dashboard-table approval-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Description</th>
              <th>Client</th>
              <th>Date</th>
              <th>Plan TAT</th>
              <th>Actual Logged</th>
            </tr>
          </thead>
          <tbody>
            {flagged.length ? flagged.map((t, index) => (
              <tr key={`audit-${t.ID || index}`} style={{ backgroundColor: 'rgba(254, 226, 226, 0.2)' }}>
                <td data-label="User" style={{ fontWeight: '700', color: '#334155' }}>{t.User || '-'}</td>
                <td data-label="Description" className="approval-table__copy">{t.Desc || t.Description || '-'}</td>
                <td data-label="Client">{t.Client || '-'}</td>
                <td data-label="Date">{t.Date || '-'}</td>
                <td data-label="Plan TAT" style={{ fontWeight: '700', fontFamily: 'monospace', color: '#2563eb' }}>
                  {t.TAT !== undefined ? formatMins(t.TAT) : '-'}
                </td>
                <td data-label="Actual Logged" style={{ fontWeight: '700', fontFamily: 'monospace', color: '#dc2626', textAlign: 'right' }}>
                  {t.Duration || '-'}
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan="6" className="dashboard-table__empty" style={{ padding: '24px', color: '#94a3b8' }}>
                  No instant closure flags detected.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </article>
  );
}
