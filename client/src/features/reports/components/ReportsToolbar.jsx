function ReportTab({ active, children, onClick }) {
  return (
    <button
      type="button"
      className={`approval-tab-btn${active ? ' approval-tab-btn--active' : ''}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function ReportsToolbar({
  isManagerOnly,
  activeTab,
  onTabChange,
  range,
  onRangeChange,
  rangeOptions,
  customStart,
  onCustomStartChange,
  customEnd,
  onCustomEndChange,
  downloading,
  onDownload
}) {
  return (
    <>
      <div className="reports-main-tabs" style={{ marginBottom: '12px' }}>
        {isManagerOnly ? (
          <>
            <button
              type="button"
              className={`reports-main-tab-btn${activeTab === 'tickets' ? ' reports-main-tab-btn--active' : ''}`}
              onClick={() => onTabChange('tickets')}
            >
              Team Tickets
            </button>
            <button
              type="button"
              className={`reports-main-tab-btn${activeTab === 'fms' ? ' reports-main-tab-btn--active' : ''}`}
              onClick={() => onTabChange('fms')}
            >
              Team FMS
            </button>
          </>
        ) : (
          <>
            <button type="button" className={`reports-main-tab-btn${activeTab === 'management' ? ' reports-main-tab-btn--active' : ''}`} onClick={() => onTabChange('management')}>
              Management Dashboard
            </button>
            <button type="button" className={`reports-main-tab-btn${activeTab === 'tickets' ? ' reports-main-tab-btn--active' : ''}`} onClick={() => onTabChange('tickets')}>
              Tickets Report
            </button>
          </>
        )}
      </div>

      {!isManagerOnly && activeTab === 'management' ? null : (
      <article className="migration-panel migration-panel--full" style={{ marginTop: 0, marginBottom: '12px' }}>
        <div className="reports-toolbar">
        {activeTab !== 'tickets' ? (
          <div className="dashboard-controls">
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

          {range === 'custom' ? (
            <>
              <label className="dashboard-control">
                <span>Start Date</span>
                <input type="date" value={customStart} onChange={(event) => onCustomStartChange(event.target.value)} />
              </label>
              <label className="dashboard-control">
                <span>End Date</span>
                <input type="date" value={customEnd} onChange={(event) => onCustomEndChange(event.target.value)} />
              </label>
            </>
          ) : null}
        </div>
        ) : <div />}

        <div className="reports-toolbar__actions">
          <button type="button" className="attendance-cta attendance-cta--red" disabled={downloading} onClick={() => onDownload('pdf')}>
            PDF
          </button>
          <button type="button" className="attendance-cta attendance-cta--green" disabled={downloading} onClick={() => onDownload('xlsx')}>
            Excel
          </button>
        </div>
      </div>
      </article>
      )}
    </>
  );
}
