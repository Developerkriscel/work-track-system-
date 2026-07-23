function AdminTab({ active, children, onClick }) {
  return (
    <button
      type="button"
      className={`approval-tab-btn${active ? ' approval-tab-btn--active' : ''}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function AdminTabsAndFilters({
  activeTab,
  onTabChange,
  filters,
  onFilterChange,
  onResetFilters,
  roleFilterOptions,
  roleOptions,
  statusOptions,
  departmentFilterOptions,
  departmentOptions
}) {
  return (
    <article className="migration-panel migration-panel--full">
      <div className="migration-panel__row">
        <div className="approval-tabs">
          <AdminTab active={activeTab === 'users'} onClick={() => onTabChange('users')}>
            Users Management
          </AdminTab>
        </div>
      </div>

      <div className="approval-filter-grid">
        <label className="dashboard-control approval-filter-grid__wide">
          <span>Search</span>
          <input
            value={filters.search}
            onChange={(event) => onFilterChange({ search: event.target.value })}
            placeholder="Search by employee, role, department, manager, email..."
          />
        </label>

        <label className="dashboard-control">
          <span>Role</span>
          <select value={filters.role} onChange={(event) => onFilterChange({ role: event.target.value })}>
            <option value="">All Roles</option>
            {(roleFilterOptions.length ? roleFilterOptions : roleOptions).map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
        </label>

        <label className="dashboard-control">
          <span>Status</span>
          <select value={filters.status} onChange={(event) => onFilterChange({ status: event.target.value })}>
            <option value="">All Statuses</option>
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>

        <label className="dashboard-control">
          <span>Department</span>
          <select value={filters.department} onChange={(event) => onFilterChange({ department: event.target.value })}>
            <option value="">All Departments</option>
            {(departmentFilterOptions.length ? departmentFilterOptions : departmentOptions).map((department) => (
              <option key={department} value={department}>
                {department}
              </option>
            ))}
          </select>
        </label>

        <div className="dashboard-control">
          <span>&nbsp;</span>
          <button type="button" className="attendance-cta attendance-cta--gray" onClick={onResetFilters}>
            Reset Filters
          </button>
        </div>
      </div>
    </article>
  );
}
