import { RefreshCw } from '@/components/common/icons';

export function AdminHeader({ employeeId, onEmployeeIdChange, activeTab, onRefresh, onAdd }) {
  return (
    <div className="page-card__header">
      <div>
        <p className="page-card__eyebrow">Users Workspace</p>
        <h1 className="page-card__title">User Management</h1>
      </div>

      <div className="dashboard-controls">
        <label className="dashboard-control">
          <span>User Admin ID</span>
          <input value={employeeId} onChange={(event) => onEmployeeIdChange(event.target.value)} placeholder="e.g. MS101" />
        </label>
        <button type="button" className="attendance-cta attendance-cta--blue approvals-refresh-btn" onClick={onRefresh}>
          <RefreshCw className="approvals-refresh-btn__icon" />
          Refresh
        </button>
        <button
          type="button"
          className="attendance-cta attendance-cta--purple"
          onClick={() => onAdd(activeTab === 'users' ? 'users' : 'empMaster')}
        >
          Add New {activeTab === 'users' ? 'User' : 'Employee'}
        </button>
      </div>
    </div>
  );
}
