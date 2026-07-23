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
    <article className="migration-panel migration-panel--full">
      <div className="migration-panel__row">
        <div className="approval-tabs">
          <ReportTab active={activeTab === 'tickets'} onClick={() => onTabChange('tickets')}>
            Tickets Report
          </ReportTab>
          <ReportTab active={activeTab === 'fms'} onClick={() => onTabChange('fms')}>
            FMS Report
          </ReportTab>
        </div>
      </div>

      <div className="reports-toolbar">
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

        <div className="reports-toolbar__actions">
          <button type="button" className="attendance-cta attendance-cta--red" disabled={downloading} onClick={() => onDownload('pdf')}>
            PDF
          </button>
          <button type="button" className="attendance-cta attendance-cta--green" disabled={downloading} onClick={() => onDownload('xlsx')}>
            Excel
          </button>
          <button type="button" className="attendance-cta attendance-cta--gray" onClick={() => window.print()}>
            Print
          </button>
        </div>
      </div>
    </article>
  );
}
