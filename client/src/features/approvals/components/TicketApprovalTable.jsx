import { useEffect, useMemo, useState } from 'react';
import { StatusPill } from '@/components/common/StatusPill';
import { formatApprovalDate, toneForApprovalStatus } from '@/features/approvals/services/approvalsPresentation';

function usePagedRows(rows = [], pageSize = 20) {
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  useEffect(() => {
    setPage(1);
  }, [rows, pageSize]);
  const safePage = Math.min(page, pageCount);
  const pageRows = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return rows.slice(start, start + pageSize);
  }, [pageSize, rows, safePage]);
  return { page: safePage, pageCount, pageRows, setPage };
}

function ApprovalPager({ page, pageCount, total, onPageChange }) {
  if (total <= 20) return null;
  const first = total ? (page - 1) * 20 + 1 : 0;
  const last = Math.min(page * 20, total);
  return (
    <div className="react-data-table__footer">
      <span className="react-data-table__info">Showing {first} to {last} of {total} entries</span>
      <div className="react-data-table__pager">
        <button type="button" disabled={page <= 1} onClick={() => onPageChange(1)} aria-label="First page">«</button>
        <button type="button" disabled={page <= 1} onClick={() => onPageChange(Math.max(1, page - 1))} aria-label="Previous page">‹</button>
        <span className="react-data-table__pager-current">{page}</span>
        <button type="button" disabled={page >= pageCount} onClick={() => onPageChange(Math.min(pageCount, page + 1))} aria-label="Next page">›</button>
        <button type="button" disabled={page >= pageCount} onClick={() => onPageChange(pageCount)} aria-label="Last page">»</button>
      </div>
    </div>
  );
}

function TicketActions({ row, approvers, submitting, onRequestAction }) {
  if (!row._isActionableByMe) {
    return <span className="ticket-action-state ticket-action-state--pending">View only</span>;
  }
  const transferCandidates = approvers.filter((approver) => approver.id !== row['Task Approver']);

  return (
    <div className="approval-action-stack">
      <button
        type="button"
        className="ticket-action-btn ticket-action-btn--done"
        disabled={submitting}
        onClick={() => onRequestAction({ kind: 'ticket-approve', ticketId: row['Ticket ID'] })}
      >
        Approve
      </button>
      <button
        type="button"
        className="ticket-action-btn ticket-action-btn--pause"
        disabled={submitting}
        onClick={() => onRequestAction({ kind: 'ticket-rework', ticketId: row['Ticket ID'] })}
      >
        Rework
      </button>
      {transferCandidates.length ? (
        <button
          type="button"
          className="ticket-action-btn ticket-action-btn--schedule"
          disabled={submitting}
          onClick={() => onRequestAction({ kind: 'ticket-transfer', ticketId: row['Ticket ID'] })}
        >
          Transfer
        </button>
      ) : null}
    </div>
  );
}

export function TicketApprovalTable({ rows, approvers, submitting, onRequestAction }) {
  const { page, pageCount, pageRows, setPage } = usePagedRows(rows, 20);
  return (
    <>
      <div className="dashboard-table-wrap">
        <table className="dashboard-table approval-table">
          <thead>
            <tr>
              <th>Ticket & User</th>
              <th>Task Details</th>
              <th>Schedule</th>
              <th>Status & Remarks</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              pageRows.map((row) => (
              <tr key={row['Ticket ID']}>
                <td data-label="Ticket & User">
                  <div className="approval-user-cell">
                    <span className="ticket-id-chip">{row['Ticket ID']}</span>
                    <strong>{row['Employee Name'] || row['Employee ID'] || '-'}</strong>
                    <span style={{ fontSize: '0.85em', color: 'var(--text-secondary)' }}>
                      {row.Name || row['Client Name'] || row['Client ID'] || '-'}
                    </span>
                  </div>
                </td>
                <td data-label="Task Details">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <span style={{ fontSize: '0.8em', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-primary)' }}>
                      <strong>{row['Task Category'] || row.Category || 'General'}</strong>
                    </span>
                    <span className="approval-table__copy" style={{ maxWidth: '250px' }}>
                      {row['Task Description'] || row.Description || '-'}
                    </span>
                  </div>
                </td>
                <td data-label="Schedule">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.9em' }}>
                    <span><strong>{formatApprovalDate(row['Plan Date'])}</strong></span>
                    <span style={{ color: 'var(--text-secondary)' }}>{row['Start Time'] || '-'} to {row['End Time'] || '-'}</span>
                    <span style={{ color: 'var(--text-secondary)' }}>TAT: {row.TAT || row.When || '-'}</span>
                  </div>
                </td>
                <td data-label="Status & Remarks">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div>
                      <StatusPill tone={toneForApprovalStatus(row.Status)}>{row.Status || 'Pending Approval'}</StatusPill>
                    </div>
                    {row.Remarks && row.Remarks !== '-' && (
                      <span className="approval-table__copy" style={{ maxWidth: '250px', fontSize: '0.85em' }}>
                        {row.Remarks}
                      </span>
                    )}
                  </div>
                </td>
                <td data-label="Action">
                  <TicketActions
                    row={row}
                    approvers={approvers}
                    submitting={submitting}
                    onRequestAction={onRequestAction}
                  />
                </td>
              </tr>
              ))
            ) : (
              <tr>
                <td colSpan="5" className="dashboard-table__empty">No ticket approvals found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <ApprovalPager page={page} pageCount={pageCount} total={rows.length} onPageChange={setPage} />
    </>
  );
}
