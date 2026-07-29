import { StatusPill } from '@/components/common/StatusPill';
import {
  canApproveClientSocial,
  canRequestChangesClientSocial,
  clientSocialStatusTone,
  formatClientSocialDate
} from '@/features/client-social/services/clientSocialPresentation';

export function ClientSocialTable({ rows = [], submitting, onOpenDetails, onApprove, onFeedback }) {
  return (
    <article className="migration-panel migration-panel--full">
      <div className="migration-panel__row">
        <h2>My Social Media Tasks</h2>
        <StatusPill tone="info">{rows.length} items</StatusPill>
      </div>

      <div className="dashboard-table-wrap">
        <table className="dashboard-table approval-table">
          <thead>
            <tr>
              <th>Post ID</th>
              <th>Platform</th>
              <th>Content Type</th>
              <th>Description</th>
              <th>Planned Date</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((row) => (
                <tr key={row['Post ID'] || row.ID}>
                  <td><span className="ticket-id-chip">{row['Post ID'] || row.ID || '-'}</span></td>
                  <td>{row.Platform || '-'}</td>
                  <td>{row['Content Type'] || '-'}</td>
                  <td className="approval-table__copy">{row.Description || '-'}</td>
                  <td>{formatClientSocialDate(row['Planned Post Date'] || row.Date)}</td>
                  <td><StatusPill tone={clientSocialStatusTone(row.Status)}>{row.Status || '-'}</StatusPill></td>
                  <td>
                    <div className="ticket-actions">
                      <button type="button" className="attendance-cta attendance-cta--gray" onClick={() => onOpenDetails(row)}>
                        Details
                      </button>
                      {canApproveClientSocial(row.Status) ? (
                        <button type="button" className="attendance-cta attendance-cta--green" disabled={submitting} onClick={() => onApprove(row)}>
                          Approve
                        </button>
                      ) : null}
                      {canRequestChangesClientSocial(row.Status) ? (
                        <button type="button" className="attendance-cta attendance-cta--red" disabled={submitting} onClick={() => onFeedback(row)}>
                          Request Changes
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="7" className="dashboard-table__empty">No social tasks found for the current client and filters.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </article>
  );
}
