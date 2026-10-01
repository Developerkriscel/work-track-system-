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
  customStart,
  onCustomStartChange,
  customEnd,
  onCustomEndChange,
  downloading,
  onDownload
}) {
  return (
    <>
      <div className="reports-main-tabs" style={{ marginBottom: '12px', width: '100%', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '12px' }}>
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
            <button
              type="button"
              className={`reports-main-tab-btn${activeTab === 'attendance' ? ' reports-main-tab-btn--active' : ''}`}
              onClick={() => onTabChange('attendance')}
            >
              Attendance Report
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
            <button type="button" className={`reports-main-tab-btn${activeTab === 'attendance' ? ' reports-main-tab-btn--active' : ''}`} onClick={() => onTabChange('attendance')}>
              Attendance Report
            </button>
          </>
        )}
        </div>
        {!isManagerOnly && activeTab === 'management' ? null : (
          <div className="reports-toolbar__actions" style={{ margin: 0 }}>
            <button type="button" className="attendance-cta attendance-cta--red" disabled={downloading} onClick={() => onDownload('pdf')}>
              PDF
            </button>
            <button type="button" className="attendance-cta attendance-cta--green" disabled={downloading} onClick={() => onDownload('xlsx')}>
              Excel
            </button>
          </div>
        )}
      </div>


    </>
  );
}
