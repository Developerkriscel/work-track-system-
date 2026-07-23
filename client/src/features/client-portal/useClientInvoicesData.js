import { useCallback, useMemo, useState } from 'react';
import { Receipt } from '@/components/common/icons';
import { fetchClientInvoices } from '@/features/client-portal/api';
import { clientCurrency, clientNumber, invoiceTone, shortIsoDate } from '@/features/client-portal/services';
import { useClientPortalResource } from '@/features/client-portal/useClientPortalResource';

const EMPTY_ROWS = Object.freeze([]);

export function useClientInvoicesData() {
  const [activeTab, setActiveTab] = useState('all');

  const loadResource = useCallback(async (clientId) => {
    const payload = await fetchClientInvoices(clientId);
    return Array.isArray(payload.data) ? payload.data : EMPTY_ROWS;
  }, []);

  const { client, loading, error, value } = useClientPortalResource(loadResource, EMPTY_ROWS);
  const rows = value;

  const groupedRows = useMemo(() => {
    const paid = rows.filter((row) => {
      const status = String(row.Status || '').toLowerCase();
      return status.includes('paid') || status.includes('full payment received');
    });
    const cancelled = rows.filter((row) => String(row.Status || '').toLowerCase().includes('cancel'));
    const outstanding = rows.filter((row) => {
      const status = String(row.Status || '').toLowerCase();
      return !(status.includes('paid') || status.includes('full payment received') || status.includes('cancel'));
    });

    return {
      all: rows,
      outstanding,
      paid,
      cancelled
    };
  }, [rows]);

  const visibleRows = groupedRows[activeTab] || groupedRows.all;
  const tabCounts = useMemo(() => ({
    all: groupedRows.all.length,
    outstanding: groupedRows.outstanding.length,
    paid: groupedRows.paid.length,
    cancelled: groupedRows.cancelled.length
  }), [groupedRows]);

  const totals = useMemo(() => ({
    total: rows.length,
    outstanding: rows.reduce((sum, row) => sum + clientNumber(row.Outstanding), 0),
    paid: rows.filter((row) => String(row.Status || '').toLowerCase().includes('paid')).length
  }), [rows]);

  const summaryItems = useMemo(() => ([
    { label: 'Total Invoices', value: totals.total, tone: 'purple', Icon: Receipt },
    { label: 'Paid Records', value: totals.paid, tone: 'green', Icon: Receipt },
    { label: 'Outstanding', value: clientCurrency(totals.outstanding), tone: 'red', Icon: Receipt }
  ]), [totals]);

  return {
    activeTab,
    client,
    loading,
    error,
    rows,
    setActiveTab,
    summaryItems,
    tabCounts,
    invoiceTone,
    visibleRows,
    formatDate: shortIsoDate,
    formatCurrency: clientCurrency
  };
}
