import { StatusPill } from '@/components/common/StatusPill';
import { clientStatusTone } from '@/features/clients-portal/services/clientsPresentation';

export function ClientDetailsCard({ client, onClose }) {
  if (!client) return null;

  return (
    <article className="migration-panel migration-panel--full">
      <div className="migration-panel__row">
        <h2>Client Profile Details</h2>
        <button type="button" className="attendance-cta attendance-cta--red" onClick={onClose}>
          Close
        </button>
      </div>

      <div className="client-details-grid">
        <div>
          <span className="kv-grid__label">Client ID</span>
          <strong>{client.Client_Id || '-'}</strong>
        </div>
        <div>
          <span className="kv-grid__label">Status</span>
          <StatusPill tone={clientStatusTone(client.Status)}>{client.Status || 'Active'}</StatusPill>
        </div>
        <div>
          <span className="kv-grid__label">Client Name</span>
          <strong>{client['Client Name'] || '-'}</strong>
        </div>
        <div>
          <span className="kv-grid__label">Mobile Number</span>
          <strong>{client['Mobile Number'] || '-'}</strong>
        </div>
        <div>
          <span className="kv-grid__label">Email ID</span>
          <strong>{client['Client Email ID'] || '-'}</strong>
        </div>
        <div>
          <span className="kv-grid__label">Detail Shared</span>
          <strong>{client['Detail Shared'] || '-'}</strong>
        </div>
        <div className="client-details-grid__full">
          <span className="kv-grid__label">Address</span>
          <strong>{client.Address || '-'}</strong>
        </div>
        <div className="client-details-grid__full">
          <span className="kv-grid__label">Services</span>
          <strong>{client.Services || '-'}</strong>
        </div>
        <div>
          <span className="kv-grid__label">Password</span>
          <strong>{client.Password || '-'}</strong>
        </div>
      </div>
    </article>
  );
}
