export function FmsHeader({ currentUser, employeeId }) {
  return (
    <div className="page-card__header">
      <div>
        <p className="page-card__eyebrow">FMS Workspace</p>
        <h1 className="page-card__title page-card__title--dashboard">FMS Tracker</h1>
      </div>
      <div className="dashboard-controls">
        <div className="page-card__status">
          {(currentUser?.['Employee Name'] || currentUser?.Name || 'Employee')} {employeeId ? `| ${employeeId}` : ''}
        </div>
      </div>
    </div>
  );
}
