import { AppModal } from '@/components/modals';

function links(value) {
  return String(value || '').split(',').map((item) => item.trim()).filter(Boolean);
}

export function TicketDetailsDialog({ ticket, onClose }) {
  const attachments = [...links(ticket?.Attachment), ...links(ticket?.['Closing Attachment'])];
  return (
    <AppModal title={`Ticket Details ${ticket?.['Ticket ID'] || ''}`} onClose={onClose} width="680px">
      <div className="ticket-details-grid">
        <div><strong>Client</strong><span>{ticket?.Name || '-'}</span></div>
        <div><strong>Assigned To</strong><span>{ticket?.['Employee Name'] || ticket?.['Employee ID'] || '-'}</span></div>
        <div><strong>Status</strong><span>{ticket?.Status || '-'}</span></div>
        <div><strong>Priority</strong><span>{ticket?.Priority || '-'}</span></div>
        <div><strong>TAT</strong><span>{ticket?.TAT || '-'}</span></div>
        <div><strong>Plan Date</strong><span>{ticket?.['Plan Date'] || '-'}</span></div>
        <div className="ticket-details-grid__full"><strong>Description</strong><span className="ticket-details-copy">{ticket?.['Task Description'] || '-'}</span></div>
        <div className="ticket-details-grid__full"><strong>Remarks / History</strong><span className="ticket-details-copy">{ticket?.Remarks || '-'}</span></div>
        <div className="ticket-details-grid__full"><strong>Attachments</strong><span>{attachments.length ? attachments.map((url, index) => <a key={`${url}-${index}`} href={url} target="_blank" rel="noreferrer">Attachment {index + 1}</a>) : '-'}</span></div>
      </div>
    </AppModal>
  );
}
