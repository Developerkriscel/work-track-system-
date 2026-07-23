function activityTone(item) {
  const status = String(item.status || item.Status || '').toLowerCase();
  if (status.includes('closed') || status.includes('approve')) return 'closed';
  if (status.includes('progress')) return 'progress';
  if (status.includes('open') || status.includes('reopen')) return 'open';
  return 'default';
}

export function ClientDashboardRecentActivity({ formatDate, items = [] }) {
  return (
    <article className="migration-panel client-dashboard-panel">
      <div className="migration-panel__row">
        <h2>Recent Activity</h2>
      </div>

      <div className="client-dashboard-activity-list">
        {items.length ? (
          items.map((item) => (
            <div key={`${item.type}-${item.id}`} className={`client-dashboard-activity client-dashboard-activity--${activityTone(item)}`}>
              <div className="client-dashboard-activity__dot" />
              <div>
                <p className="client-dashboard-activity__message">{item.message || '-'}</p>
                <p className="client-dashboard-activity__date">{formatDate(item.timestamp)}</p>
              </div>
            </div>
          ))
        ) : (
          <div className="dashboard-table__empty">No recent activity found.</div>
        )}
      </div>
    </article>
  );
}
