import { useEffect, useState } from 'react';
import { AppModal } from '@/components/modals';

export function TicketChatDialog({ ticket, messages, loading, sending, onClose, onSend }) {
  const [draft, setDraft] = useState('');

  useEffect(() => {
    setDraft('');
  }, [ticket?.['Ticket ID']]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!draft.trim()) return;
    const result = await onSend(draft.trim());
    if (result?.success !== false) setDraft('');
  }

  return (
    <AppModal title={`Discussion For ${ticket?.['Ticket ID'] || 'Ticket'}`} onClose={onClose} width="760px">
      <div className="client-ticket-chat">
        <div className="client-ticket-chat__history">
          {loading ? <div className="dashboard-table__empty">Loading discussion...</div> : null}
          {!loading && !messages.length ? <div className="dashboard-table__empty">No messages yet.</div> : null}
          {!loading ? messages.map((message) => (
            <div className="client-ticket-chat__row" key={message.MessageID || `${message.Timestamp}-${message.Sender}`}>
              <div className="client-ticket-chat__bubble client-ticket-chat__bubble--team">
                <strong>{message.Sender || 'User'}</strong>
                <p>{message.Message || '-'}</p>
                <span>{message.Timestamp ? new Date(message.Timestamp).toLocaleString() : '-'}</span>
              </div>
            </div>
          )) : null}
        </div>
        <form className="client-ticket-chat__composer" onSubmit={handleSubmit}>
          <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Type your message..." />
          <button type="submit" className="attendance-cta attendance-cta--blue" disabled={sending || !draft.trim()}>
            {sending ? 'Sending...' : 'Send'}
          </button>
        </form>
      </div>
    </AppModal>
  );
}
