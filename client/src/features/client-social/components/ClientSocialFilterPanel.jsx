export function ClientSocialFilterPanel({
  filters,
  platformOptions,
  statusOptions,
  onUpdateFilters,
  onResetFilters
}) {
  return (
    <article className="migration-panel migration-panel--full">
      <div className="migration-panel__row">
        <h2>Filters</h2>
        <button type="button" className="attendance-cta attendance-cta--gray" onClick={onResetFilters}>
          Reset
        </button>
      </div>

      <div className="ticket-filter-grid">
        <label className="dashboard-control">
          <span>Platform</span>
          <select value={filters.platform} onChange={(event) => onUpdateFilters({ platform: event.target.value })}>
            <option value="">All Platforms</option>
            {platformOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label className="dashboard-control">
          <span>Status</span>
          <select value={filters.status} onChange={(event) => onUpdateFilters({ status: event.target.value })}>
            <option value="">All Statuses</option>
            {statusOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      </div>
    </article>
  );
}
