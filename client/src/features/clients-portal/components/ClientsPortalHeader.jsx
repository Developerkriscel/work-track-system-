import { RefreshCw } from '@/components/common/icons';

export function ClientsPortalHeader({ employeeLabel, onRefresh, showAddClient, onAddClient }) {
  return (
    <div className="page-card__header">
      <div>
        <p className="page-card__eyebrow">Client Records</p>
        <h1 className="page-card__title">Clients Portal</h1>
      </div>

      <div className="dashboard-controls">
        <div className="page-card__status">{employeeLabel}</div>
        {showAddClient ? (
          <button type="button" className="attendance-cta attendance-cta--green" onClick={onAddClient}>
            <span aria-hidden="true">+</span>
            Add Client
          </button>
        ) : null}
        <button type="button" className="attendance-cta attendance-cta--blue approvals-refresh-btn" onClick={onRefresh}>
          <RefreshCw className="approvals-refresh-btn__icon" />
          Refresh
        </button>
      </div>
    </div>
  );
}
