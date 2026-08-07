import { Receipt } from '@/components/common/icons';
import { getExpenseSummary } from '@/features/expenses/services/expensesPresentation';

function SummaryCard({ tone, label, value }) {
  return (
    <article className="dashboard-kpi-card">
      <div className={`dashboard-kpi-card__icon dashboard-kpi-card__icon--${tone}`}>
        <Receipt className="dashboard-kpi-card__icon-svg" />
      </div>
      <div className="dashboard-kpi-card-content">
        <p className="dashboard-kpi-card__label">{label}</p>
        <p className="dashboard-kpi-card__value">{value}</p>
      </div>
    </article>
  );
}

export function ExpensesSummaryCards({ expenses = [] }) {
  const summary = getExpenseSummary(expenses);

  return (
    <div className="dashboard-kpi-grid approvals-kpi-grid">
      <SummaryCard tone="purple" label="Expense Records" value={summary.total} />
      <SummaryCard tone="green" label="Pending" value={summary.pending} />
      <SummaryCard tone="blue" label="Approved / Other" value={summary.approvedOrOther} />
    </div>
  );
}
