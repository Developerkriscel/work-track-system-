import { FileText, RefreshCw } from '@/components/common/icons';

export function FormsPortalHeader({ employeeLabel, isAdmin, onRefresh, onAddForm }) {
  return (
    <div className="page-card__header">
      <div>
        <p className="page-card__eyebrow">Assigned Forms</p>
        <h1 className="page-card__title">Forms Portal</h1>
      </div>

      <div className="dashboard-controls">
        <div className="page-card__status">{employeeLabel}</div>
        <button type="button" className="attendance-cta attendance-cta--blue approvals-refresh-btn" onClick={onRefresh}>
          <RefreshCw className="approvals-refresh-btn__icon" />
          Refresh
        </button>
        {isAdmin ? (
          <button type="button" className="attendance-cta attendance-cta--purple" onClick={onAddForm}>
            Add New Form
          </button>
        ) : null}
      </div>
    </div>
  );
}
