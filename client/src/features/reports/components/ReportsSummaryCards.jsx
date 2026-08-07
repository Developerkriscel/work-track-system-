import { BarChart3 } from '@/components/common/icons';

export function ReportsSummaryCards({ items }) {
  return (
    <div className="dashboard-kpi-grid reports-kpi-grid">
      {items.map((item) => (
        <article key={item.label} className="dashboard-kpi-card">
          <div className={`dashboard-kpi-card__icon ${item.iconClass || 'dashboard-kpi-card__icon--purple'}`}>
            <BarChart3 className="dashboard-kpi-card__icon-svg" />
          </div>
          <div className="dashboard-kpi-card-content">
            <p className="dashboard-kpi-card__label">{item.label}</p>
            <p className="dashboard-kpi-card__value">{item.value}</p>
          </div>
        </article>
      ))}
    </div>
  );
}
