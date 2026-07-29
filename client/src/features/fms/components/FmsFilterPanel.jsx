export function FmsFilterPanel({
  filters,
  employeeOptions,
  categoryOptions,
  onFilterChange,
  onReset,
  onRefresh
}) {
  return (
    <article className="migration-panel migration-panel--full">
      <div className="migration-panel__row">
        <h2>Filters</h2>
        <div className="ticket-actions">
          <button
            type="button"
            className="inline-action inline-action--ghost"
            onClick={onRefresh}
          >
            Refresh
          </button>
          <button
            type="button"
            className="inline-action inline-action--ghost"
            onClick={onReset}
          >
            Reset
          </button>
        </div>
      </div>
      <div className="ticket-filter-grid">
        {employeeOptions.length ? (
          <label className="dashboard-control">
            <span>Employee</span>
            <select value={filters.emp} onChange={(event) => onFilterChange({ emp: event.target.value })}>
              <option value="">All Employees</option>
              {employeeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="dashboard-control">
          <span>FMS Category</span>
          <select value={filters.name} onChange={(event) => onFilterChange({ name: event.target.value })}>
            <option value="">All Categories</option>
            {categoryOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label className="dashboard-control">
          <span>Plan Date</span>
          <input type="date" value={filters.date} onChange={(event) => onFilterChange({ date: event.target.value })} />
        </label>
        <label className="dashboard-control">
          <span>Search</span>
          <input
            type="text"
            value={filters.search}
            placeholder="Search FMS task, name, category..."
            onChange={(event) => onFilterChange({ search: event.target.value })}
          />
        </label>
      </div>
    </article>
  );
}
