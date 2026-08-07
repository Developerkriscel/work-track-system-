import { StatusPill } from '@/components/common/StatusPill';
import { formatManagementCurrency, managementStatusTone } from '@/features/management-dashboard/services/managementDashboardPresentation';

import { ClientExplorerCharts } from './ClientExplorerCharts';

export function ClientExplorerSection({ clients, selectedClientId, onClientChange, selectedClient, explorer }) {
  return (
    <>
      <article className="migration-panel migration-panel--full">
        <div className="migration-panel__row">
          <h2>Client Explorer</h2>
          <label className="dashboard-control">
            <span>Select Client</span>
            <select value={selectedClientId} onChange={(event) => onClientChange(event.target.value)}>
              {clients.map((client) => (
                <option key={client.Client_Id || client.id} value={client.Client_Id || client.id}>
                  {client['Client Name'] || client.name} ({client.Client_Id || client.id})
                </option>
              ))}
            </select>
          </label>
        </div>
      </article>

      <ClientExplorerCharts explorer={explorer} />

      <div className="migration-grid">
        <article className="migration-panel">
          <div className="migration-panel__row">
            <h2>Client Tasks</h2>
            <StatusPill tone="info">{explorer.tasks.length} rows</StatusPill>
          </div>
          <div className="dashboard-table-wrap">
            <table className="dashboard-table approval-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>User</th>
                  <th>Description</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {explorer.tasks.length ? explorer.tasks.slice(0, 10).map((row) => (
                  <tr key={row.ID}>
                    <td data-label="ID"><span className="ticket-id-chip">{row.ID || '-'}</span></td>
                    <td data-label="User">{row.User || '-'}</td>
                    <td data-label="Description" className="approval-table__copy">{row.Description || '-'}</td>
                    <td data-label="Status"><StatusPill tone={managementStatusTone(row.Status)}>{row.Status || '-'}</StatusPill></td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan="4" className="dashboard-table__empty">No client tasks found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </article>

        <article className="migration-panel">
          <div className="migration-panel__row">
            <h2>Bandwidth by Owner</h2>
            <StatusPill tone="info">{explorer.bandwidth.length} owners</StatusPill>
          </div>
          <div className="dashboard-table-wrap">
            <table className="dashboard-table approval-table">
              <thead>
                <tr>
                  <th>Owner</th>
                  <th>Task Count</th>
                  <th>Total TAT</th>
                </tr>
              </thead>
              <tbody>
                {explorer.bandwidth.length ? explorer.bandwidth.map((row) => (
                  <tr key={row.owner}>
                    <td data-label="Owner">{row.owner}</td>
                    <td data-label="Task Count">{row.count}</td>
                    <td data-label="Total TAT">{row.tat} mins</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan="3" className="dashboard-table__empty">No bandwidth data found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </article>
      </div>

      <article className="migration-panel migration-panel--full">
        <div className="migration-panel__row">
          <h2>Invoices</h2>
          <StatusPill tone="info">{explorer.invoices.length} rows</StatusPill>
        </div>
        <div className="dashboard-table-wrap">
          <table className="dashboard-table reports-premium-table">
            <thead>
              <tr>
                <th>Invoice ID</th>
                <th>Status</th>
                <th>Outstanding</th>
              </tr>
            </thead>
            <tbody>
              {explorer.invoices.length ? explorer.invoices.map((row) => (
                <tr key={row.InvoiceID || row._id}>
                  <td data-label="Invoice ID"><span className="ticket-id-chip">{row.InvoiceID || row._id || '-'}</span></td>
                  <td data-label="Status"><StatusPill tone={managementStatusTone(row.Status)}>{row.Status || '-'}</StatusPill></td>
                  <td data-label="Outstanding">{formatManagementCurrency(row.Outstanding)}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="3" className="dashboard-table__empty">No invoices found for this client.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </article>
    </>
  );
}
