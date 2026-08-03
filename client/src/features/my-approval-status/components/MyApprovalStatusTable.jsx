import { StatusPill } from '@/components/common/StatusPill';

function toneForRow(row) {
  if (row.tone) return row.tone;
  const status = String(row.Status || '').toLowerCase();
  if (/(approved|closed|hr approved)/i.test(status)) return 'success';
  if (/(rejected|rework)/i.test(status)) return 'danger';
  if (/(pending|submitted|need approval|waiting)/i.test(status)) return 'warning';
  return 'info';
}

export function MyApprovalStatusTable({ rows, loading }) {
  return (
    <article className="migration-panel migration-panel--full">
      <div className="migration-panel__row">
        <h2>Approval History</h2>
        <StatusPill tone="info">{rows.length} records</StatusPill>
      </div>

      <div className="dashboard-table-wrap">
        <table className="dashboard-table approval-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Category / SubType</th>
              <th>Date(s)</th>
              <th>Details / Reason</th>
              <th>Status</th>
              <th>Admin Remarks</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="6" className="dashboard-table__empty">Loading approval history...</td>
              </tr>
            ) : rows.length ? (
              rows.map((row) => (
                <tr key={row.id}>
                  <td data-label="Type">
                    <span className={`my-approval-status__type-chip my-approval-status__type-chip--${String(row.Type || '').toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'default'}`}>
                      {row.Type || '-'}
                    </span>
                  </td>
                  <td data-label="Category / SubType" className="my-approval-status__subtype">{row.SubType || '-'}</td>
                  <td data-label="Date(s)" className="my-approval-status__date">{row.Date || '-'}</td>
                  <td data-label="Details / Reason" className="my-approval-status__reason">{row.Reason || '-'}</td>
                  <td data-label="Status">
                    <StatusPill tone={toneForRow(row)}>{row.Status || '-'}</StatusPill>
                  </td>
                  <td data-label="Admin Remarks">
                    {row.Remarks && row.Remarks !== '-' ? (
                      <div className="my-approval-status__remarks">{row.Remarks}</div>
                    ) : (
                      <span className="my-approval-status__empty-remarks">No Remarks</span>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="6" className="dashboard-table__empty">No approval status records found for the current filter.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </article>
  );
}
