import { useState } from 'react';
import { AppModal } from '@/components/modals';

export function ClientTicketActionDialog({ action, saving, onClose, onSubmit }) {
  const [remarks, setRemarks] = useState(action?.type === 'approve' ? 'Approved from client portal.' : 'Reopened from client portal.');
  const title = action?.type === 'approve' ? 'Approve Ticket' : 'Reopen Ticket';

  function handleSubmit(event) {
    event.preventDefault();
    onSubmit(remarks);
  }

  return (
    <AppModal title={`${title}: ${action?.ticketId || ''}`} onClose={onClose} width="560px">
      <form className="ticket-form-grid" onSubmit={handleSubmit}>
        <label className="dashboard-control forms-editor__full"><span>Remarks</span><textarea rows="4" value={remarks} onChange={(event) => setRemarks(event.target.value)} required /></label>
        <div className="ticket-form-actions forms-editor__full"><button type="button" className="attendance-cta attendance-cta--gray" onClick={onClose}>Cancel</button><button type="submit" className="attendance-cta attendance-cta--blue" disabled={saving}>{saving ? 'Saving...' : title}</button></div>
      </form>
    </AppModal>
  );
}
