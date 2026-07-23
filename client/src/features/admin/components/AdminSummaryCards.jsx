import { ShieldUser, Users } from '@/components/common/icons';

function SummaryCard({ icon: Icon, tone, label, value }) {
  return (
    <article className="dashboard-kpi-card">
      <div className={`dashboard-kpi-card__icon dashboard-kpi-card__icon--${tone}`}>
        <Icon className="dashboard-kpi-card__icon-svg" />
      </div>
      <p className="dashboard-kpi-card__label">{label}</p>
      <p className="dashboard-kpi-card__value">{value}</p>
    </article>
  );
}

export function AdminSummaryCards({ summary }) {
  return (
    <div className="dashboard-kpi-grid admin-kpi-grid">
      <SummaryCard icon={Users} tone="purple" label="Total Users" value={summary.totalUsers} />
      <SummaryCard icon={ShieldUser} tone="green" label="Active Users" value={summary.activeUsers} />
      <SummaryCard icon={ShieldUser} tone="blue" label="Managers / Admins" value={summary.managers} />
      <SummaryCard icon={ShieldUser} tone="purple" label="Departments" value={summary.departments} />
    </div>
  );
}
