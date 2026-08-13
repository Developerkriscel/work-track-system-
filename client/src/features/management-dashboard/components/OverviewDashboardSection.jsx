import { StatusPill } from '@/components/common/StatusPill';
import { formatManagementCurrency, managementStatusTone } from '@/features/management-dashboard/services/managementDashboardPresentation';
import { BarChart3, Users, Clock3, Receipt, CircleCheckBig, ListChecks, ShieldUser, BadgeCheck } from '@/components/common/icons';
import { DashboardCharts } from './DashboardCharts';

function SummaryCard({ label, value, icon: Icon, color = 'blue' }) {
  return (
    <article className="dashboard-kpi-card">
      <div className={`dashboard-kpi-card__icon dashboard-kpi-card__icon--${color}`}>
        {Icon && <Icon className="dashboard-kpi-card__icon-svg" />}
      </div>
      <div className="dashboard-kpi-card-content">
        <p className="dashboard-kpi-card__label">{label}</p>
        <p className="dashboard-kpi-card__value">{value}</p>
      </div>
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
            {rows.length ? rows.slice(0, 8).map((row, index) => (
              <tr key={`${title}-${row.ID || row.rowId || index}`}>
                <td data-label="ID"><span className="ticket-id-chip">{row.ID || '-'}</span></td>
                <td data-label="User">{row.User || '-'}</td>
                <td data-label="Client">{row.Client || '-'}</td>
                <td data-label="Status"><StatusPill tone={managementStatusTone(row.Status)}>{row.Status || '-'}</StatusPill></td>
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

export function OverviewDashboardSection({ kpis, tickets, fms, todo, users, clients, charts }) {
  return (
    <>
      <div className="dashboard-kpi-grid reports-kpi-grid">
        <SummaryCard icon={BarChart3} color="purple" label="Attendance %" value={`${kpis.attendancePct || 0}%`} />
        <SummaryCard icon={Users} color="blue" label="Attendance Count" value={kpis.attendanceCount || '0'} />
        <SummaryCard icon={Clock3} color="orange" label="Planned Time" value={kpis.plannedTime || '0h 0m'} />
        <SummaryCard icon={Receipt} color="green" label="Outstanding" value={formatManagementCurrency(kpis.outstanding)} />
        <SummaryCard icon={CircleCheckBig} color="blue" label="Completed Today" value={kpis.completedToday || 0} />
        <SummaryCard icon={ListChecks} color="purple" label="Completion Rate" value={`${kpis.completedRate || 0}%`} />
        <SummaryCard icon={ShieldUser} color="orange" label="Active Users" value={users.length} />
        <SummaryCard icon={BadgeCheck} color="green" label="Active Clients" value={clients.length} />
      </div>

      <DashboardCharts tickets={tickets} fms={fms} todo={todo} charts={charts} />

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
              {todo.length ? todo.slice(0, 10).map((row, index) => (
                <tr key={`todo-${row.ID || row.rowId || index}`}>
                  <td data-label="ID"><span className="ticket-id-chip">{row.ID || '-'}</span></td>
                  <td data-label="User">{row.User || '-'}</td>
                  <td data-label="Description" className="approval-table__copy">{row.Description || '-'}</td>
                  <td data-label="Status"><StatusPill tone={managementStatusTone(row.Status)}>{row.Status || '-'}</StatusPill></td>
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
