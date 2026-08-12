import { FileText, RefreshCw } from '@/components/common/icons';

export function FormsPortalHeader({
  eyebrow = 'Assigned Forms',
  title = 'Forms Portal',
  employeeLabel,
  isAdmin,
  onRefresh,
  onAddForm
}) {
  return (
    <div className="page-card__header">
      <div>
        <p className="page-card__eyebrow">{eyebrow}</p>
        <h1 className="page-card__title">{title}</h1>
      </div>

      <div className="dashboard-controls">
        {isAdmin ? (
          <button type="button" className="attendance-cta attendance-cta--purple" onClick={onAddForm}>
            Add New Form
          </button>
        ) : null}
      </div>
    </div>
  );
}
