import { FileText } from '@/components/common/icons';
import { getClientSocialSummary } from '@/features/client-social/services/clientSocialPresentation';

function SummaryCard({ tone, label, value }) {
  return (
    <article className="dashboard-kpi-card">
      <div className={`dashboard-kpi-card__icon dashboard-kpi-card__icon--${tone}`}>
        <FileText className="dashboard-kpi-card__icon-svg" />
      </div>
      <div className="dashboard-kpi-card-content">
        <p className="dashboard-kpi-card__label">{label}</p>
        <p className="dashboard-kpi-card__value">{value}</p>
      </div>
    </article>
  );
}

export function ClientSocialSummaryCards({ rows = [] }) {
  const summary = getClientSocialSummary(rows);

  return (
    <div className="dashboard-kpi-grid approvals-kpi-grid">
      <SummaryCard tone="purple" label="Social Tasks" value={summary.total} />
      <SummaryCard tone="green" label="Approved / Scheduled" value={summary.postedOrApproved} />
      <SummaryCard tone="orange" label="Pending Approval" value={summary.pending} />
    </div>
  );
}
