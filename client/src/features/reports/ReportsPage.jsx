import { FmsReportSection } from '@/features/reports/components/FmsReportSection';
import { ReportsHeader } from '@/features/reports/components/ReportsHeader';
import { ReportsSummaryCards } from '@/features/reports/components/ReportsSummaryCards';
import { ReportsToolbar } from '@/features/reports/components/ReportsToolbar';
import { TicketReportSection } from '@/features/reports/components/TicketReportSection';
import { useReportsData } from '@/features/reports/useReportsData';

export function ReportsPage() {
  const {
    employeeId,
    currentUser,
    role,
    activeTab,
    setActiveTab,
    range,
    setRange,
    rangeOptions,
    customStart,
    setCustomStart,
    customEnd,
    setCustomEnd,
    error,
    message,
    downloading,
    tickets,
    ticketsSummary,
    ticketPriorities,
    ticketCategories,
    ticketFilters,
    setTicketFilters,
    fms,
    fmsSummary,
    fmsStatuses,
    fmsFilters,
    setFmsFilters,
    refresh,
    download
  } = useReportsData();

  const ticketSummaryItems = [
    {
      label: 'Total Tickets',
      value: ticketsSummary.total ?? tickets.length,
      iconClass: 'dashboard-kpi-card__icon--purple'
    },
    {
      label: 'Open',
      value: ticketsSummary.open ?? tickets.filter((item) => !String(item.Status || '').toLowerCase().includes('closed')).length,
      iconClass: 'dashboard-kpi-card__icon--blue'
    },
    {
      label: 'Closed',
      value: ticketsSummary.closed ?? tickets.filter((item) => String(item.Status || '').toLowerCase().includes('closed')).length,
      iconClass: 'dashboard-kpi-card__icon--green'
    }
  ];

  const fmsSummaryItems = [
    {
      label: 'Total FMS',
      value: fmsSummary.total ?? fms.length,
      iconClass: 'dashboard-kpi-card__icon--purple'
    },
    {
      label: 'Completed',
      value: fmsSummary.completed ?? fms.filter((item) => String(item.Status || '').toLowerCase().includes('complete')).length,
      iconClass: 'dashboard-kpi-card__icon--green'
    },
    {
      label: 'Pending',
      value: (fmsSummary.total ?? fms.length) - (fmsSummary.completed ?? fms.filter((item) => String(item.Status || '').toLowerCase().includes('complete')).length),
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
        <div className="dashboard-banner dashboard-banner--error">{error}</div>
      ) : null}

      {message ? (
        <div className={`dashboard-banner${message.tone === 'danger' ? ' dashboard-banner--error' : ''}`}>
          <StatusPill tone={message.tone === 'danger' ? 'danger' : 'success'}>
            {message.tone === 'danger' ? 'Update failed' : 'Update complete'}
          </StatusPill>
          <span>{message.text}</span>
        </div>
      ) : null}

      <ReportsToolbar
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

      {activeTab === 'tickets' ? (
        <>
          <ReportsSummaryCards items={ticketSummaryItems} />

          <TicketReportSection
            tickets={tickets}
            ticketPriorities={ticketPriorities}
            ticketCategories={ticketCategories}
            ticketFilters={ticketFilters}
            onTicketFiltersChange={setTicketFilters}
          />
        </>
      ) : (
        <>
          <ReportsSummaryCards items={fmsSummaryItems} />

          <FmsReportSection
            fms={fms}
            fmsStatuses={fmsStatuses}
            fmsFilters={fmsFilters}
            onFmsFiltersChange={setFmsFilters}
          />
        </>
      )}
    </section>
  );
}
