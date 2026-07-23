import { ListChecks } from '@/components/common/icons';
import { getTodoSummary } from '@/features/todo/services/todoPresentation';

function SummaryCard({ tone, label, value }) {
  return (
    <article className="dashboard-kpi-card">
      <div className={`dashboard-kpi-card__icon dashboard-kpi-card__icon--${tone}`}>
        <ListChecks className="dashboard-kpi-card__icon-svg" />
      </div>
      <p className="dashboard-kpi-card__label">{label}</p>
      <p className="dashboard-kpi-card__value">{value}</p>
    </article>
  );
}

export function TodoSummaryCards({ rows = [] }) {
  const summary = getTodoSummary(rows);

  return (
    <div className="dashboard-kpi-grid approvals-kpi-grid">
      <SummaryCard tone="purple" label="All Tasks" value={summary.total} />
      <SummaryCard tone="green" label="Completed" value={summary.completed} />
      <SummaryCard tone="orange" label="Pending" value={summary.pending} />
    </div>
  );
}
