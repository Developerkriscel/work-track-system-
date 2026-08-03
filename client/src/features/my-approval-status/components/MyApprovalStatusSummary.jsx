import { StatusPill } from '@/components/common/StatusPill';

function SummaryCard({ label, value, tone }) {
  return (
    <article className="dashboard-kpi-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <p className="dashboard-kpi-card__label" style={{ textAlign: 'center', marginBottom: '8px' }}>{label}</p>
      <p className="dashboard-kpi-card__value">{value}</p>
    </article>
  );
}

export function MyApprovalStatusSummary({ summary }) {
  return (
    <div className="dashboard-kpi-grid approvals-kpi-grid">
      <SummaryCard label="Total Requests" value={summary.total} tone="info" />
      <SummaryCard label="Pending" value={summary.pending} tone="warning" />
      <SummaryCard label="Approved / Closed" value={summary.approved} tone="success" />
      <SummaryCard label="Rework / Rejected" value={summary.actionNeeded} tone="danger" />
    </div>
  );
}
