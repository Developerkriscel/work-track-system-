import { useState } from 'react';
import { AppModal } from '@/components/modals';

export function TodoEditDialog({ row, saving, onClose, onSubmit }) {
  const [form, setForm] = useState({
    task: row?.Task || row?.Description || '',
    priority: row?.Priority || 'Medium',
    dueDate: row?.['Due Date'] || row?.Date || '',
    tat: row?.TAT || ''
  });

  function update(patch) {
    setForm((current) => ({ ...current, ...patch }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    onSubmit(form);
  }

  return (
    <AppModal title={`Edit To-Do ${row?.['Task ID'] || row?.TodoID || ''}`} onClose={onClose} width="620px">
      <form className="forms-editor__grid" onSubmit={handleSubmit}>
        <label className="dashboard-control forms-editor__full"><span>Task</span><textarea rows="3" required value={form.task} onChange={(event) => update({ task: event.target.value })} /></label>
        <label className="dashboard-control"><span>Priority</span><select value={form.priority} onChange={(event) => update({ priority: event.target.value })}><option>Low</option><option>Medium</option><option>High</option></select></label>
        <label className="dashboard-control"><span>Due Date</span><input type="date" value={form.dueDate} onChange={(event) => update({ dueDate: event.target.value })} /></label>
        <label className="dashboard-control"><span>TAT (minutes)</span><input type="number" min="0" value={form.tat} onChange={(event) => update({ tat: event.target.value })} /></label>
        <div className="ticket-form-actions forms-editor__full"><button type="button" className="attendance-cta attendance-cta--gray" onClick={onClose}>Cancel</button><button type="submit" className="attendance-cta attendance-cta--blue" disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</button></div>
      </form>
    </AppModal>
  );
}
