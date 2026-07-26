import { RefreshCw } from '@/components/common/icons';

export function MyApprovalStatusHeader({ employeeLabel, onRefresh }) {
  return (
    <div className="page-card__header">
      <div>
        <div className="page-card__eyebrow">Request Tracking</div>
        <h1 className="page-card__title my-approval-status__title">My Approval Status</h1>
      </div>
      <div className="attendance-action-row">
        {employeeLabel ? <span className="page-card__status">{employeeLabel}</span> : null}
        <button type="button" className="attendance-cta attendance-cta--blue approvals-refresh-btn" onClick={onRefresh}>
          <RefreshCw className="approvals-refresh-btn__icon" />
          Refresh
        </button>
      </div>
    </div>
  );
}
