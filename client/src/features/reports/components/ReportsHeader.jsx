import { RefreshCw } from '@/components/common/icons';

export function ReportsHeader({ employeeLabel, role, onRefresh }) {
  return (
    <div className="page-card__header">
      <div>
        <p className="page-card__eyebrow">Reporting Workspace</p>
        <h1 className="page-card__title">Activity Reports</h1>
      </div>

      <div className="dashboard-controls">
        <div className="page-card__status">{employeeLabel}</div>
        <div className="page-card__status">{role}</div>
        <button type="button" className="attendance-cta attendance-cta--blue approvals-refresh-btn" onClick={onRefresh}>
          <RefreshCw className="approvals-refresh-btn__icon" />
          Refresh
        </button>
      </div>
    </div>
  );
}
