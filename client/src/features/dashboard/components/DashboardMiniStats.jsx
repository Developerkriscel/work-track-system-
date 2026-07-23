export function DashboardMiniStats({ kpis = {} }) {
  return (
    <div className="dashboard-mini-grid">
      <article className="dashboard-mini-card dashboard-mini-card--warn">
        <div>
          <span className="dashboard-mini-card__label">Idle Gap Time</span>
          <strong className="dashboard-mini-card__value">{kpis.totalGapTime || '0h 0m'}</strong>
        </div>
      </article>
      <article className="dashboard-mini-card dashboard-mini-card--success">
        <div>
          <span className="dashboard-mini-card__label">Productive Time</span>
          <strong className="dashboard-mini-card__value">{kpis.actualBandwidthHours || '0h 0m'}</strong>
        </div>
      </article>
    </div>
  );
}
