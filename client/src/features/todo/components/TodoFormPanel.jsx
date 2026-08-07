function BulkTodoRow({ row, index, canRemove, onChange, onRemove }) {
  return (
    <div className="forms-editor__grid forms-editor__grid--nested">
      <label className="dashboard-control forms-editor__full">
        <span>Task {index + 1}</span>
        <input value={row.task} onChange={(event) => onChange({ task: event.target.value })} placeholder="What needs to be done?" />
      </label>

      <label className="dashboard-control">
        <span>Priority</span>
        <select value={row.priority} onChange={(event) => onChange({ priority: event.target.value })}>
          <option value="Low">Low</option>
          <option value="Medium">Medium</option>
          <option value="High">High</option>
        </select>
      </label>

      <label className="dashboard-control">
        <span>Due Date</span>
        <input type="date" value={row.dueDate} onChange={(event) => onChange({ dueDate: event.target.value })} />
      </label>

      <label className="dashboard-control">
        <span>TAT (mins)</span>
        <input type="number" min="1" value={row.tat} onChange={(event) => onChange({ tat: event.target.value })} placeholder="e.g. 60" />
      </label>

      <div className="dashboard-control">
        <span>&nbsp;</span>
        <button type="button" className="attendance-cta attendance-cta--red" onClick={onRemove} disabled={!canRemove}>
          Remove
        </button>
      </div>
    </div>
  );
}

export function TodoFormPanel({
  formMode,
  singleForm,
  onSingleChange,
  onSingleSubmit,
  bulkRows,
  onBulkRowChange,
  onBulkAddRow,
  onBulkRemoveRow,
  onBulkReset,
  onBulkSubmit,
  submitting
}) {
  return (
    <article className="migration-panel migration-panel--full forms-editor">
      {formMode === 'bulk' ? (
        <div className="migration-panel__row" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="attendance-cta attendance-cta--gray" onClick={onBulkAddRow}>
            Add Row
          </button>
        </div>
      ) : null}

      {formMode === 'single' ? (
        <div className="forms-editor__grid">
          <label className="dashboard-control forms-editor__full">
            <span>Task</span>
            <input value={singleForm.task} onChange={(event) => onSingleChange({ task: event.target.value })} placeholder="What needs to be done?" />
          </label>

          <label className="dashboard-control">
            <span>Priority</span>
            <select value={singleForm.priority} onChange={(event) => onSingleChange({ priority: event.target.value })}>
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
            </select>
          </label>

          <label className="dashboard-control">
            <span>Due Date</span>
            <input type="date" value={singleForm.dueDate} onChange={(event) => onSingleChange({ dueDate: event.target.value })} />
          </label>

          <label className="dashboard-control">
            <span>TAT (mins)</span>
            <input type="number" min="1" value={singleForm.tat} onChange={(event) => onSingleChange({ tat: event.target.value })} placeholder="e.g. 60" />
          </label>
        </div>
      ) : (
        <div className="todo-bulk-stack">
          {bulkRows.map((row, index) => (
            <BulkTodoRow
              key={row.id}
              row={row}
              index={index}
              canRemove={bulkRows.length > 1}
              onChange={(patch) => onBulkRowChange(row.id, patch)}
              onRemove={() => onBulkRemoveRow(row.id)}
            />
          ))}
        </div>
      )}

      <div className="ticket-form-actions">
        {formMode === 'single' ? (
          <button type="button" className="attendance-cta attendance-cta--green" disabled={submitting} onClick={onSingleSubmit}>
            Create Task
          </button>
        ) : (
          <>
            <button type="button" className="attendance-cta attendance-cta--green" disabled={submitting} onClick={onBulkSubmit}>
              Create Tasks
            </button>
            <button type="button" className="attendance-cta attendance-cta--gray" onClick={onBulkReset}>
              Reset List
            </button>
          </>
        )}
      </div>
    </article>
  );
}
