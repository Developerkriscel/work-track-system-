import { RefreshCw } from '@/components/common/icons';

export function ApprovalsHeader({ employeeLabel, onRefresh }) {
  return (
    <div className="page-card__header">
      <div>
        <p className="page-card__eyebrow">Approval Queue</p>
        <h1 className="page-card__title">Pending Approvals</h1>
      </div>

      <div className="dashboard-controls mobile-header-controls">
        <div className="page-card__status">{employeeLabel}</div>
        <button type="button" className="attendance-cta attendance-cta--blue mobile-full-btn approvals-refresh-btn" onClick={onRefresh}>
          <RefreshCw className="approvals-refresh-btn__icon" />
          Refresh
        </button>
      </div>
    </div>
  );
}
