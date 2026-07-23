export function TodoToolbar({ statusFilter, onStatusFilterChange, formMode, onFormModeChange, onOpenForm }) {
  return (
    <article className="migration-panel migration-panel--full">
      <div className="migration-panel__row">
        <div className="approval-tabs">
          <button
            type="button"
            className={`approval-tab-btn${formMode === 'single' ? ' approval-tab-btn--active' : ''}`}
            onClick={() => {
              onFormModeChange('single');
              onOpenForm?.('single');
            }}
          >
            Single Task
          </button>
          <button
            type="button"
            className={`approval-tab-btn${formMode === 'bulk' ? ' approval-tab-btn--active' : ''}`}
            onClick={() => {
              onFormModeChange('bulk');
              onOpenForm?.('bulk');
            }}
          >
            Bulk Add
          </button>
        </div>

        <label className="dashboard-control">
          <span>Status Filter</span>
          <select value={statusFilter} onChange={(event) => onStatusFilterChange(event.target.value)}>
            <option value="">All Statuses</option>
            <option value="Pending">Pending</option>
            <option value="Completed">Completed</option>
          </select>
        </label>
      </div>
    </article>
  );
}
