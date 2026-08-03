import { StatusPill } from '@/components/common/StatusPill';
import { formatApprovalDate, toneForApprovalStatus } from '@/features/approvals/services/approvalsPresentation';

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
  return (
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
            rows.map((row) => (
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
  );
}

