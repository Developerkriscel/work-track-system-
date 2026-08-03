import { StatusPill } from '@/components/common/StatusPill';
import { clientStatusTone } from '@/features/clients-portal/services/clientsPresentation';

export function ClientsPortalTable({
  clients,
  allClientsCount,
  isAdmin,
  submitting,
  onOpenDetails,
  onOpenEditor,
  onRequestDeactivate
}) {
  return (
    <article className="migration-panel migration-panel--full">
      <div className="migration-panel__row">
        <h2>Clients List</h2>
        <StatusPill tone="info">{clients.length} of {allClientsCount}</StatusPill>
      </div>

      <div className="dashboard-table-wrap">
        <table className="dashboard-table approval-table">
          <thead>
            <tr>
              <th>Client ID</th>
              <th>Client Name</th>
              <th>Mobile Number</th>
              <th>Client Email ID</th>
              <th>Status</th>
              <th>Services</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {clients.length ? (
              clients.map((client) => (
                <tr key={client.Client_Id}>
                  <td data-label="Client ID">
                    <button type="button" className="ticket-id-chip ticket-id-chip--button" onClick={() => onOpenDetails(client)}>
                      {client.Client_Id}
                    </button>
                  </td>
                  <td data-label="Client Name">{client['Client Name'] || '-'}</td>
                  <td data-label="Mobile Number">{client['Mobile Number'] || '-'}</td>
                  <td data-label="Client Email ID" className="approval-table__copy">{client['Client Email ID'] || '-'}</td>
                  <td data-label="Status">
                    <StatusPill tone={clientStatusTone(client.Status)}>{client.Status || 'Active'}</StatusPill>
                  </td>
                  <td data-label="Services" className="approval-table__copy">{client.Services || '-'}</td>
                  <td data-label="Action">
                    {isAdmin ? (
                      <div className="approval-action-stack client-action-stack">
                        <button type="button" className="ticket-action-btn ticket-action-btn--done" onClick={() => onOpenEditor(client)}>
                          Edit
                        </button>
                        <button
                          type="button"
                          className="ticket-action-btn ticket-action-btn--delete"
                          disabled={submitting}
                          onClick={() => {
                            onRequestDeactivate(client);
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    ) : (
                      <span className="status-pill status-pill--neutral">View Only</span>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="7" className="dashboard-table__empty">
                  No clients found for the selected filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </article>
  );
}
