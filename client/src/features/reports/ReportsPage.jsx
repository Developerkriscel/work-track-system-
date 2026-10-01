import { BarChart3 } from '@/components/common/icons';
import { StatusPill } from '@/components/common/StatusPill';
import { FmsReportSection } from '@/features/reports/components/FmsReportSection';
import { ManagementDashboardReportTab } from '@/features/reports/components/ManagementDashboardReportTab';
import { ReportsHeader } from '@/features/reports/components/ReportsHeader';
import { ReportsSummaryCards } from '@/features/reports/components/ReportsSummaryCards';
import { ReportsToolbar } from '@/features/reports/components/ReportsToolbar';
import { TicketReportSection } from '@/features/reports/components/TicketReportSection';
import { AttendanceReportSection } from '@/features/reports/components/AttendanceReportSection';
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
    attendance,
    attendanceUsers,
    attendanceFilters,
    setAttendanceFilters,
    resetAttendanceFilters,
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

  const totalP = attendance.filter((item) => /present|on time/i.test(item.status)).length;
  const totalA = attendance.filter((item) => /absent/i.test(item.status)).length;
  const totalH = attendance.filter((item) => /half day/i.test(item.status)).length;
  const totalL = attendance.filter((item) => /late/i.test(item.status) && !/half day/i.test(item.status)).length;
  const totalW = attendance.filter((item) => /weekly off|w/i.test(item.status)).length;
  const actualP = totalP + (totalH * 0.5);
  const totalEntry = attendance.length;

  const renderAttendanceKPIs = () => (
    <div className="dashboard-kpi-grid dashboard-kpi-grid--7 dashboard-kpi-grid--compact">
      {[
        { label: 'Total Present', value: totalP, iconClass: 'dashboard-kpi-card__icon--blue' },
        { label: 'Total Absent', value: totalA, iconClass: 'dashboard-kpi-card__icon--red' },
        { label: 'Total Half Day', value: totalH, iconClass: 'dashboard-kpi-card__icon--orange' },
        { label: 'Total Late', value: totalL, iconClass: 'dashboard-kpi-card__icon--orange' },
        { label: 'Total Weekoff', value: totalW, iconClass: 'dashboard-kpi-card__icon--purple' },
        { label: 'Actual Present', value: actualP, iconClass: 'dashboard-kpi-card__icon--green' },
        { label: 'Total Entry', value: totalEntry, iconClass: 'dashboard-kpi-card__icon--teal' }
      ].map((kpi, i) => (
        <article key={i} className="dashboard-kpi-card">
          <div className={`dashboard-kpi-card__icon ${kpi.iconClass}`}>
            <BarChart3 className="dashboard-kpi-card__icon-svg" />
          </div>
          <div className="dashboard-kpi-card-content">
            <p className="dashboard-kpi-card__label">{kpi.label}</p>
            <p className="dashboard-kpi-card__value">{kpi.value}</p>
          </div>
        </article>
      ))}
    </div>
  );

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
        customStart={customStart}
        onCustomStartChange={setCustomStart}
        customEnd={customEnd}
        onCustomEndChange={setCustomEnd}
        downloading={downloading}
        onDownload={download}
      />

      {isManagerOnly ? (
        <>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center', justifyContent: 'space-between', marginBottom: activeTab === 'attendance' ? 0 : 'auto' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              {activeTab === 'attendance' ? renderAttendanceKPIs() : (
                <ReportsSummaryCards items={activeTab === 'fms' ? fmsSummaryItems : ticketSummaryItems} />
              )}
            </div>
            
            {activeTab === 'fms' && (
              <div className="reports-date-controls" style={{ 
                display: 'flex', gap: '12px', background: 'rgba(255, 255, 255, 0.4)', 
                padding: '12px 16px', borderRadius: '16px', backdropFilter: 'blur(12px)', 
                border: '1px solid rgba(255, 255, 255, 0.6)', boxShadow: '0 4px 6px rgba(0,0,0,0.02)',
                alignItems: 'flex-end', flexShrink: 0
              }}>
                <label className="dashboard-control" style={{ margin: 0 }}>
                  <span style={{ fontSize: '11px', opacity: 0.8, marginBottom: '4px', display: 'block', fontWeight: 600 }}>Starting Date</span>
                  <input type="date" value={customStart} onChange={(event) => setCustomStart(event.target.value)} />
                </label>
                <label className="dashboard-control" style={{ margin: 0 }}>
                  <span style={{ fontSize: '11px', opacity: 0.8, marginBottom: '4px', display: 'block', fontWeight: 600 }}>Ending Date</span>
                  <input type="date" value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} />
                </label>
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
          ) : activeTab === 'attendance' ? (
              <AttendanceReportSection
              attendance={attendance}
              attendanceUsers={attendanceUsers}
              attendanceFilters={attendanceFilters}
              onAttendanceFiltersChange={setAttendanceFilters}
              onResetFilters={resetAttendanceFilters}
              customStart={customStart}
              onCustomStartChange={setCustomStart}
              customEnd={customEnd}
              onCustomEndChange={setCustomEnd}
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
            customStart={customStart}
            onCustomStartChange={setCustomStart}
            customEnd={customEnd}
            onCustomEndChange={setCustomEnd}
          />
        </>
      ) : activeTab === 'attendance' ? (
        <>
          {renderAttendanceKPIs()}
          <AttendanceReportSection
            attendance={attendance}
            attendanceUsers={attendanceUsers}
            attendanceFilters={attendanceFilters}
            onAttendanceFiltersChange={setAttendanceFilters}
            onResetFilters={resetAttendanceFilters}
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
