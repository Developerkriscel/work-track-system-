import { ShieldUser, Users } from '@/components/common/icons';

export function ClientsPortalSummaryCards({ visibleCount, totalCount, isAdmin }) {
  return (
    <div className="dashboard-kpi-grid approvals-kpi-grid">
      <article className="dashboard-kpi-card">
        <div className="dashboard-kpi-card__icon dashboard-kpi-card__icon--green">
          <Users className="dashboard-kpi-card__icon-svg" />
        </div>
        <div className="dashboard-kpi-card-content">
          <p className="dashboard-kpi-card__label">Visible Clients</p>
          <p className="dashboard-kpi-card__value">{visibleCount}</p>
        </div>
      </article>
      <article className="dashboard-kpi-card">
        <div className="dashboard-kpi-card__icon dashboard-kpi-card__icon--blue">
          <ShieldUser className="dashboard-kpi-card__icon-svg" />
        </div>
        <div className="dashboard-kpi-card-content">
          <p className="dashboard-kpi-card__label">Access Mode</p>
          <p className="dashboard-kpi-card__value forms-kpi-text">{isAdmin ? 'Admin' : 'View'}</p>
        </div>
      </article>
      <article className="dashboard-kpi-card">
        <div className="dashboard-kpi-card__icon dashboard-kpi-card__icon--teal">
          <Users className="dashboard-kpi-card__icon-svg" />
        </div>
        <div className="dashboard-kpi-card-content">
          <p className="dashboard-kpi-card__label">Total Records</p>
          <p className="dashboard-kpi-card__value">{totalCount}</p>
        </div>
      </article>
    </div>
  );
}
