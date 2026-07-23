import { StatusPill } from '@/components/common/StatusPill';
import { formatManagementCurrency, managementStatusTone } from '@/features/management-dashboard/services/managementDashboardPresentation';

function SummaryCard({ label, value }) {
  return (
    <article className="dashboard-kpi-card">
      <div className="dashboard-kpi-card__icon dashboard-kpi-card__icon--purple" />
      <p className="dashboard-kpi-card__label">{label}</p>
      <p className="dashboard-kpi-card__value">{value}</p>
    </article>
  );
}

function SimpleTaskTable({ title, rows = [] }) {
  return (
    <article className="migration-panel">
      <div className="migration-panel__row">
        <h2>{title}</h2>
        <StatusPill tone="info">{rows.length} rows</StatusPill>
      </div>
      <div className="dashboard-table-wrap">
        <table className="dashboard-table approval-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>User</th>
              <th>Client</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? rows.slice(0, 8).map((row) => (
              <tr key={`${title}-${row.ID}`}>
                <td><span className="ticket-id-chip">{row.ID || '-'}</span></td>
                <td>{row.User || '-'}</td>
                <td>{row.Client || '-'}</td>
                <td><StatusPill tone={managementStatusTone(row.Status)}>{row.Status || '-'}</StatusPill></td>
              </tr>
            )) : (
              <tr>
                <td colSpan="4" className="dashboard-table__empty">No rows available.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </article>
  );
}

export function OverviewDashboardSection({ kpis, tickets, fms, todo, users, clients }) {
  return (
    <>
      <div className="dashboard-kpi-grid approvals-kpi-grid">
        <SummaryCard label="Attendance %" value={`${kpis.attendancePct || 0}%`} />
        <SummaryCard label="Attendance Count" value={kpis.attendanceCount || '0'} />
        <SummaryCard label="Planned Time" value={kpis.plannedTime || '0h 0m'} />
        <SummaryCard label="Outstanding" value={formatManagementCurrency(kpis.outstanding)} />
        <SummaryCard label="Completed Today" value={kpis.completedToday || 0} />
        <SummaryCard label="Completion Rate" value={`${kpis.completedRate || 0}%`} />
        <SummaryCard label="Active Users" value={users.length} />
        <SummaryCard label="Active Clients" value={clients.length} />
      </div>

      <div className="migration-grid">
        <SimpleTaskTable title="Tickets" rows={tickets} />
        <SimpleTaskTable title="FMS" rows={fms} />
      </div>

      <article className="migration-panel migration-panel--full">
        <div className="migration-panel__row">
          <h2>To-Do Overview</h2>
          <StatusPill tone="info">{todo.length} rows</StatusPill>
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
              {todo.length ? todo.slice(0, 10).map((row) => (
                <tr key={row.ID}>
                  <td><span className="ticket-id-chip">{row.ID || '-'}</span></td>
                  <td>{row.User || '-'}</td>
                  <td className="approval-table__copy">{row.Description || '-'}</td>
                  <td><StatusPill tone={managementStatusTone(row.Status)}>{row.Status || '-'}</StatusPill></td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="4" className="dashboard-table__empty">No to-do rows available.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </article>
    </>
  );
}
