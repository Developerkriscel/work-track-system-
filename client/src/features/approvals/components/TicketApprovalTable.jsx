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
            <th>ID</th>
            <th>User</th>
            <th>Client</th>
            <th>Category</th>
            <th>Description</th>
            <th>Plan Date</th>
            <th>Start</th>
            <th>End</th>
            <th>TAT</th>
            <th>Status</th>
            <th>Remarks</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((row) => (
              <tr key={row['Ticket ID']}>
                <td><span className="ticket-id-chip">{row['Ticket ID']}</span></td>
                <td>
                  <div className="approval-user-cell">
                    <strong>{row['Employee Name'] || row['Employee ID'] || '-'}</strong>
                    <span>{row['Employee ID'] || '-'}</span>
                  </div>
                </td>
                <td>{row.Name || row['Client Name'] || row['Client ID'] || '-'}</td>
                <td>{row['Task Category'] || row.Category || '-'}</td>
                <td className="approval-table__copy">{row['Task Description'] || row.Description || '-'}</td>
                <td>{formatApprovalDate(row['Plan Date'])}</td>
                <td>{row['Start Time'] || '-'}</td>
                <td>{row['End Time'] || '-'}</td>
                <td>{row.TAT || row.When || '-'}</td>
                <td><StatusPill tone={toneForApprovalStatus(row.Status)}>{row.Status || 'Pending Approval'}</StatusPill></td>
                <td className="approval-table__copy">{row.Remarks || '-'}</td>
                <td>
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
              <td colSpan="12" className="dashboard-table__empty">No ticket approvals found.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
