import { StatusPill } from '@/components/common/StatusPill';
import { formatReportDate, toneForReportStatus } from '@/features/reports/services/reportsPresentation';

export function TicketReportSection({
  tickets,
  ticketPriorities,
  ticketCategories,
  ticketFilters,
  onTicketFiltersChange
}) {
  return (
    <>
      <article className="migration-panel migration-panel--full">
        <div className="approval-filter-grid">
          <label className="dashboard-control">
            <span>Priority</span>
            <select
              value={ticketFilters.priority}
              onChange={(event) => onTicketFiltersChange((current) => ({ ...current, priority: event.target.value }))}
            >
              <option value="">All Priorities</option>
              {ticketPriorities.map((priority) => (
                <option key={priority} value={priority}>
                  {priority}
                </option>
              ))}
            </select>
          </label>

          <label className="dashboard-control">
            <span>Category</span>
            <select
              value={ticketFilters.category}
              onChange={(event) => onTicketFiltersChange((current) => ({ ...current, category: event.target.value }))}
            >
              <option value="">All Categories</option>
              {ticketCategories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>
        </div>
      </article>

      <article className="migration-panel migration-panel--full">
        <div className="migration-panel__row">
          <h2>Tickets Report</h2>
          <StatusPill tone="info">{tickets.length} rows</StatusPill>
        </div>

        <div className="dashboard-table-wrap">
          <table className="dashboard-table approval-table">
            <thead>
              <tr>
                <th>Ticket ID</th>
                <th>Name</th>
                <th>Description</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Plan Date</th>
                <th>Duration</th>
              </tr>
            </thead>
            <tbody>
              {tickets.length ? (
                tickets.map((item) => (
                  <tr key={item['Ticket ID'] || item._id}>
                    <td><span className="ticket-id-chip">{item['Ticket ID'] || '-'}</span></td>
                    <td>{item.Name || item['Employee Name'] || '-'}</td>
                    <td className="approval-table__copy">{item['Task Description'] || item.Description || '-'}</td>
                    <td>{item.Priority || '-'}</td>
                    <td>
                      <StatusPill tone={toneForReportStatus(item.Status)}>{item.Status || '-'}</StatusPill>
                    </td>
                    <td>{formatReportDate(item['Plan Date'])}</td>
                    <td>{item['Total Duration'] || item.Duration || '-'}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="dashboard-table__empty">No ticket report data found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </article>
    </>
  );
}
