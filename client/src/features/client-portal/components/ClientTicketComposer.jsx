import { AppModal } from '@/components/modals';

function DraftRowCard({ row, onAdd, onChange, onRemove, removable }) {
  return (
    <article className="client-ticket-draft" style={{ padding: '12px', background: 'var(--wt-bg-subtle)' }}>
      <div className="migration-panel__row client-ticket-draft__row" style={{ marginBottom: '8px' }}>
        <h3 style={{ fontSize: '14px', margin: 0 }}>Ticket Details</h3>
        <div className="ticket-filter-actions">
          <button type="button" className="inline-action" onClick={onAdd} style={{ fontSize: '12px' }}>Add Another Ticket</button>
          {removable ? (
            <button type="button" className="attendance-cta attendance-cta--red" onClick={onRemove} style={{ padding: '2px 8px', minHeight: '24px', fontSize: '12px' }}>
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
            style={{ minHeight: '80px' }}
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
    <AppModal title="Create New Ticket(s)" onClose={onCancel} width="640px">
      <div className="client-ticket-draft-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
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

      <div className="ticket-form-actions client-ticket-composer__actions" style={{ marginTop: '16px', borderTop: '1px solid rgba(213,225,241,0.6)', paddingTop: '16px' }}>
        <button type="button" className="attendance-cta attendance-cta--gray" onClick={onCancel} disabled={submitting}>
          Cancel
        </button>
        <button type="button" className="attendance-cta attendance-cta--purple" onClick={onSubmit} disabled={submitting}>
          {submitting ? 'Submitting...' : 'Submit All Tickets'}
        </button>
      </div>
    </AppModal>
  );
}
