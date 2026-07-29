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
          <span>Date Range</span>
          <select value={filters.range} onChange={(event) => onUpdateFilters({ range: event.target.value })}>
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="custom">Custom Range</option>
          </select>
        </label>

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

        <label className="dashboard-control">
          <span>Search</span>
          <input
            value={filters.search}
            onChange={(event) => onUpdateFilters({ search: event.target.value })}
            placeholder="Post ID, platform, content, status..."
          />
        </label>

        {filters.range === 'custom' ? (
          <>
            <label className="dashboard-control">
              <span>Start Date</span>
              <input
                type="date"
                value={filters.customStart}
                onChange={(event) => onUpdateFilters({ customStart: event.target.value })}
              />
            </label>

            <label className="dashboard-control">
              <span>End Date</span>
              <input
                type="date"
                value={filters.customEnd}
                onChange={(event) => onUpdateFilters({ customEnd: event.target.value })}
              />
            </label>
          </>
        ) : null}
      </div>
    </article>
  );
}
