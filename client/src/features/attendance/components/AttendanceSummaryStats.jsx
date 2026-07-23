export function AttendanceSummaryStats({ historyCount }) {
  return (
    <div className="dashboard-mini-grid">
      <article className="dashboard-mini-card dashboard-mini-card--warn">
        <div>
          <span className="dashboard-mini-card__label">Attendance Days In View</span>
          <strong className="dashboard-mini-card__value">{historyCount}</strong>
        </div>
      </article>
    </div>
  );
}
