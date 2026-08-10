import { StatusPill } from '@/components/common/StatusPill';
import { FileText, Clock3, BadgeCheck, ListChecks } from '@/components/common/icons';

function SummaryCard({ label, value, tone, Icon }) {
  const iconColorClass = 
    tone === 'info' ? 'dashboard-kpi-card__icon--blue' :
    tone === 'warning' ? 'dashboard-kpi-card__icon--orange' :
    tone === 'success' ? 'dashboard-kpi-card__icon--green' :
    tone === 'danger' ? 'dashboard-kpi-card__icon--red' : 'dashboard-kpi-card__icon--purple';

  return (
    <article className="dashboard-kpi-card">
      {Icon && (
        <div className={`dashboard-kpi-card__icon ${iconColorClass}`}>
          <Icon className="dashboard-kpi-card__icon-svg" />
        </div>
      )}
      <div className="dashboard-kpi-card-content">
        <p className="dashboard-kpi-card__label">{label}</p>
        <p className="dashboard-kpi-card__value">{value}</p>
      </div>
    </article>
  );
}

export function MyApprovalStatusSummary({ summary }) {
  return (
    <div className="dashboard-kpi-grid approvals-kpi-grid my-approvals-kpi-grid">
      <SummaryCard label="Total Requests" value={summary.total} tone="info" Icon={FileText} />
      <SummaryCard label="Pending" value={summary.pending} tone="warning" Icon={Clock3} />
      <SummaryCard label="Approved / Closed" value={summary.approved} tone="success" Icon={BadgeCheck} />
      <SummaryCard label="Rework / Rejected" value={summary.actionNeeded} tone="danger" Icon={ListChecks} />
    </div>
  );
}
