import { useState } from 'react';
import { AppModal } from '@/components/modals';

export function TicketActionDialog({ ticket, action, saving, onClose, onSubmit }) {
  const [remarks, setRemarks] = useState('');
  const [files, setFiles] = useState([]);
  const title = action === 'Approve' ? 'Approve Ticket' : action === 'Rework' ? 'Send Ticket for Rework' : action === 'Completed' ? 'Complete Ticket' : 'Pause Ticket';

  function submit(event) {
    event.preventDefault();
    if (!remarks.trim()) return;
    const readers = files.map((file) => new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve({ base64: String(reader.result).split(',')[1], mimeType: file.type, fileName: file.name });
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    }));
    Promise.all(readers).then((attachments) => onSubmit(remarks.trim(), attachments.filter(Boolean)));
  }

  return (
    <AppModal title={`${title} ${ticket?.['Ticket ID'] || ''}`} onClose={onClose} width="560px">
      <form className="ticket-form-grid" onSubmit={submit}>
        <label className="dashboard-control ticket-form-grid__full">
          <span>Remarks *</span>
          <textarea rows="5" value={remarks} onChange={(event) => setRemarks(event.target.value)} required placeholder="Enter remarks or instructions" />
        </label>
        {action === 'Completed' || action === 'Paused' ? <label className="dashboard-control ticket-form-grid__full"><span>Attachments (optional)</span><input type="file" multiple onChange={(event) => setFiles(Array.from(event.target.files || []))} /></label> : null}
        <div className="ticket-form-actions ticket-form-grid__full" style={{ justifyContent: 'flex-end', marginTop: '12px' }}>
          <button type="button" className="attendance-cta attendance-cta--gray" onClick={onClose}>Cancel</button>
          <button type="submit" className="attendance-cta attendance-cta--blue" disabled={saving}>{saving ? 'Saving...' : title}</button>
        </div>
      </form>
    </AppModal>
  );
}
