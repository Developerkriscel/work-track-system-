import { useState } from 'react';
import { AppModal } from '@/components/modals';

export function TicketScheduleDialog({ ticket, saving, onClose, onSubmit }) {
  const [tat, setTat] = useState(ticket?.TAT || '');
  const [planDate, setPlanDate] = useState(ticket?.['Plan Date'] || '');
  const [reason, setReason] = useState('Adjusted from Work Track System');

  function handleSubmit(event) {
    event.preventDefault();
    if (tat && planDate) onSubmit(tat, planDate, reason);
  }

  return (
    <AppModal title={`Update Schedule ${ticket?.['Ticket ID'] || ''}`} onClose={onClose} width="560px">
      <form className="ticket-form-grid" onSubmit={handleSubmit}>
        <label className="dashboard-control">
          <span>TAT (minutes)</span>
          <input type="number" min="0" required value={tat} onChange={(event) => setTat(event.target.value)} />
        </label>
        <label className="dashboard-control">
          <span>Plan Date</span>
          <input type="date" required value={planDate} onChange={(event) => setPlanDate(event.target.value)} />
        </label>
        <label className="dashboard-control ticket-form-grid__full">
          <span>Reason</span>
          <textarea rows="3" value={reason} onChange={(event) => setReason(event.target.value)} />
        </label>
        <div className="ticket-form-actions ticket-form-grid__full" style={{ justifyContent: 'flex-end', marginTop: '12px' }}>
          <button type="button" className="attendance-cta attendance-cta--gray" onClick={onClose}>Cancel</button>
          <button type="submit" className="attendance-cta attendance-cta--blue" disabled={saving}>{saving ? 'Saving...' : 'Update Schedule'}</button>
        </div>
      </form>
    </AppModal>
  );
}
