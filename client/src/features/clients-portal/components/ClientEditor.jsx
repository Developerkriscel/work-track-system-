export function ClientEditor({ editor, submitting, onUpdate, onClose, onSubmit }) {
  if (!editor.open) return null;

  return (
    <article className="forms-editor">
      <div className="forms-editor__grid">
        <label className="dashboard-control forms-editor__full">
          <span>Client Name</span>
          <input value={editor.client['Client Name'] || ''} onChange={(event) => onUpdate({ 'Client Name': event.target.value })} />
        </label>

        <label className="dashboard-control">
          <span>Mobile Number</span>
          <input value={editor.client['Mobile Number'] || ''} onChange={(event) => onUpdate({ 'Mobile Number': event.target.value })} />
        </label>

        <label className="dashboard-control">
          <span>Client Email ID</span>
          <input value={editor.client['Client Email ID'] || ''} onChange={(event) => onUpdate({ 'Client Email ID': event.target.value })} />
        </label>

        <label className="dashboard-control forms-editor__full">
          <span>Address</span>
          <input value={editor.client.Address || ''} onChange={(event) => onUpdate({ Address: event.target.value })} />
        </label>

        <label className="dashboard-control">
          <span>Status</span>
          <select value={editor.client.Status || 'Active'} onChange={(event) => onUpdate({ Status: event.target.value })}>
            <option value="Active">Active</option>
            <option value="In-Active">In-Active</option>
          </select>
        </label>

        <label className="dashboard-control">
          <span>Password</span>
          <input value={editor.client.Password || ''} onChange={(event) => onUpdate({ Password: event.target.value })} />
        </label>

        <label className="dashboard-control">
          <span>Detail Shared</span>
          <input value={editor.client['Detail Shared'] || ''} onChange={(event) => onUpdate({ 'Detail Shared': event.target.value })} />
        </label>

        <label className="dashboard-control forms-editor__full">
          <span>Services / Categories</span>
          <input value={editor.client.Services || ''} onChange={(event) => onUpdate({ Services: event.target.value })} placeholder="e.g. Google Sheet, Development" />
        </label>
      </div>

      <div className="ticket-form-actions">
        <button type="button" className="attendance-cta attendance-cta--blue" disabled={submitting} onClick={onSubmit}>
          Save Details
        </button>
        <button type="button" className="attendance-cta attendance-cta--red" onClick={onClose}>
          Cancel
        </button>
      </div>
    </article>
  );
}
