import {
  BarChart3,
  Clock3,
  LayoutDashboard,
  ListChecks,
  Receipt,
  Tickets
} from '@/components/common/icons';
import { formatDashboardCurrency } from '@/features/dashboard/services/dashboardPresentation';
import { useNavigate } from 'react-router-dom';

function StatCard({ icon: Icon, tone, label, value, path }) {
  const navigate = useNavigate();
  return (
    <button type="button" className="dashboard-kpi-card dashboard-kpi-card--interactive" onClick={() => navigate(path)} aria-label={`Open ${label}`}>
      <div className={`dashboard-kpi-card__icon dashboard-kpi-card__icon--${tone}`}>
        <Icon className="dashboard-kpi-card__icon-svg" />
      </div>
      <p className="dashboard-kpi-card__label">{label}</p>
      <p className="dashboard-kpi-card__value">{value}</p>
    </button>
  );
}

export function DashboardKpiGrid({ kpis = {} }) {
  return (
    <div className="dashboard-kpi-grid">
      <StatCard path="/ticket-system" icon={Tickets} tone="blue" label="Tickets Pending" value={kpis.pendingTickets ?? 0} />
      <StatCard path="/ticket-system" icon={LayoutDashboard} tone="green" label="Tickets Done" value={kpis.doneTickets ?? 0} />
      <StatCard path="/fms-tracker" icon={ListChecks} tone="teal" label="FMS Pending" value={kpis.pendingFms ?? 0} />
      <StatCard path="/fms-tracker" icon={BarChart3} tone="cyan" label="FMS Done" value={kpis.doneFms ?? 0} />
      <StatCard path="/ticket-system" icon={Clock3} tone="red" label="Overdue" value={kpis.overdueTasks ?? 0} />
      <StatCard path="/expenses" icon={Receipt} tone="purple" label="Expenses" value={formatDashboardCurrency(kpis.totalExpenses)} />
    </div>
  );
}
