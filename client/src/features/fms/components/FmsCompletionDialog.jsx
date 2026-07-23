import { useState } from 'react';
import { AppModal } from '@/components/modals';

export function FmsCompletionDialog({ task, saving, onClose, onSubmit }) {
  const [remarks, setRemarks] = useState('Completed from Work Track System');

  function handleSubmit(event) {
    event.preventDefault();
    onSubmit(remarks);
  }

  return (
    <AppModal title={`Complete FMS Task ${task?.rowId || task?.ID || ''}`} onClose={onClose} width="560px">
      <form className="ticket-form-grid" onSubmit={handleSubmit}>
        <label className="dashboard-control forms-editor__full">
          <span>Completion Remarks</span>
          <textarea rows="4" value={remarks} onChange={(event) => setRemarks(event.target.value)} />
        </label>
        <div className="ticket-form-actions">
          <button type="button" className="attendance-cta attendance-cta--gray" onClick={onClose}>Cancel</button>
          <button type="submit" className="attendance-cta attendance-cta--green" disabled={saving}>{saving ? 'Saving...' : 'Mark Done'}</button>
        </div>
      </form>
    </AppModal>
  );
}
