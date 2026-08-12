import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/features/auth/AuthProvider';
import { fetchMyApprovalStatus } from '@/features/my-approval-status/api';

const DEFAULT_TAB = 'tickets';
const PAGE_SIZE = 20;
const DEFAULT_FILTERS = Object.freeze({
  status: '',
  startDate: '',
  endDate: '',
  search: ''
});

function emptyFilters() {
  return {
    tickets: { ...DEFAULT_FILTERS },
    leaves: { ...DEFAULT_FILTERS },
    intimations: { ...DEFAULT_FILTERS },
    attendance: { ...DEFAULT_FILTERS }
  };
}

function firstAvailableTab(counts = {}) {
  return ['tickets', 'leaves', 'intimations', 'attendance'].find((key) => Number(counts[key] || 0) > 0) || DEFAULT_TAB;
}

function normalizeSummary(payload = {}) {
  return {
    total: Number(payload.total || 0),
    pending: Number(payload.pending || 0),
    approved: Number(payload.approved || 0),
    actionNeeded: Number(payload.actionNeeded || 0)
  };
}

function normalizeCounts(payload = {}) {
  return {
    tickets: Number(payload.tickets || 0),
    leaves: Number(payload.leaves || 0),
    intimations: Number(payload.intimations || 0),
    attendance: Number(payload.attendance || 0)
  };
}

export function useMyApprovalStatusData() {
  const { user } = useAuth();
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [rowsLoading, setRowsLoading] = useState(false);
  const [error, setError] = useState('');
  const [rows, setRows] = useState([]);
  const [activeTab, setActiveTab] = useState(DEFAULT_TAB);
  const [filters, setFilters] = useState(() => emptyFilters());
  const [counts, setCounts] = useState(() => normalizeCounts());
  const [summary, setSummary] = useState(() => normalizeSummary());
  const [totalRows, setTotalRows] = useState(0);
  const [hasMoreRows, setHasMoreRows] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const loadTokenRef = useRef(0);

  const refreshSummary = useCallback(async () => {
    setSummaryLoading(true);
    setError('');
    try {
      const result = await fetchMyApprovalStatus({ mode: 'summary' });
      const nextSummary = normalizeSummary(result.data?.summary || {});
      const nextCounts = normalizeCounts(result.data?.counts || {});
      setSummary(nextSummary);
      setCounts(nextCounts);
      setActiveTab((current) => ((nextCounts[current] || 0) > 0 ? current : firstAvailableTab(nextCounts)));
    } catch (err) {
      setError(err.message || 'Failed to load approval status history.');
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshSummary();
  }, [refreshSummary]);

  useEffect(() => {
    if (summaryLoading) return undefined;
    const token = loadTokenRef.current + 1;
    loadTokenRef.current = token;
    let cancelled = false;

    async function loadRowsProgressively() {
      setRowsLoading(true);
      setRows([]);
      setTotalRows(0);
      setHasMoreRows(false);
      setError('');

      const activeFilters = filters[activeTab] || DEFAULT_FILTERS;
      let page = 1;
      let shouldContinue = true;

      try {
        while (!cancelled && shouldContinue) {
          const result = await fetchMyApprovalStatus({
            mode: 'rows',
            tab: activeTab,
            page,
            pageSize: PAGE_SIZE,
            filters: activeFilters
          });

          if (cancelled || loadTokenRef.current !== token) return;

          const nextRows = Array.isArray(result.data?.rows) ? result.data.rows : [];
          const pagination = result.data?.pagination || {};

          setRows((current) => (page === 1 ? nextRows : [...current, ...nextRows]));
          setTotalRows(Number(pagination.total || 0));
          setHasMoreRows(Boolean(pagination.hasMore));

          shouldContinue = Boolean(pagination.hasMore);
          page += 1;

          if (shouldContinue) {
            await new Promise((resolve) => {
              setTimeout(resolve, 0);
            });
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Failed to load approval rows.');
        }
      } finally {
        if (!cancelled && loadTokenRef.current === token) {
          setRowsLoading(false);
        }
      }
    }

    loadRowsProgressively();
    return () => {
      cancelled = true;
    };
  }, [activeTab, filters, refreshKey, summaryLoading]);

  const loading = summaryLoading;

  return {
    employeeId: user?.['Employee ID'] || '',
    currentUser: user,
    loading,
    rowsLoading,
    error,
    clearError: () => setError(''),
    activeTab,
    rows,
    counts,
    summary,
    totalRows,
    hasMoreRows,
    filters,
    updateFilters: (tab, patch) => setFilters((current) => ({
      ...current,
      [tab]: { ...(current[tab] || DEFAULT_FILTERS), ...patch }
    })),
    setActiveTab,
    resetFilters: (tab) => setFilters((current) => ({
      ...current,
      [tab]: { ...DEFAULT_FILTERS }
    })),
    refresh: async () => {
      await refreshSummary();
      setRefreshKey((current) => current + 1);
    }
  };
}
