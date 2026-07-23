export function ClientsPortalFilterPanel({
  filters,
  clientOptions,
  serviceOptions,
  onUpdateFilters,
  onResetFilters
}) {
  return (
    <article className="migration-panel migration-panel--full">
      <div className="migration-panel__row">
        <h2>Filter & Search Clients</h2>
        <button type="button" className="attendance-cta attendance-cta--gray" onClick={onResetFilters}>
          Reset Filters
        </button>
      </div>

      <div className="approval-filter-grid">
        <label className="dashboard-control">
          <span>Search Client (ID / Name)</span>
          <select value={filters.client} onChange={(event) => onUpdateFilters({ client: event.target.value })}>
            <option value="">All Clients</option>
            {clientOptions.map((client) => (
              <option key={client.id} value={client.name}>
                {client.name} ({client.id})
              </option>
            ))}
          </select>
        </label>

        <label className="dashboard-control">
          <span>Select Status</span>
          <select value={filters.status} onChange={(event) => onUpdateFilters({ status: event.target.value })}>
            <option value="">All Statuses</option>
            <option value="Active">Active</option>
            <option value="In-Active">In-Active</option>
          </select>
        </label>

        <label className="dashboard-control approval-filter-grid__wide">
          <span>Filter by Service / Category</span>
          <select value={filters.service} onChange={(event) => onUpdateFilters({ service: event.target.value })}>
            <option value="">All Services</option>
            {serviceOptions.map((service) => (
              <option key={service} value={service}>
                {service}
              </option>
            ))}
          </select>
        </label>
      </div>
    </article>
  );
}
