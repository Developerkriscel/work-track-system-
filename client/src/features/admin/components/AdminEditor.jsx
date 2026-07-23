export function AdminEditor({
  editor,
  managerOptions,
  roleOptions,
  statusOptions,
  departmentOptions,
  categoryOptions,
  submitting,
  onUpdate,
  onClose,
  onSubmit
}) {
  const showCategory = editor.source === 'empMaster' || editor.mode === 'add';

  return (
    <article className="migration-panel migration-panel--full forms-editor">
      <div className="migration-panel__row">
        <h2>{editor.mode === 'edit' ? 'Edit User Details' : 'Add New Employee'}</h2>
        <button type="button" className="attendance-cta attendance-cta--red" onClick={onClose}>
          Close
        </button>
      </div>

      <div className="forms-editor__grid">
        {showCategory ? (
          <label className="dashboard-control">
            <span>Category</span>
            <select value={editor.form.Category || 'Master'} onChange={(event) => onUpdate({ Category: event.target.value })}>
              {categoryOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <label className="dashboard-control">
          <span>Employee ID</span>
          <input value={editor.form['Employee ID'] || ''} onChange={(event) => onUpdate({ 'Employee ID': event.target.value.toUpperCase() })} />
        </label>

        <label className="dashboard-control">
          <span>Employee Name</span>
          <input value={editor.form['Employee Name'] || ''} onChange={(event) => onUpdate({ 'Employee Name': event.target.value })} />
        </label>

        <label className="dashboard-control">
          <span>Reporting Manager</span>
          <select value={editor.form['Manager ID'] || ''} onChange={(event) => onUpdate({ 'Manager ID': event.target.value })}>
            <option value="">None</option>
            {managerOptions.map((manager) => (
              <option key={manager.id} value={manager.id}>
                {manager.name} ({manager.id})
              </option>
            ))}
          </select>
        </label>

        <label className="dashboard-control">
          <span>Task Approver</span>
          <select value={editor.form['Task Approver'] || ''} onChange={(event) => onUpdate({ 'Task Approver': event.target.value })}>
            <option value="">Same as Manager</option>
            {managerOptions.map((manager) => (
              <option key={manager.id} value={manager.id}>
                {manager.name} ({manager.id})
              </option>
            ))}
          </select>
        </label>

        <label className="dashboard-control">
          <span>Department</span>
          <select value={editor.form.Department || ''} onChange={(event) => onUpdate({ Department: event.target.value })}>
            <option value="">Select Department</option>
            {departmentOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label className="dashboard-control">
          <span>Role</span>
          <select value={editor.form.Role || 'User'} onChange={(event) => onUpdate({ Role: event.target.value })}>
            {roleOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label className="dashboard-control">
          <span>Password</span>
          <input value={editor.form.Password || ''} onChange={(event) => onUpdate({ Password: event.target.value })} />
        </label>

        <label className="dashboard-control">
          <span>Status</span>
          <select value={editor.form.Status || 'Active'} onChange={(event) => onUpdate({ Status: event.target.value })}>
            {statusOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label className="dashboard-control">
          <span>Mobile Number</span>
          <input value={editor.form['Mobile Number'] || ''} onChange={(event) => onUpdate({ 'Mobile Number': event.target.value })} />
        </label>

        <label className="dashboard-control forms-editor__full">
          <span>Email</span>
          <input type="email" value={editor.form.Email || ''} onChange={(event) => onUpdate({ Email: event.target.value })} />
        </label>
      </div>

      <div className="ticket-form-actions">
        <button type="button" className="attendance-cta attendance-cta--green" disabled={submitting} onClick={onSubmit}>
          {editor.mode === 'edit' ? 'Update User' : 'Create User'}
        </button>
        <button type="button" className="attendance-cta attendance-cta--gray" onClick={onClose}>
          Cancel
        </button>
      </div>
    </article>
  );
}
