export function TicketHeader({ employeeLabel }) {
  return (
    <div className="page-card__header">
      <div>
        <p className="page-card__eyebrow">Operations Workspace</p>
        <h1 className="page-card__title page-card__title--dashboard">Ticket System</h1>
      </div>

      <div className="dashboard-controls">
        <div className="page-card__status">{employeeLabel}</div>
      </div>
    </div>
  );
}
