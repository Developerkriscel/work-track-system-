import { useState } from 'react';
import { AppModal } from '@/components/modals';

export function ClientTicketResponseDialog({ onClose, onSubmit, submitting, ticketId }) {
  const [remarks, setRemarks] = useState('');
  const [file, setFile] = useState(null);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!remarks.trim()) return;
    const result = await onSubmit(remarks.trim(), file);
    if (result?.success !== false) {
      onClose();
    }
  };

  return (
    <AppModal title={`Respond To Ticket ${ticketId}`} onClose={onClose} width="640px">
      <form className="client-ticket-response" onSubmit={handleSubmit}>
        <label className="dashboard-control forms-editor__full">
          <span>Your Message / Response</span>
          <textarea
            value={remarks}
            onChange={(event) => setRemarks(event.target.value)}
            placeholder="Provide the details or clarification requested..."
          />
        </label>

        <label className="dashboard-control forms-editor__full">
          <span>Add Attachment</span>
          <input type="file" onChange={(event) => setFile(event.target.files?.[0] || null)} />
        </label>

        <div className="ticket-form-actions">
          <button type="button" className="attendance-cta attendance-cta--gray" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button type="submit" className="attendance-cta attendance-cta--blue" disabled={submitting || !remarks.trim()}>
            {submitting ? 'Submitting...' : 'Submit Response'}
          </button>
        </div>
      </form>
    </AppModal>
  );
}
