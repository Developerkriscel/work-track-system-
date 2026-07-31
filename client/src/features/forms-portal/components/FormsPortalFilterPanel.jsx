import { CustomSelect } from '@/components/common/CustomSelect';

export function FormsPortalFilterPanel({
  filters,
  departmentOptions,
  sheetOptions,
  onUpdateFilters,
  onResetFilters
}) {
  return (
    <article className="migration-panel migration-panel--full" style={{ position: 'relative', zIndex: 10 }}>
      <div className="migration-panel__row">
        <h2>Filter & Search Forms</h2>
        <button type="button" className="attendance-cta attendance-cta--gray" onClick={onResetFilters}>
          Reset Filters
        </button>
      </div>

      <div className="approval-filter-grid">
        <label className="dashboard-control">
          <span>Department</span>
          <CustomSelect 
            value={filters.department} 
            onChange={(val) => onUpdateFilters({ department: val })} 
            options={departmentOptions.map(d => ({ value: d, label: d }))}
            defaultLabel="All Departments" 
          />
        </label>

        <label className="dashboard-control">
          <span>Category / Sheet</span>
          <CustomSelect 
            value={filters.sheet} 
            onChange={(val) => onUpdateFilters({ sheet: val })} 
            options={sheetOptions.map(s => ({ value: s, label: s }))}
            defaultLabel="All Categories" 
          />
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
