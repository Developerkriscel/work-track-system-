import { useState } from 'react';
import { AppModal } from '@/components/modals';

export function TicketReassignDialog({ ticket, users, saving, onClose, onSubmit, mode = 'user' }) {
  const [target, setTarget] = useState('');
  const [remarks, setRemarks] = useState('');
  const isClientMode = mode === 'client';

  function handleSubmit(event) {
    event.preventDefault();
    if (isClientMode) {
      onSubmit('client', remarks);
      return;
    }
    if (target) onSubmit(target, remarks);
  }

  return (
    <AppModal title={`${isClientMode ? 'Send To Client' : 'Reassign'} ${ticket?.['Ticket ID'] || 'Ticket'}`} onClose={onClose} width="560px">
      <form className="ticket-form-grid" onSubmit={handleSubmit}>
        {!isClientMode ? (
          <label className="dashboard-control ticket-form-grid__full">
            <span>Assign To</span>
            <select value={target} onChange={(event) => setTarget(event.target.value)} required>
              <option value="">Select employee</option>
              {users.map((user) => {
                const id = user['Employee ID'] || user.id;
                return <option key={id} value={id}>{user['Employee Name'] || user.name} ({id})</option>;
              })}
            </select>
          </label>
        ) : null}
        <label className="dashboard-control ticket-form-grid__full">
          <span>{isClientMode ? 'Reason' : 'Remarks'}</span>
          <textarea
            rows="3"
            value={remarks}
            onChange={(event) => setRemarks(event.target.value)}
            placeholder={isClientMode ? 'Reason for sending this ticket to client' : 'Optional reassignment note'}
          />
        </label>
        <div className="ticket-form-actions ticket-form-grid__full" style={{ justifyContent: 'flex-end', marginTop: '12px' }}>
          <button type="button" className="attendance-cta attendance-cta--gray" onClick={onClose}>Cancel</button>
          <button type="submit" className="attendance-cta attendance-cta--blue" disabled={saving}>{saving ? 'Saving...' : isClientMode ? 'Send To Client' : 'Reassign Ticket'}</button>
        </div>
      </form>
    </AppModal>
  );
}
