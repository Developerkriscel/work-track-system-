import { useState } from 'react';
import { submitManagementBatch } from '@/features/management-dashboard/api';

const today = () => new Date().toISOString().slice(0, 10);
const blankRow = () => ({
  description: '',
  clientId: '',
  priority: 'Normal',
  tat: '',
  planDate: today()
});

export function BatchAssignmentPlanner({ users = [], clients = [], currentUser, onCompleted }) {
  const [type, setType] = useState('ticket');
  const [employeeId, setEmployeeId] = useState('');
  const [rows, setRows] = useState([blankRow()]);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);

  function updateRow(index, changes) {
    setRows((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, ...changes } : row));
  }

  function removeRow(index) {
    setRows((current) => current.length === 1 ? current : current.filter((_row, rowIndex) => rowIndex !== index));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setFeedback(null);
    const tasks = rows.filter((row) => row.description.trim());
    if (!employeeId) return setFeedback({ tone: 'error', text: 'Select an employee first.' });
    if (!tasks.length) return setFeedback({ tone: 'error', text: 'Add at least one task description.' });

    setSaving(true);
    try {
      const result = await submitManagementBatch(
        currentUser?.['Employee ID'] || currentUser?.employeeId,
        type,
        employeeId,
        tasks
      );
      setFeedback({ tone: 'success', text: result.message || 'Batch work assigned successfully.' });
      setRows([blankRow()]);
      onCompleted?.();
    } catch (error) {
      setFeedback({ tone: 'error', text: error.message || 'Unable to assign batch work.' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className="migration-panel migration-panel--full">
      <div className="migration-panel__row">
        <div>
          <h2>Batch Assignment Planner</h2>
          <p>Assign multiple live tickets or to-do tasks to one employee.</p>
        </div>
        <label className="dashboard-control dashboard-control--compact">
          <span>Work Type</span>
          <select value={type} onChange={(event) => setType(event.target.value)}>
            <option value="ticket">Tickets</option>
            <option value="todo">To-Do</option>
          </select>
        </label>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="forms-editor__grid">
          <label className="dashboard-control">
            <span>Assign To</span>
            <select value={employeeId} onChange={(event) => setEmployeeId(event.target.value)}>
              <option value="">Select employee</option>
              {users.map((user) => {
                const id = user['Employee ID'] || user.id;
                return <option key={id} value={id}>{user['Employee Name'] || user.name} ({id})</option>;
              })}
            </select>
          </label>
        </div>

        <div className="batch-assignment-list">
          {rows.map((row, index) => (
            <div className="batch-assignment-row" key={`batch-row-${index}`}>
              <label className="dashboard-control batch-assignment-row__description">
                <span>Task {index + 1}</span>
                <textarea rows="2" value={row.description} onChange={(event) => updateRow(index, { description: event.target.value })} placeholder="Describe the work" />
              </label>
              {type === 'ticket' ? (
                <label className="dashboard-control">
                  <span>Client</span>
                  <select value={row.clientId} onChange={(event) => updateRow(index, { clientId: event.target.value })}>
                    <option value="">Internal / General</option>
                    {clients.map((client) => {
                      const id = client.Client_Id || client.id;
                      return <option key={id} value={id}>{client['Client Name'] || client.name}</option>;
                    })}
                  </select>
                </label>
              ) : (
                <label className="dashboard-control">
                  <span>Due Date</span>
                  <input type="date" value={row.planDate} onChange={(event) => updateRow(index, { planDate: event.target.value })} />
                </label>
              )}
              <label className="dashboard-control">
                <span>Priority</span>
                <select value={row.priority} onChange={(event) => updateRow(index, { priority: event.target.value })}>
                  <option>Normal</option>
                  <option>Urgent</option>
                  <option>Super Urgent</option>
                  <option>Low</option>
                </select>
              </label>
              <label className="dashboard-control">
                <span>TAT (minutes)</span>
                <input type="number" min="0" value={row.tat} onChange={(event) => updateRow(index, { tat: event.target.value })} placeholder="Optional" />
              </label>
              <button className="icon-action icon-action--danger" type="button" onClick={() => removeRow(index)} disabled={rows.length === 1} aria-label={`Remove task ${index + 1}`} title="Remove task">×</button>
            </div>
          ))}
        </div>

        {feedback ? <div className={`dashboard-banner dashboard-banner--${feedback.tone}`}>{feedback.text}</div> : null}

        <div className="batch-assignment-actions">
          <button className="inline-action" type="button" onClick={() => setRows((current) => [...current, blankRow()])}>Add Row</button>
          <button className="primary-action" type="submit" disabled={saving}>{saving ? 'Assigning...' : 'Assign Batch Work'}</button>
        </div>
      </form>
    </article>
  );
}
