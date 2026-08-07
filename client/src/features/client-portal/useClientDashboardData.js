import { useCallback, useMemo } from 'react';
import { FileText, LayoutDashboard, Receipt, Tickets } from '@/components/common/icons';
import { fetchClientDashboardData } from '@/features/client-portal/api';
import { clientCurrency, shortIsoDate } from '@/features/client-portal/services';
import { useClientPortalResource } from '@/features/client-portal/useClientPortalResource';

const EMPTY_DASHBOARD = Object.freeze({});

export function useClientDashboardData() {
  const loadResource = useCallback(async (clientId) => {
    const payload = await fetchClientDashboardData(clientId);
    return payload.data || payload || EMPTY_DASHBOARD;
  }, []);

  const { client, clientId, loading, error, value } = useClientPortalResource(loadResource, EMPTY_DASHBOARD);

  const kpis = value?.kpis || value?.summary || EMPTY_DASHBOARD;
  const pendingActions = useMemo(() => value?.pendingActions || [], [value]);
  const recentActivity = useMemo(() => value?.recentActivity || [], [value]);
  const summaryItems = useMemo(() => ([
    { key: 'open-tickets', label: 'Open Tickets', value: kpis.openTickets ?? 0, tone: 'yellow', Icon: Tickets, accent: 'yellow', path: '/client/tickets?tab=open' },
    { key: 'pending-tickets', label: 'Pending Tickets', value: kpis.pendingTickets ?? 0, tone: 'orange', Icon: Tickets, accent: 'orange', path: '/client/tickets?tab=open' },
    { key: 'completed-tasks', label: 'Completed Tasks', value: kpis.completedTasks ?? 0, tone: 'green', Icon: LayoutDashboard, accent: 'green', path: '/client/tickets?tab=closed' },
    { key: 'total-tasks', label: 'Total Tasks', value: kpis.totalTasks ?? 0, tone: 'blue', Icon: FileText, accent: 'blue', path: '/client/tickets?tab=all' },
    { key: 'outstanding', label: 'Outstanding', value: clientCurrency(kpis.outstandingAmount || 0), tone: 'red', Icon: Receipt, accent: 'red', path: '/client/invoices' }
  ]), [kpis]);

  const statusChartData = useMemo(() => value?.statusChartData || { labels: [], data: [] }, [value]);
  const activityChartData = useMemo(() => value?.activityChartData || { labels: [], data: [] }, [value]);

  return {
    client,
    clientId,
    loading,
    error,
    kpis,
    summaryItems,
    pendingActions,
    recentActivity,
    statusChartData,
    activityChartData,
    formatDate: shortIsoDate
  };
}
