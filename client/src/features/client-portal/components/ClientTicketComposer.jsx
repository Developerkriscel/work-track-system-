function DraftRowCard({ row, onAdd, onChange, onRemove, removable }) {
  return (
    <article className="client-ticket-draft">
      <div className="migration-panel__row client-ticket-draft__row">
        <h3>Ticket Draft</h3>
        <div className="ticket-filter-actions">
          <button type="button" className="inline-action" onClick={onAdd}>Add Another Ticket</button>
          {removable ? (
            <button type="button" className="attendance-cta attendance-cta--red" onClick={onRemove}>
              Remove
            </button>
          ) : null}
        </div>
      </div>

      <div className="ticket-form-grid">
        <label className="dashboard-control">
          <span>Category</span>
          <input value={row.category} onChange={(event) => onChange({ category: event.target.value })} placeholder="Enter task category" />
        </label>

        <label className="dashboard-control">
          <span>Priority</span>
          <select value={row.priority} onChange={(event) => onChange({ priority: event.target.value })}>
            <option value="Low">Low</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
            <option value="Urgent">Urgent</option>
          </select>
        </label>

        <label className="dashboard-control">
          <span>Expected Completion</span>
          <input type="date" value={row.completionDate} onChange={(event) => onChange({ completionDate: event.target.value })} />
        </label>

        <label className="dashboard-control ticket-form-grid__full">
          <span>Description</span>
          <textarea
            value={row.description}
            onChange={(event) => onChange({ description: event.target.value })}
            placeholder="Please provide a detailed description..."
          />
        </label>

        <label className="dashboard-control ticket-form-grid__full">
          <span>Attachments</span>
          <input
            type="file"
            multiple
            onChange={(event) => onChange({ attachments: Array.from(event.target.files || []) })}
          />
        </label>
      </div>

      {row.attachments?.length ? (
        <div className="dashboard-banner client-ticket-draft__files">
          <strong>{row.attachments.length} file(s) attached</strong>
          <span>{row.attachments.map((file) => file.name).join(', ')}</span>
        </div>
      ) : null}
    </article>
  );
}

export function ClientTicketComposer({
  draftRows,
  onAddRow,
  onChangeRow,
  onRemoveRow,
  onCancel,
  onSubmit,
  submitting
}) {
  return (
    <article className="migration-panel migration-panel--full">
      <div className="migration-panel__row">
        <div>
          <h2>Create New Ticket(s)</h2>
          <p>Add one or more client tickets and submit them together.</p>
        </div>
      </div>

      <div className="client-ticket-draft-list">
        {draftRows.map((row) => (
          <DraftRowCard
            key={row.id}
            row={row}
            removable={draftRows.length > 1}
            onAdd={onAddRow}
            onRemove={() => onRemoveRow(row.id)}
            onChange={(patch) => onChangeRow(row.id, patch)}
          />
        ))}
      </div>

      <div className="ticket-form-actions client-ticket-composer__actions">
        <button type="button" className="attendance-cta attendance-cta--gray" onClick={onCancel} disabled={submitting}>
          Back To Tickets
        </button>
        <button type="button" className="attendance-cta attendance-cta--purple" onClick={onSubmit} disabled={submitting}>
          {submitting ? 'Submitting...' : 'Submit All Tickets'}
        </button>
      </div>
    </article>
  );
}
