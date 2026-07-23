import { useState } from 'react';
import { AppModal } from '@/components/modals';

export function TicketApprovalTransferDialog({ ticket, users, saving, onClose, onSubmit }) {
  const [target, setTarget] = useState('');
  const [remarks, setRemarks] = useState('');
  return (
    <AppModal title={`Transfer Approval ${ticket?.['Ticket ID'] || ''}`} onClose={onClose} width="560px">
      <form className="ticket-form-grid" onSubmit={(event) => { event.preventDefault(); if (target && remarks.trim()) onSubmit(target, remarks.trim()); }}>
        <label className="dashboard-control ticket-form-grid__full"><span>New Approver *</span><select value={target} onChange={(event) => setTarget(event.target.value)} required><option value="">Select employee</option>{users.map((user) => { const id = user['Employee ID'] || user.id; return <option key={id} value={id}>{user['Employee Name'] || user.name} ({id})</option>; })}</select></label>
        <label className="dashboard-control ticket-form-grid__full"><span>Remarks *</span><textarea rows="4" value={remarks} onChange={(event) => setRemarks(event.target.value)} required /></label>
        <div className="ticket-form-actions ticket-form-grid__full" style={{ justifyContent: 'flex-end', marginTop: '12px' }}><button type="button" className="attendance-cta attendance-cta--gray" onClick={onClose}>Cancel</button><button type="submit" className="attendance-cta attendance-cta--blue" disabled={saving}>{saving ? 'Saving...' : 'Transfer Approval'}</button></div>
      </form>
    </AppModal>
  );
}
