import { RefreshCw } from '@/components/common/icons';

export function ManagementDashboardHeader({ currentUser, range, rangeOptions, onRangeChange, customStart, onCustomStartChange, customEnd, onCustomEndChange, onRefresh }) {
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
        {range === 'custom' && (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input 
              type="date" 
              value={customStart} 
              onChange={(e) => onCustomStartChange(e.target.value)} 
              className="dashboard-control" 
              style={{ padding: '8px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '14px' }}
            />
            <span style={{ color: '#64748b' }}>to</span>
            <input 
              type="date" 
              value={customEnd} 
              onChange={(e) => onCustomEndChange(e.target.value)} 
              className="dashboard-control"
              style={{ padding: '8px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '14px' }}
            />
          </div>
        )}
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
      </div>
    </div>
  );
}
