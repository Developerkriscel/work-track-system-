export function ClientDashboardActivityChart({ data = { labels: [], data: [] } }) {
  const labels = data.labels || [];
  const values = data.data || [];
  const maxValue = Math.max(1, ...values.map((value) => Number(value || 0)));

  return (
    <article className="migration-panel client-dashboard-panel">
      <div className="migration-panel__row">
        <h2>Weekly Activity</h2>
      </div>

      {labels.length ? (
        <div className="spark-bars">
          {labels.map((label, index) => {
            const value = Number(values[index] || 0);
            const heightPercent = maxValue > 0 ? (value / maxValue) * 100 : 0;
            const height = `max(12px, ${heightPercent}%)`;
            return (
              <div key={`${label}-${index}`} className="spark-bars__item">
                <div className="spark-bars__bar-wrap">
                  <div className="spark-bars__bar" style={{ height }} />
                </div>
                <span>{label}</span>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="dashboard-table__empty">No activity data available.</div>
      )}
    </article>
  );
}
