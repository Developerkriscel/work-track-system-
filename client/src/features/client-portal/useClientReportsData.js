import { useCallback, useMemo } from 'react';
import { BarChart3 } from '@/components/common/icons';
import { fetchClientReports } from '@/features/client-portal/api';
import { reportTypeTone, shortIsoDate } from '@/features/client-portal/services';
import { useClientPortalResource } from '@/features/client-portal/useClientPortalResource';

const EMPTY_REPORTS = Object.freeze({
  summary: {},
  details: []
});

export function useClientReportsData() {
  const loadResource = useCallback(async (clientId) => {
    const payload = await fetchClientReports(clientId, null, null);
    return {
      summary: payload.summary || payload.data?.summary || {},
      details: Array.isArray(payload.details) ? payload.details : payload.data?.details || []
    };
  }, []);

  const { loading, error, value } = useClientPortalResource(loadResource, EMPTY_REPORTS);
  const summary = value.summary || {};
  const details = value.details || [];

  const summaryItems = useMemo(() => ([
    { label: 'Total Items', value: summary.totalTasks ?? details.length, tone: 'purple', Icon: BarChart3 },
    { label: 'Tickets', value: summary.tickets ?? 0, tone: 'blue', Icon: BarChart3 },
    { label: 'Checklists', value: summary.checklists ?? 0, tone: 'teal', Icon: BarChart3 },
    { label: 'Outstanding', value: `Rs. ${Number(summary.outstandingAmount || 0).toFixed(2)}`, tone: 'green', Icon: BarChart3 }
  ]), [details.length, summary]);

  return {
    loading,
    error,
    details,
    summaryItems,
    reportTypeTone,
    formatDate: shortIsoDate
  };
}
