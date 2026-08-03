import { RefreshCw } from '@/components/common/icons';

export function ManagementDashboardHeader({ currentUser, range, rangeOptions, onRangeChange, onRefresh }) {
  return (
    <div className="page-card__header">
      <div>
        <p className="page-card__eyebrow">Management Analytics</p>
        <h1 className="page-card__title">Management Dashboard</h1>
      </div>

      <div className="dashboard-controls mobile-header-controls">
        <div className="page-card__status">
          {(currentUser?.['Employee Name'] || currentUser?.Name || 'Manager')} {currentUser?.Role ? `| ${currentUser.Role}` : ''}
        </div>
        <label className="dashboard-control">
          <span>Date Range</span>
          <select value={range} onChange={(event) => onRangeChange(event.target.value)}>
            {rangeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="attendance-cta attendance-cta--blue mobile-full-btn approvals-refresh-btn" onClick={onRefresh}>
          <RefreshCw className="approvals-refresh-btn__icon" />
          Refresh
        </button>
      </div>
    </div>
  );
}
