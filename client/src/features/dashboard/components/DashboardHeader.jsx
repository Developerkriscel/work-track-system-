function tabButtonClass(active) {
  return `approval-tab-btn${active ? ' approval-tab-btn--active' : ''}`;
}

export function DashboardHeader({
  employeeId,
  dashboardUser,
  range,
  ranges,
  onRangeChange,
  viewMode = 'my',
  onViewModeChange,
  canViewTeamDashboard = false,
  teamCount = 0
}) {
  const heading = viewMode === 'team' ? 'My Team Dashboard' : 'Dashboard';
  const welcomeText = viewMode === 'team'
    ? `Viewing ${teamCount} team member${teamCount === 1 ? '' : 's'} under ${dashboardUser?.['Employee Name'] || dashboardUser?.Name || employeeId || 'your hierarchy'}.`
    : (dashboardUser?.['Employee Name']
      ? `Welcome back, ${dashboardUser['Employee Name']}`
      : 'Loading your employee dashboard.');

  return (
    <div className="page-card__header">
      <div>
        <p className="page-card__eyebrow">WorkTrack Overview</p>
        <h1 className="page-card__title page-card__title--dashboard">{heading}</h1>
        <p className="dashboard-page__welcome">{welcomeText}</p>
        {canViewTeamDashboard ? (
          <div className="approval-tabs" style={{ marginTop: '18px', gap: '10px', flexWrap: 'wrap' }}>
            <button type="button" className={tabButtonClass(viewMode === 'my')} onClick={() => onViewModeChange?.('my')}>
              My Dashboard
            </button>
            <button type="button" className={tabButtonClass(viewMode === 'team')} onClick={() => onViewModeChange?.('team')}>
              My Team Dashboard
            </button>
          </div>
        ) : null}
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
