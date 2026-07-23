export function FormsPortalFilterPanel({
  filters,
  departmentOptions,
  sheetOptions,
  onUpdateFilters,
  onResetFilters
}) {
  return (
    <article className="migration-panel migration-panel--full">
      <div className="migration-panel__row">
        <h2>Filter & Search Forms</h2>
        <button type="button" className="attendance-cta attendance-cta--gray" onClick={onResetFilters}>
          Reset Filters
        </button>
      </div>

      <div className="approval-filter-grid">
        <label className="dashboard-control">
          <span>Department</span>
          <select value={filters.department} onChange={(event) => onUpdateFilters({ department: event.target.value })}>
            <option value="">All Departments</option>
            {departmentOptions.map((department) => (
              <option key={department} value={department}>
                {department}
              </option>
            ))}
          </select>
        </label>

        <label className="dashboard-control">
          <span>Category / Sheet</span>
          <select value={filters.sheet} onChange={(event) => onUpdateFilters({ sheet: event.target.value })}>
            <option value="">All Categories</option>
            {sheetOptions.map((sheet) => (
              <option key={sheet} value={sheet}>
                {sheet}
              </option>
            ))}
          </select>
        </label>

        <label className="dashboard-control approval-filter-grid__wide">
          <span>Keyword Search (For / Purpose)</span>
          <input
            value={filters.search}
            onChange={(event) => onUpdateFilters({ search: event.target.value })}
            placeholder="e.g. Worktrack, Client Social..."
          />
        </label>
      </div>
    </article>
  );
}
