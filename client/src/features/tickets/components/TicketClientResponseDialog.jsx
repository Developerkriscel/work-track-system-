import { useState } from 'react';
import { AppModal } from '@/components/modals';

export function TicketClientResponseDialog({ ticket, saving, onClose, onSubmit }) {
  const [response, setResponse] = useState('');
  const [planDate, setPlanDate] = useState(ticket?.['Plan Date'] || '');
  const [file, setFile] = useState(null);
  function submit(event) {
    event.preventDefault();
    if (!response.trim()) return;
    if (!file) return onSubmit(response.trim(), planDate, null);
    const reader = new FileReader();
    reader.onload = () => onSubmit(response.trim(), planDate, { base64: String(reader.result).split(',')[1], mimeType: file.type, fileName: file.name });
    reader.readAsDataURL(file);
  }
  return (
    <AppModal title={`Client Response ${ticket?.['Ticket ID'] || ''}`} onClose={onClose} width="560px">
      <form className="ticket-form-grid" onSubmit={submit}>
        <label className="dashboard-control ticket-form-grid__full"><span>Response *</span><textarea rows="5" value={response} onChange={(event) => setResponse(event.target.value)} required placeholder="Enter the client response" /></label>
        <label className="dashboard-control"><span>New Plan Date</span><input type="date" value={planDate} onChange={(event) => setPlanDate(event.target.value)} /></label>
        <label className="dashboard-control" style={{ gridColumn: 'span 2' }}><span>Attachment</span><input type="file" onChange={(event) => setFile(event.target.files?.[0] || null)} /></label>
        <div className="ticket-form-actions ticket-form-grid__full" style={{ justifyContent: 'flex-end', marginTop: '12px' }}><button type="button" className="attendance-cta attendance-cta--gray" onClick={onClose}>Cancel</button><button type="submit" className="attendance-cta attendance-cta--blue" disabled={saving}>{saving ? 'Saving...' : 'Save Response'}</button></div>
      </form>
    </AppModal>
  );
}
