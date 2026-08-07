export function TodoToolbar({ statusFilter, onStatusFilterChange, formMode, onFormModeChange, onOpenForm }) {
  return (
    <article className="migration-panel migration-panel--full">
      <div className="migration-panel__row">
        <div className="dashboard-controls">
          <button
            type="button"
            className="attendance-cta attendance-cta--purple"
            onClick={() => {
              onFormModeChange('bulk');
              onOpenForm?.('bulk');
            }}
          >
            Add Task
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
