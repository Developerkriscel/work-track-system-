import { useMemo, useState, useEffect, useRef } from 'react';
import { AppModal } from '@/components/modals';

export function ClientTicketChatDialog({ clientName, messages, onClose, onSend, sending, ticketId }) {
  const [draft, setDraft] = useState('');
  const messagesEndRef = useRef(null);

  const orderedMessages = useMemo(
    () => [...(messages || [])].sort((left, right) => (Date.parse(left.Timestamp) || 0) - (Date.parse(right.Timestamp) || 0)),
    [messages]
  );

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [orderedMessages]);

  const handleSend = async (event) => {
    event.preventDefault();
    if (!draft.trim()) return;
    const result = await onSend(draft.trim());
    if (result?.success !== false) {
      setDraft('');
    }
  };

  return (
    <AppModal title={`Discussion For Task ${ticketId}`} onClose={onClose} width="760px">
      <div className="client-ticket-chat">
        <div className="client-ticket-chat__history">
          {orderedMessages.length ? (
            orderedMessages.map((message) => {
              const isClient = (message.Sender || '').trim() === clientName;
              return (
                <div
                  key={message.MessageID || `${message.Timestamp}-${message.Sender}`}
                  className={`client-ticket-chat__row${isClient ? ' client-ticket-chat__row--client' : ''}`}
                >
                  <div className={`client-ticket-chat__bubble${isClient ? ' client-ticket-chat__bubble--client' : ' client-ticket-chat__bubble--team'}`}>
                    <strong>{message.Sender || 'User'}</strong>
                    <p>{message.Message || ''}</p>
                    <span>{message.Timestamp ? new Date(message.Timestamp).toLocaleString() : '-'}</span>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="dashboard-table__empty">No messages yet. Start the conversation.</div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <form className="client-ticket-chat__composer" onSubmit={handleSend}>
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Type your message..."
          />
          <button type="submit" className="attendance-cta attendance-cta--blue" disabled={sending || !draft.trim()}>
            {sending ? 'Sending...' : 'Send'}
          </button>
        </form>
      </div>
    </AppModal>
  );
}
