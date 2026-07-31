import {
  ClientDashboardActionList,
  ClientDashboardActivityChart,
  ClientDashboardKpiGrid,
  ClientDashboardRecentActivity,
  ClientDashboardStatusPanel,
  ClientPortalHeader
} from '@/features/client-portal/components';
import { useClientDashboardData } from '@/features/client-portal/useClientDashboardData';

export function ClientDashboardPage() {
  const {
    client,
    loading,
    error, clearError,
    summaryItems,
    pendingActions,
    recentActivity,
    statusChartData,
    activityChartData,
    formatDate
  } = useClientDashboardData();

  return (
    <section className="page-card">
      <ClientPortalHeader title="Dashboard" statusLabel={client?.['Client Name'] || 'Client Workspace'} />

      {error ? <div className="dashboard-banner dashboard-banner--error"><span>{error}</span><button type="button" className="dashboard-banner__close" onClick={clearError}>OK</button></div> : null}

      <ClientDashboardKpiGrid items={summaryItems} />

      <div className="client-dashboard-grid">
        <div className="client-dashboard-grid__charts">
          <ClientDashboardStatusPanel data={statusChartData} />
          <ClientDashboardActivityChart data={activityChartData} />
        </div>

        <div className="client-dashboard-grid__lists">
          <ClientDashboardActionList items={pendingActions} />
          <ClientDashboardRecentActivity formatDate={formatDate} items={recentActivity} />
        </div>
      </div>
    </section>
  );
}
