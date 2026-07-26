export function MyApprovalStatusFilters({ filters, typeOptions, onChange, onReset }) {
  return (
    <article className="migration-panel migration-panel--full">
      <div className="migration-panel__row">
        <h2>Filter Approval History</h2>
        <button type="button" className="attendance-cta attendance-cta--gray" onClick={onReset}>
          Reset
        </button>
      </div>

      <div className="my-approval-status__filters">
        <label className="dashboard-control">
          <span>Type</span>
          <select value={filters.type} onChange={(event) => onChange({ type: event.target.value })}>
            <option value="">All Types</option>
            {typeOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label className="dashboard-control my-approval-status__filters-search">
          <span>Search</span>
          <input
            value={filters.search}
            onChange={(event) => onChange({ search: event.target.value })}
            placeholder="Search by subtype, status, reason, remarks..."
          />
        </label>
      </div>
    </article>
  );
}
