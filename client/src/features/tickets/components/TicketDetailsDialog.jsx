import { useState } from 'react';
import { AppModal, AlertDialog } from '@/components/modals';
import { openProtectedFile, toPreviewUrl, toPreviewUrls } from '@/lib/fileLinks';
import { formatPlanDate, formatTicketAssignee } from '@/features/tickets/services/ticketPresentation';

function normalizeExternalUrl(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
}

export function TicketDetailsDialog({ ticket, users = [], onClose }) {
  const [alertMsg, setAlertMsg] = useState(null);
  const referenceLink = normalizeExternalUrl(ticket?.['Reference Link'] || ticket?.Link || ticket?.URL || ticket?.Url || ticket?.link || ticket?.url);
  const attachments = Array.from(
    new Set([
      ...toPreviewUrls(ticket?.Attachment),
      ...toPreviewUrls(ticket?.Attachments),
      ...toPreviewUrls(ticket?.['Closing Attachment'])
    ])
  );
  const isClient = ticket?._isClientOrigin || ticket?.Source === 'Client Portal' || ticket?.Origin === 'Client' || ticket?.['Client Ticket'] === 'Yes';

  return (
    <AppModal title={`Ticket Details ${ticket?.['Ticket ID'] || ''}`} onClose={onClose} width="680px">
      <div className="ticket-details-grid">
        <div><strong>Client</strong><span>{ticket?.Name || '-'}</span></div>
        <div>
          <strong>Assigned To</strong>
          {(() => {
            const assignee = formatTicketAssignee(ticket, users);
            return (
              <span className="ticket-assignee-cell">
                <strong>{assignee.id}</strong>
                {assignee.name ? <span>{assignee.name}</span> : null}
              </span>
            );
          })()}
        </div>
        <div><strong>Status</strong><span>{ticket?.Status || '-'}</span></div>
        <div><strong>Priority</strong><span>{ticket?.Priority || '-'}</span></div>
        <div><strong>TAT</strong><span>{ticket?.TAT || '-'}</span></div>
        {isClient ? (
          <>
            <div><strong>Created Date</strong><span>{formatPlanDate(ticket?.Timestamp || ticket?.Date || ticket?.createdAt)}</span></div>
            <div><strong>Expected Date</strong><span>{formatPlanDate(ticket?.['Plan Date'] || ticket?.completionDate)}</span></div>
          </>
        ) : (
          <div><strong>Plan Date</strong><span>{formatPlanDate(ticket?.['Plan Date']) || '-'}</span></div>
        )}
        <div className="ticket-details-grid__full"><strong>Description</strong><span className="ticket-details-copy">{ticket?.['Task Description'] || '-'}</span></div>
        <div className="ticket-details-grid__full">
          <strong>Reference Link</strong>
          <span>
            {referenceLink ? (
              <a href={referenceLink} target="_blank" rel="noreferrer">
                Open Link
              </a>
            ) : '-'}
          </span>
        </div>
        <div className="ticket-details-grid__full"><strong>Remarks / History</strong><span className="ticket-details-copy">{ticket?.Remarks || '-'}</span></div>
        <div className="ticket-details-grid__full">
          <strong>Attachments</strong>
          <span>
            {attachments.length ? attachments.map((url, index) => (
              <a
                key={`${url}-${index}`}
                href={toPreviewUrl(url)}
                target="_blank"
                rel="noreferrer"
                onClick={async (event) => {
                  event.preventDefault();
                  try {
                    await openProtectedFile(url);
                  } catch (error) {
                    setAlertMsg(error.message || 'Attachment could not be opened.');
                  }
                }}
              >
                Attachment {index + 1}
              </a>
            )) : '-'}
          </span>
        </div>
      </div>
      <AlertDialog message={alertMsg} onClose={() => setAlertMsg(null)} />
    </AppModal>
  );
}
