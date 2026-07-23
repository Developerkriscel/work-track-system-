import { StatusPill } from '@/components/common/StatusPill';
import { adminStatusTone } from '@/features/admin/services/adminPresentation';

export function AdminUsersTable({ rows, onEdit, count }) {
  return (
    <article className="migration-panel migration-panel--full">
      <div className="migration-panel__row">
        <h2>User Management Directory</h2>
        <StatusPill tone="info">{count} records</StatusPill>
      </div>

      <div className="dashboard-table-wrap">
        <table className="dashboard-table approval-table">
          <thead>
            <tr>
              <th>Employee ID</th>
              <th>Employee Name</th>
              <th>Role</th>
              <th>Status</th>
              <th>Manager ID</th>
              <th>Task Approver</th>
              <th>Department</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((row) => (
                <tr key={row['Employee ID']}>
                  <td><span className="ticket-id-chip">{row['Employee ID'] || '-'}</span></td>
                  <td>{row['Employee Name'] || '-'}</td>
                  <td>{row.Role || '-'}</td>
                  <td><StatusPill tone={adminStatusTone(row.Status)}>{row.Status || '-'}</StatusPill></td>
                  <td>{row['Manager ID'] || '-'}</td>
                  <td>{row['Task Approver'] || '-'}</td>
                  <td>{row.Department || '-'}</td>
                  <td>
                    <button type="button" className="attendance-cta attendance-cta--gray" onClick={() => onEdit(row)}>
                      Edit
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="8" className="dashboard-table__empty">No users found for the current filters.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </article>
  );
}
