import { StatusPill } from '@/components/common/StatusPill';
import { formatManagementDate, managementStatusTone } from '@/features/management-dashboard/services/managementDashboardPresentation';

function UserTaskTable({ title, rows = [] }) {
  return (
    <article className="migration-panel">
      <div className="migration-panel__row">
        <h2>{title}</h2>
        <StatusPill tone="info">{rows.length} rows</StatusPill>
      </div>
      <div className="dashboard-table-wrap">
        <table className="dashboard-table approval-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Description</th>
              <th>Date</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? rows.slice(0, 8).map((row) => (
              <tr key={`${title}-${row.ID || row.AttendanceID || row.Date}`}>
                <td><span className="ticket-id-chip">{row.ID || row.AttendanceID || '-'}</span></td>
                <td className="approval-table__copy">{row.Description || row.Task || row.Action || '-'}</td>
                <td>{formatManagementDate(row.Date)}</td>
                <td><StatusPill tone={managementStatusTone(row.Status)}>{row.Status || '-'}</StatusPill></td>
              </tr>
            )) : (
              <tr>
                <td colSpan="4" className="dashboard-table__empty">No rows available.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </article>
  );
}

export function UserExplorerSection({ users, selectedUserId, onUserChange, selectedUser, explorer }) {
  return (
    <>
      <article className="migration-panel migration-panel--full">
        <div className="migration-panel__row">
          <h2>User Explorer</h2>
          <label className="dashboard-control">
            <span>Select User</span>
            <select value={selectedUserId} onChange={(event) => onUserChange(event.target.value)}>
              {users.map((user) => (
                <option key={user['Employee ID'] || user.id} value={user['Employee ID'] || user.id}>
                  {user['Employee Name'] || user.name} ({user['Employee ID'] || user.id})
                </option>
              ))}
            </select>
          </label>
        </div>
      </article>

      <div className="migration-grid">
        <UserTaskTable title="Attendance" rows={explorer.attendance} />
        <UserTaskTable title="Tickets" rows={explorer.tickets} />
      </div>

      <div className="migration-grid">
        <UserTaskTable title="FMS" rows={explorer.fms} />
        <UserTaskTable title="To-Do" rows={explorer.todo} />
      </div>
    </>
  );
}
