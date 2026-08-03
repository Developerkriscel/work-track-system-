import { RefreshCw } from '@/components/common/icons';

export function TodoHeader({ currentUser, employeeId, onRefresh }) {
  return (
    <div className="page-card__header">
      <div>
        <p className="page-card__eyebrow">Task Workspace</p>
        <h1 className="page-card__title">To-Do Manager</h1>
      </div>

      <div className="dashboard-controls mobile-header-controls">
        <div className="page-card__status">
          {(currentUser?.['Employee Name'] || currentUser?.Name || 'Employee')} {employeeId ? `| ${employeeId}` : ''}
        </div>
        <button type="button" className="attendance-cta attendance-cta--blue mobile-full-btn" onClick={onRefresh}>
          <RefreshCw className="approvals-refresh-btn__icon" />
          Refresh
        </button>
      </div>
    </div>
  );
}
