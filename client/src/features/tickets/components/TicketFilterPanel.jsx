export function TicketFilterPanel({
  showCreateForm,
  clients,
  uniqueStatuses,
  filters,
  onReset,
  onApply,
  onToggleCreateForm,
  onFiltersChange
}) {
  function closeFilterMenus() {
    document.querySelectorAll('.ticket-filter-dropdown[open]').forEach((menu) => menu.removeAttribute('open'));
  }

  const selectedClientLabel = filters.clientIds.length
    ? `${filters.clientIds.length} client${filters.clientIds.length > 1 ? 's' : ''} selected`
    : 'All Clients';
  const selectedStatusLabel = filters.statuses.length
    ? `${filters.statuses.length} status${filters.statuses.length > 1 ? 'es' : ''} selected`
    : 'All Statuses';

  return (
    <article className="migration-panel migration-panel--full">
      <div className="migration-panel__row">
        <h2>Advanced Filters</h2>
        <div className="ticket-filter-actions">
          <button type="button" className="inline-action inline-action--ghost" onClick={() => { onReset(); closeFilterMenus(); }}>
            Reset
          </button>
          <button type="button" className="inline-action" onClick={() => { onApply(); closeFilterMenus(); }}>
            Apply Filters
          </button>
          <button type="button" className="inline-action" onClick={onToggleCreateForm}>
            {showCreateForm ? 'Hide Form' : 'Create New Ticket'}
          </button>
        </div>
      </div>

      <div className="ticket-filter-grid">
        <div className="dashboard-control ticket-filter-dropdown-control">
          <span>Select Clients</span>
          <details className="ticket-filter-dropdown">
            <summary data-ticket-filter="clients">{selectedClientLabel}</summary>
            <div className="ticket-filter-dropdown__menu">
              <label className="ticket-filter-dropdown__option">
                <input
                  type="checkbox"
                  checked={!filters.clientIds.length}
                  onChange={() => onFiltersChange((current) => ({ ...current, clientIds: [] }))}
                />
                <span>All Clients</span>
              </label>
              {clients.map((client) => {
                const value = client.Client_Id || client['Client ID'];
                const label = client['Client Name'] || value;
                const checked = filters.clientIds.includes(value);
                return (
                  <label className="ticket-filter-dropdown__option" key={value}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => onFiltersChange((current) => ({
                        ...current,
                        clientIds: checked
                          ? current.clientIds.filter((item) => item !== value)
                          : [...current.clientIds, value]
                      }))}
                    />
                    <span>{label}</span>
                  </label>
                );
              })}
            </div>
          </details>
        </div>

        <div className="dashboard-control ticket-filter-dropdown-control">
          <span>Task Status</span>
          <details className="ticket-filter-dropdown">
            <summary data-ticket-filter="statuses">{selectedStatusLabel}</summary>
            <div className="ticket-filter-dropdown__menu">
              <label className="ticket-filter-dropdown__option">
                <input
                  type="checkbox"
                  checked={!filters.statuses.length}
                  onChange={() => onFiltersChange((current) => ({ ...current, statuses: [] }))}
                />
                <span>All Statuses</span>
              </label>
              {uniqueStatuses.map((status) => {
                const checked = filters.statuses.includes(status);
                return (
                  <label className="ticket-filter-dropdown__option" key={status}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => onFiltersChange((current) => ({
                        ...current,
                        statuses: checked
                          ? current.statuses.filter((item) => item !== status)
                          : [...current.statuses, status]
                      }))}
                    />
                    <span>{status}</span>
                  </label>
                );
              })}
            </div>
          </details>
        </div>

        <label className="dashboard-control">
          <span>Search</span>
          <input
            value={filters.search}
            onChange={(event) => onFiltersChange((current) => ({ ...current, search: event.target.value }))}
            placeholder="Ticket, client, description..."
          />
        </label>

        <label className="dashboard-control">
          <span>Time Period</span>
          <select
            value={filters.timePeriod}
            onChange={(event) => onFiltersChange((current) => ({ ...current, timePeriod: event.target.value }))}
          >
            <option value="All Time">All Time</option>
            <option value="Today">Today</option>
            <option value="This Week">This Week</option>
            <option value="Last Week">Last Week</option>
            <option value="This Month">This Month</option>
            <option value="Last Month">Last Month</option>
          </select>
        </label>
      </div>
    </article>
  );
}
