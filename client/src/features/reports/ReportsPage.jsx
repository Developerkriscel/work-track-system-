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
          <ReportsSummaryCards items={activeTab === 'fms' ? fmsSummaryItems : ticketSummaryItems} />
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
