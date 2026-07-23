export function ClientDashboardStatusPanel({ data = { labels: [], data: [] } }) {
  const labels = data.labels || [];
  const values = data.data || [];
  const total = values.reduce((sum, value) => sum + Number(value || 0), 0);

  return (
    <article className="migration-panel client-dashboard-panel">
      <div className="migration-panel__row">
        <h2>Tasks by Status</h2>
      </div>

      {total ? (
        <div className="client-dashboard-status">
          <div
            className="dashboard-donut__ring client-dashboard-status__donut"
            style={{
              background: `conic-gradient(#4f46e5 0 ${Math.max(20, (values[0] || 0) / total * 360)}deg, #22c55e 0 220deg, #f59e0b 0 300deg, #e5e7eb 0 360deg)`
            }}
          >
            <div className="dashboard-donut__inner">
              <strong>{total}</strong>
              <span>Items</span>
            </div>
          </div>

          <div className="breakdown-list">
            {labels.map((label, index) => {
              const value = Number(values[index] || 0);
              const percentage = total ? Math.max(6, (value / total) * 100) : 0;
              return (
                <div key={`${label}-${index}`}>
                  <div className="breakdown-list__meta">
                    <strong>{label}</strong>
                    <span>{value}</span>
                  </div>
                  <div className="breakdown-list__track">
                    <div className="breakdown-list__fill" style={{ width: `${percentage}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="dashboard-table__empty">No status data available.</div>
      )}
    </article>
  );
}
