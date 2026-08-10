export function DashboardHeader({ employeeId, dashboardUser, range, ranges, onRangeChange }) {
  return (
    <div className="page-card__header">
      <div>
        <p className="page-card__eyebrow">WorkTrack Overview</p>
        <h1 className="page-card__title page-card__title--dashboard">Dashboard</h1>
        <p className="dashboard-page__welcome">
          {dashboardUser?.['Employee Name']
            ? `Welcome back, ${dashboardUser['Employee Name']}`
            : 'Loading your employee dashboard.'}
        </p>
        <div className="page-card__status dashboard-mobile-pill" style={{ display: 'none' }}>{employeeId || 'Employee session'}</div>
      </div>

      <div className="dashboard-controls">
        <div className="page-card__status dashboard-desktop-pill">{employeeId || 'Employee session'}</div>
        <label className="dashboard-control">
          <span>Date Range</span>
          <select value={range} onChange={(event) => onRangeChange(event.target.value)}>
            {ranges.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
