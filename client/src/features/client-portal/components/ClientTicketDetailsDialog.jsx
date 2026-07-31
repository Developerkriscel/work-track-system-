import { useState } from 'react';
import { AlertDialog } from '@/components/modals/AlertDialog';
import { StatusPill } from '@/components/common/StatusPill';
import { AppModal } from '@/components/modals';
import { MessageCircle } from '@/components/common/icons';
import { openProtectedFile, toPreviewUrl, toPreviewUrls } from '@/lib/fileLinks';

function attachmentLinks(attachmentValue) {
  return toPreviewUrls(attachmentValue);
}

function renderRemarks(remarks) {
  return String(remarks || '')
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function ClientTicketDetailsDialog({
  formatDate,
  onClose,
  onOpenDiscussion,
  priorityToneResolver,
  statusLabelResolver,
  ticket,
  toneResolver
}) {
  const [alertMsg, setAlertMsg] = useState(null);
  if (!ticket) return null;

  const attachments = Array.from(
    new Set([
      ...attachmentLinks(ticket.Attachment),
      ...attachmentLinks(ticket.Attachments),
      ...attachmentLinks(ticket['Closing Attachment'])
    ])
  );
  const remarks = renderRemarks(ticket.Remarks);
  const displayStatus = statusLabelResolver(ticket);

  return (
    <AppModal title={`Ticket: ${ticket['Ticket ID'] || ticket.ID || '-'}`} onClose={onClose} width="760px">
      <div className="client-ticket-details">
        <div className="client-ticket-details__grid">
          <div>
            <span className="kv-grid__label">Status</span>
            <StatusPill tone={toneResolver(displayStatus)}>{displayStatus}</StatusPill>
          </div>
          <div>
            <span className="kv-grid__label">Priority</span>
            <strong className={`client-ticket-priority client-ticket-priority--${priorityToneResolver(ticket.Priority)}`}>
              {ticket.Priority || 'N/A'}
            </strong>
          </div>
          <div>
            <span className="kv-grid__label">Category</span>
            <strong>{ticket['Task Category'] || ticket.Category || 'N/A'}</strong>
          </div>
          <div>
            <span className="kv-grid__label">Given Date</span>
            <strong>{formatDate(ticket.Timestamp || ticket.Date || ticket['Plan Date'])}</strong>
          </div>
        </div>

        <div className="client-ticket-details__section">
          <span className="kv-grid__label">Description</span>
          <div className="client-ticket-details__copy">
            {ticket['Task Description'] || ticket.Description || '-'}
          </div>
        </div>

        {attachments.length ? (
          <div className="client-ticket-details__section">
            <span className="kv-grid__label">Attachments / Files</span>
            <div className="client-ticket-details__attachments">
                {attachments.map((link, index) => (
                <a
                  key={`${link}-${index}`}
                  href={toPreviewUrl(link)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-action forms-open-link"
                  onClick={async (event) => {
                    event.preventDefault();
                    try {
                      await openProtectedFile(link, { preferClient: true });
                    } catch (error) {
                      setAlertMsg(error.message || 'File could not be opened.');
                    }
                  }}
                >
                  View File {index + 1}
                </a>
              ))}
            </div>
          </div>
        ) : null}

        {remarks.length ? (
          <div className="client-ticket-details__section">
            <span className="kv-grid__label">Remarks & Updates</span>
            <div className="client-ticket-details__remarks">
              {remarks.map((item, index) => (
                <p key={`${item}-${index}`}>{item.replace(/\[\[|\]\]/g, '').trim()}</p>
              ))}
            </div>
          </div>
        ) : null}

        <div className="ticket-form-actions client-ticket-details__actions">
          <button type="button" className="attendance-cta attendance-cta--gray" onClick={onClose}>
            Close
          </button>
          <button type="button" className="attendance-cta attendance-cta--blue" onClick={() => onOpenDiscussion(ticket)}>
            <MessageCircle className="client-ticket-details__discussion-icon" />
            <span>Open Discussion</span>
          </button>
        </div>
      </div>
      <AlertDialog message={alertMsg} onClose={() => setAlertMsg(null)} />
    </AppModal>
  );
}
