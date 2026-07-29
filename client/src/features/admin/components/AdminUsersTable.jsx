import { StatusPill } from '@/components/common/StatusPill';
import { adminStatusTone } from '@/features/admin/services/adminPresentation';

const normalizeRole = (value) => String(value || '').trim().toLowerCase();

function canEditUserRow(actorRole, row) {
  const role = normalizeRole(actorRole);
  if (role === 'admin' || role === 'super admin') return true;
  const targetRole = normalizeRole(row?.Role);
  if (role === 'hr' && (targetRole === 'admin' || targetRole === 'super admin')) return false;
  return true;
}

export function AdminUsersTable({ rows, onView, onEdit, onDelete, count, currentRole, deletingId }) {
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
                    <div className="emp-master-actions">
                      <button type="button" className="attendance-cta attendance-cta--gray" onClick={() => onView(row)}>
                        View
                      </button>
                      {canEditUserRow(currentRole, row) ? (
                        <>
                          <button type="button" className="attendance-cta attendance-cta--blue" onClick={() => onEdit(row)}>
                            Edit
                          </button>
                          <button
                            type="button"
                            className="attendance-cta attendance-cta--red"
                            disabled={deletingId === row['Employee ID']}
                            onClick={() => onDelete(row)}
                          >
                            {deletingId === row['Employee ID'] ? 'Deleting...' : 'Delete'}
                          </button>
                        </>
                      ) : (
                        <span className="attendance-cta attendance-cta--gray cursor-not-allowed">View Only</span>
                      )}
                    </div>
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
