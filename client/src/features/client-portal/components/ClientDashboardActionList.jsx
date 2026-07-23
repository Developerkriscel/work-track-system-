function iconForAction(item) {
  const type = String(item.type || item.taskType || '').toLowerCase();
  if (type.includes('approve')) return 'double';
  if (type.includes('feedback')) return 'feedback';
  if (type.includes('respond')) return 'respond';
  return 'default';
}

export function ClientDashboardActionList({ items = [] }) {
  return (
    <article className="migration-panel client-dashboard-panel">
      <div className="migration-panel__row">
        <h2>Pending Your Action</h2>
      </div>

      <div className="client-dashboard-list">
        {items.length ? (
          items.map((item) => (
            <div key={`${item.taskType || item.type}-${item.id}`} className="client-dashboard-list__item">
              <div className={`client-dashboard-list__icon client-dashboard-list__icon--${iconForAction(item)}`} />
              <div className="client-dashboard-list__body">
                <p className="client-dashboard-list__title">{item.type || item.taskType || '-'}</p>
                <p className="client-dashboard-list__copy">{String(item.description || '-').slice(0, 40)}...</p>
              </div>
              <span className="client-dashboard-list__cta">View →</span>
            </div>
          ))
        ) : (
          <div className="dashboard-table__empty">No pending actions. You are all caught up!</div>
        )}
      </div>
    </article>
  );
}
