import { BarChart3 } from '@/components/common/icons';

export function ClientPortalSummaryGrid({ items = [] }) {
  return (
    <div className="dashboard-kpi-grid approvals-kpi-grid">
      {items.map((item) => {
        const Icon = item.Icon || BarChart3;
        return (
          <article key={item.label} className="dashboard-kpi-card">
            <div className={`dashboard-kpi-card__icon dashboard-kpi-card__icon--${item.tone || 'purple'}`}>
              <Icon className="dashboard-kpi-card__icon-svg" />
            </div>
            <p className="dashboard-kpi-card__label">{item.label}</p>
            <p className="dashboard-kpi-card__value">{item.value}</p>
          </article>
        );
      })}
    </div>
  );
}
