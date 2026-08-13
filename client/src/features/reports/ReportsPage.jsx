import { StatusPill } from '@/components/common/StatusPill';
import { FmsReportSection } from '@/features/reports/components/FmsReportSection';
import { ManagementDashboardReportTab } from '@/features/reports/components/ManagementDashboardReportTab';
import { ReportsHeader } from '@/features/reports/components/ReportsHeader';
import { ReportsSummaryCards } from '@/features/reports/components/ReportsSummaryCards';
import { ReportsToolbar } from '@/features/reports/components/ReportsToolbar';
import { TicketReportSection } from '@/features/reports/components/TicketReportSection';
import { useReportsData } from '@/features/reports/useReportsData';
import './reports.css';

export function ReportsPage() {
  const {
    employeeId,
    currentUser,
    role,
    isManagerOnly,
    activeTab,
    setActiveTab,
    range,
    setRange,
    rangeOptions,
    customStart,
    setCustomStart,
    customEnd,
    setCustomEnd,
    error, clearError,
    message, clearMessage,
    downloading,
    tickets,
    ticketStatuses,
    ticketPriorities,
    ticketUsers,
    ticketFilters,
    setTicketFilters,
    resetTicketFilters,
    fms,
    fmsStatuses,
    fmsFilters,
    setFmsFilters,
    resetFmsFilters,
    refresh,
    download
  } = useReportsData();

  const ticketSummaryItems = [
    {
      label: 'Total Tickets',
      value: tickets.length,
      iconClass: 'dashboard-kpi-card__icon--purple'
    },
    {
      label: 'Open',
      value: tickets.filter((item) => !String(item.Status || '').toLowerCase().includes('closed')).length,
      iconClass: 'dashboard-kpi-card__icon--blue'
    },
    {
      label: 'Closed',
      value: tickets.filter((item) => String(item.Status || '').toLowerCase().includes('closed')).length,
      iconClass: 'dashboard-kpi-card__icon--green'
    }
  ];

  const fmsSummaryItems = [
    {
      label: 'Total FMS',
      value: fms.length,
      iconClass: 'dashboard-kpi-card__icon--purple'
    },
    {
      label: 'Completed',
      value: fms.filter((item) => String(item.Status || '').toLowerCase().includes('complete')).length,
      iconClass: 'dashboard-kpi-card__icon--green'
    },
    {
      label: 'Pending',
      value: fms.filter((item) => !String(item.Status || '').toLowerCase().includes('complete')).length,
      iconClass: 'dashboard-kpi-card__icon--blue'
    }
  ];

  return (
    <section className="page-card">
      <ReportsHeader
        employeeLabel={`${currentUser?.['Employee Name'] || currentUser?.Name || 'Employee'}${employeeId ? ` | ${employeeId}` : ''}`}
        role={role}
        onRefresh={refresh}
      />

      {error ? (
        <div className="dashboard-banner dashboard-banner--error">
          <span>{error}</span>
          <button type="button" className="dashboard-banner__close" onClick={clearError}>OK</button>
        </div>
      ) : null}

      {message ? (
        <div className={`dashboard-banner${message.tone === 'danger' ? ' dashboard-banner--error' : ''}`}>
          <StatusPill tone={message.tone === 'danger' ? 'danger' : 'success'}>
            {message.tone === 'danger' ? 'Update failed' : 'Update complete'}
          </StatusPill>
          <span>{message.text}</span>
        
          <button type="button" className="dashboard-banner__close" onClick={clearMessage}>OK</button>
        </div>
      ) : null}

      <ReportsToolbar
        isManagerOnly={isManagerOnly}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        range={range}
        onRangeChange={setRange}
        rangeOptions={rangeOptions}
        customStart={customStart}
        onCustomStartChange={setCustomStart}
        customEnd={customEnd}
        onCustomEndChange={setCustomEnd}
        downloading={downloading}
        onDownload={download}
      />

      {isManagerOnly ? (
        <>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <ReportsSummaryCards items={activeTab === 'fms' ? fmsSummaryItems : ticketSummaryItems} />
            </div>
            
            {activeTab === 'fms' && (
              <div className="reports-date-controls" style={{ 
                display: 'flex', gap: '12px', background: 'rgba(255, 255, 255, 0.4)', 
                padding: '12px 16px', borderRadius: '16px', backdropFilter: 'blur(12px)', 
                border: '1px solid rgba(255, 255, 255, 0.6)', boxShadow: '0 4px 6px rgba(0,0,0,0.02)',
                alignItems: 'flex-end', flexShrink: 0
              }}>
                <label className="dashboard-control" style={{ margin: 0 }}>
                  <span style={{ fontSize: '11px', opacity: 0.8, marginBottom: '4px', display: 'block', fontWeight: 600 }}>Date Range</span>
                  <select value={range} onChange={(event) => setRange(event.target.value)} style={{ minWidth: '150px' }}>
                    {rangeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                {range === 'custom' ? (
                  <>
                    <label className="dashboard-control" style={{ margin: 0 }}>
                      <span style={{ fontSize: '11px', opacity: 0.8, marginBottom: '4px', display: 'block', fontWeight: 600 }}>Start Date</span>
                      <input type="date" value={customStart} onChange={(event) => setCustomStart(event.target.value)} />
                    </label>
                    <label className="dashboard-control" style={{ margin: 0 }}>
                      <span style={{ fontSize: '11px', opacity: 0.8, marginBottom: '4px', display: 'block', fontWeight: 600 }}>End Date</span>
                      <input type="date" value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} />
                    </label>
                  </>
                ) : null}
              </div>
            )}
          </div>
          {activeTab === 'fms' ? (
            <FmsReportSection
              fms={fms}
              fmsStatuses={fmsStatuses}
              fmsFilters={fmsFilters}
              onFmsFiltersChange={setFmsFilters}
              onResetFilters={resetFmsFilters}
            />
          ) : (
            <TicketReportSection
              tickets={tickets}
              ticketStatuses={ticketStatuses}
              ticketPriorities={ticketPriorities}
              ticketUsers={ticketUsers}
              ticketFilters={ticketFilters}
              onTicketFiltersChange={setTicketFilters}
              onResetFilters={resetTicketFilters}
              range={range}
              onRangeChange={setRange}
              rangeOptions={rangeOptions}
              customStart={customStart}
              onCustomStartChange={setCustomStart}
              customEnd={customEnd}
              onCustomEndChange={setCustomEnd}
            />
          )}
        </>
      ) : activeTab === 'tickets' ? (
        <>
          <ReportsSummaryCards items={ticketSummaryItems} />
          <TicketReportSection
            tickets={tickets}
            ticketStatuses={ticketStatuses}
            ticketPriorities={ticketPriorities}
            ticketUsers={ticketUsers}
            ticketFilters={ticketFilters}
            onTicketFiltersChange={setTicketFilters}
            onResetFilters={resetTicketFilters}
            range={range}
            onRangeChange={setRange}
            rangeOptions={rangeOptions}
            customStart={customStart}
            onCustomStartChange={setCustomStart}
            customEnd={customEnd}
            onCustomEndChange={setCustomEnd}
          />
        </>
      ) : (
        <ManagementDashboardReportTab />
      )}
    </section>
  );
}
