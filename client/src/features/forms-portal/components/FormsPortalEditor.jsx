import { StatusPill } from '@/components/common/StatusPill';

export function FormsPortalEditor({
  editor,
  assignableUsers,
  submitting,
  fixedDepartment = '',
  onUpdate,
  onClose,
  onSubmit
}) {
  const visibilityType = String(editor.form['Visibility Type'] || 'SELECTED_USERS').toUpperCase();
  const selectedUsers = new Set(
    String(editor.form['Visible Users'] || '')
      .split(',')
      .map((item) => item.trim().toUpperCase())
      .filter(Boolean)
  );

  const toggleUser = (userId) => {
    const next = new Set(selectedUsers);
    if (next.has(userId)) next.delete(userId);
    else next.add(userId);
    const serialized = Array.from(next).join(', ');
    onUpdate({ 'Visible Users': serialized, Viewer: serialized });
  };

  return (
    <article className="forms-editor">
      <div className="forms-editor__grid">
        <label className="dashboard-control">
          <span>Department</span>
          <input
            value={fixedDepartment || editor.form.Department || ''}
            onChange={(event) => onUpdate({ Department: event.target.value })}
            disabled={Boolean(fixedDepartment)}
            placeholder="e.g. HR, Sales, Development"
          />
        </label>

        <label className="dashboard-control">
          <span>Category / Sheet Name</span>
          <input
            value={editor.form['Sheet name'] || ''}
            onChange={(event) => onUpdate({ 'Sheet name': event.target.value })}
            disabled={editor.mode === 'edit'}
            placeholder="e.g. Work of Scope"
          />
        </label>

        <label className="dashboard-control forms-editor__full">
          <span>For / Purpose</span>
          <input
            value={editor.form.For || ''}
            onChange={(event) => onUpdate({ For: event.target.value })}
            placeholder="e.g. Client onboarding"
          />
        </label>

        <label className="dashboard-control forms-editor__full">
          <span>Form Link</span>
          <input
            value={editor.form['Form link'] || ''}
            onChange={(event) => onUpdate({ 'Form link': event.target.value })}
            placeholder="https://..."
          />
        </label>

        <label className="dashboard-control">
          <span>Access Type</span>
          <select
            value={visibilityType}
            onChange={(event) =>
              onUpdate({
                'Visibility Type': event.target.value,
                'Visible Users': event.target.value === 'ALL' ? '' : editor.form['Visible Users'] || '',
                Viewer: event.target.value === 'ALL' ? 'ALL' : editor.form.Viewer || ''
              })
            }
          >
            <option value="ALL">All Users</option>
            <option value="SELECTED_USERS">Selected Users Only</option>
          </select>
        </label>

        <label className="dashboard-control">
          <span>Status</span>
          <select value={editor.form.Status || 'Active'} onChange={(event) => onUpdate({ Status: event.target.value })}>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        </label>
      </div>

      {visibilityType === 'SELECTED_USERS' ? (
        <div className="forms-user-picker">
          <div className="migration-panel__row">
            <h3>Allowed Users</h3>
            <StatusPill tone="info">{selectedUsers.size} selected</StatusPill>
          </div>
          <div className="forms-user-picker__grid">
            {assignableUsers.length ? (
              assignableUsers.map((user) => {
                const userId = String(user.id || '').toUpperCase();
                const selected = selectedUsers.has(userId);
                return (
                  <label key={userId} className={`forms-user-card${selected ? ' forms-user-card--selected' : ''}`}>
                    <input type="checkbox" checked={selected} onChange={() => toggleUser(userId)} />
                    <div>
                      <strong>
                        {user.name} ({userId})
                      </strong>
                      <span>{[user.department, user.role].filter(Boolean).join(' | ') || 'Employee'}</span>
                    </div>
                  </label>
                );
              })
            ) : (
              <div className="dashboard-table__empty">No active users available for assignment.</div>
            )}
          </div>
        </div>
      ) : null}

      <div className="ticket-form-actions">
        <button type="button" className="attendance-cta attendance-cta--blue" disabled={submitting} onClick={onSubmit}>
          {editor.mode === 'edit' ? 'Save Form Details' : 'Add Form'}
        </button>
        <button type="button" className="attendance-cta attendance-cta--red" onClick={onClose}>
          Cancel
        </button>
      </div>
    </article>
  );
}
