import { useRef } from 'react';

export function TicketFilterPanel({
  showCreateForm,
  canCreate,
  clients,
  uniqueStatuses,
  filters,
  onReset,
  onApply,
  onToggleCreateForm,
  onFiltersChange,
  onApplySpecific,
  isAutoTab,
  employees
}) {
  const searchDebounceRef = useRef(null);

  function closeFilterMenus() {
    document.querySelectorAll('.ticket-filter-dropdown[open]').forEach((menu) => menu.removeAttribute('open'));
  }


  const selectedClientLabel = filters.clientIds.length
    ? `${filters.clientIds.length} client${filters.clientIds.length > 1 ? 's' : ''} selected`
    : 'All Clients';
  const selectedStatusLabel = filters.statuses?.length
    ? `${filters.statuses.length} status${filters.statuses.length > 1 ? 'es' : ''} selected`
    : 'All Statuses';
  let selectedFreqLabel = 'All Frequencies';
  if (filters.frequencies?.length === 1) {
    selectedFreqLabel = filters.frequencies[0];
  } else if (filters.frequencies?.length > 1) {
    selectedFreqLabel = `${filters.frequencies.length} frequencies selected`;
  }
  let selectedEmpLabel = 'All Employees';
  if (filters.employeeIds?.length === 1) {
    // If we're storing Employee Names now, we can just display it directly!
    selectedEmpLabel = filters.employeeIds[0];
  } else if (filters.employeeIds?.length > 1) {
    selectedEmpLabel = `${filters.employeeIds.length} employees selected`;
  }
  
  const frequencyOptions = ['Daily', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '15', '20', '25', '26', '27', '28', '29', '30', '31', '2nd Fri', '4th Fri'];

  return (
    <article className="migration-panel migration-panel--full" style={{ zIndex: 10, position: 'relative' }}>
      <div className="migration-panel__row">
        <h2>Advanced Filters</h2>
        <div className="ticket-filter-actions">
          <button type="button" className="inline-action inline-action--ghost" onClick={() => { onReset(); closeFilterMenus(); }}>
            Reset
          </button>
          {canCreate ? (
            <button type="button" className="inline-action inline-action--create-ticket" onClick={onToggleCreateForm}>
              {showCreateForm ? 'Hide Form' : 'Create New Ticket'}
            </button>
          ) : null}
        </div>
      </div>

      <div className="ticket-filter-grid">
        {!isAutoTab && (
          <>
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
                          onChange={() => {
                            const next = checked
                              ? filters.clientIds.filter((item) => item !== value)
                              : [...filters.clientIds, value];
                            onFiltersChange((current) => ({ ...current, clientIds: next }));
                          }}
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
          </>
        )}

        {isAutoTab && (
          <>
            <div className="dashboard-control ticket-filter-dropdown-control">
              <span>Frequency</span>
              <details className="ticket-filter-dropdown">
                <summary data-ticket-filter="frequencies">{selectedFreqLabel}</summary>
                <div className="ticket-filter-dropdown__menu">
                  <div
                    className="ticket-filter-dropdown__option"
                    style={{ cursor: 'pointer', fontWeight: !filters.frequencies?.length ? 'bold' : 'normal' }}
                    onClick={() => {
                      const next = { ...filters, frequencies: [] };
                      if (onApplySpecific) onApplySpecific(next);
                      else onFiltersChange(next);
                      closeFilterMenus();
                    }}
                  >
                    <span>All Frequencies</span>
                  </div>
                  {frequencyOptions.map((freq) => {
                    const checked = filters.frequencies?.includes(freq);
                    return (
                      <div
                        className="ticket-filter-dropdown__option"
                        key={freq}
                        style={{ cursor: 'pointer', fontWeight: checked ? 'bold' : 'normal', backgroundColor: checked ? 'var(--color-primary-light, #eef2ff)' : 'transparent' }}
                        onClick={() => {
                          const next = {
                            ...filters,
                            frequencies: checked ? [] : [freq]
                          };
                          if (onApplySpecific) onApplySpecific(next);
                          else onFiltersChange(next);
                          closeFilterMenus();
                        }}
                      >
                        <span>{freq}</span>
                      </div>
                    );
                  })}
                </div>
              </details>
            </div>

            <div className="dashboard-control ticket-filter-dropdown-control">
              <span>Select Employee</span>
              <details className="ticket-filter-dropdown">
                <summary data-ticket-filter="employees">{selectedEmpLabel}</summary>
                <div className="ticket-filter-dropdown__menu">
                  <div
                    className="ticket-filter-dropdown__option"
                    style={{ cursor: 'pointer', fontWeight: !filters.employeeIds?.length ? 'bold' : 'normal' }}
                    onClick={() => {
                      const next = { ...filters, employeeIds: [] };
                      if (onApplySpecific) onApplySpecific(next);
                      else onFiltersChange(next);
                      closeFilterMenus();
                    }}
                  >
                    <span>All Employees</span>
                  </div>
                  {employees?.map((emp) => {
                    const value = emp['Employee Name'] || emp['Employee ID'];
                    const label = emp['Employee Name'] || emp['Employee ID'];
                    const checked = filters.employeeIds?.includes(value);
                    return (
                      <div
                        className="ticket-filter-dropdown__option"
                        key={value}
                        style={{ cursor: 'pointer', fontWeight: checked ? 'bold' : 'normal', backgroundColor: checked ? 'var(--color-primary-light, #eef2ff)' : 'transparent' }}
                        onClick={() => {
                          const next = {
                            ...filters,
                            employeeIds: checked ? [] : [value]
                          };
                          if (onApplySpecific) onApplySpecific(next);
                          else onFiltersChange(next);
                          closeFilterMenus();
                        }}
                      >
                        <span>{label}</span>
                      </div>
                    );
                  })}
                </div>
              </details>
            </div>
          </>
        )}

        {!isAutoTab && (
          <>
            <label className="dashboard-control">
              <span>Search</span>
              <input
                value={filters.search}
                onChange={(event) => {
                  const value = event.target.value;
                  // Update display value immediately
                  onFiltersChange((current) => ({ ...current, search: value }));
                }}
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
          </>
        )}
      </div>
    </article>
  );
}
