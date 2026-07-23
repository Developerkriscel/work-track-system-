import { useCallback, useMemo, useState } from 'react';
import { Tickets } from '@/components/common/icons';
import { fetchClientTickets } from '@/features/client-portal/api';
import { shortIsoDate, ticketStatusTone } from '@/features/client-portal/services';
import { useClientPortalResource } from '@/features/client-portal/useClientPortalResource';

const EMPTY_ROWS = Object.freeze([]);

export function useClientTicketsData() {
  const [statusFilter, setStatusFilter] = useState('all');

  const loadResource = useCallback(async (clientId) => {
    const apiFilter = statusFilter === 'all' ? null : statusFilter;
    const payload = await fetchClientTickets(clientId, null, null, apiFilter);
    return Array.isArray(payload.data) ? payload.data : EMPTY_ROWS;
  }, [statusFilter]);

  const { loading, error, value } = useClientPortalResource(loadResource, EMPTY_ROWS);
  const rows = value;

  const counts = useMemo(() => ({
    total: rows.length,
    open: rows.filter((row) => !String(row.Status || '').toLowerCase().includes('closed')).length,
    closed: rows.filter((row) => String(row.Status || '').toLowerCase().includes('closed')).length
  }), [rows]);

  const summaryItems = useMemo(() => ([
    { label: 'Visible Tickets', value: counts.total, tone: 'purple', Icon: Tickets },
    { label: 'Open', value: counts.open, tone: 'blue', Icon: Tickets },
    { label: 'Closed', value: counts.closed, tone: 'green', Icon: Tickets }
  ]), [counts]);

  return {
    loading,
    error,
    rows,
    statusFilter,
    setStatusFilter,
    summaryItems,
    ticketStatusTone,
    formatDate: shortIsoDate
  };
}
