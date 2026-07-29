import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/features/auth/AuthProvider';
import { fetchMyApprovalStatus } from '@/features/my-approval-status/api';

const DEFAULT_TAB = 'tickets';
const DEFAULT_FILTERS = Object.freeze({
  status: '',
  startDate: '',
  endDate: '',
  search: ''
});

function parseDateValue(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  const direct = new Date(value);
  if (!Number.isNaN(direct.getTime())) return direct;

  const text = String(value ?? '').trim();
  const parts = text.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/);
  if (!parts) return null;
  let year = Number(parts[3]);
  if (year < 100) year += 2000;
  const parsed = new Date(year, Number(parts[2]) - 1, Number(parts[1]));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function matchesStatusFilter(status, filterValue) {
  const value = String(status || '').toLowerCase();
  if (!filterValue) return true;
  if (filterValue === 'pending') return /(pending|submitted|need approval|waiting)/i.test(value);
  if (filterValue === 'approved') return /(approved|closed|hr approved)/i.test(value);
  if (filterValue === 'rejected') return /(rejected|rework)/i.test(value);
  return true;
}

function rowMatchesQuery(row, query) {
  if (!query) return true;
  const searchBlob = [
    row.Type,
    row.SubType,
    row.Date,
    row.Reason,
    row.Status,
    row.Remarks
  ]
    .join(' ')
    .toLowerCase();
  return searchBlob.includes(query);
}

function rowWithinDateRange(row, startDate, endDate) {
  const rowDate = parseDateValue(row.sortDate || row.Date);
  const start = parseDateValue(startDate);
  const end = parseDateValue(endDate);
  if (start && (!rowDate || rowDate < start)) return false;
  if (end) {
    const endOfDay = new Date(end);
    endOfDay.setHours(23, 59, 59, 999);
    if (!rowDate || rowDate > endOfDay) return false;
  }
  return true;
}

function emptyFilters() {
  return {
    tickets: { ...DEFAULT_FILTERS },
    leaves: { ...DEFAULT_FILTERS },
    intimations: { ...DEFAULT_FILTERS },
    attendance: { ...DEFAULT_FILTERS }
  };
}

function rowTab(row = {}) {
  const type = String(row.Type || '').toLowerCase();
  if (type === 'ticket') return 'tickets';
  if (type === 'leave') return 'leaves';
  if (type === 'intimation') return 'intimations';
  if (type === 'attendance') return 'attendance';
  return DEFAULT_TAB;
}

export function useMyApprovalStatusData() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rows, setRows] = useState([]);
  const [activeTab, setActiveTab] = useState(DEFAULT_TAB);
  const [filters, setFilters] = useState(() => emptyFilters());

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await fetchMyApprovalStatus();
      setRows(Array.isArray(result.data) ? result.data : []);
    } catch (err) {
      setError(err.message || 'Failed to load approval status history.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const rowsByTab = useMemo(
    () => ({
      tickets: rows.filter((row) => rowTab(row) === 'tickets'),
      leaves: rows.filter((row) => rowTab(row) === 'leaves'),
      intimations: rows.filter((row) => rowTab(row) === 'intimations'),
      attendance: rows.filter((row) => rowTab(row) === 'attendance')
    }),
    [rows]
  );

  const counts = useMemo(
    () => ({
      tickets: rowsByTab.tickets.length,
      leaves: rowsByTab.leaves.length,
      intimations: rowsByTab.intimations.length,
      attendance: rowsByTab.attendance.length
    }),
    [rowsByTab]
  );

  const filteredRows = useMemo(() => {
    const activeFilters = filters[activeTab] || DEFAULT_FILTERS;
    const query = String(activeFilters.search || '').trim().toLowerCase();
    return (rowsByTab[activeTab] || []).filter((row) => (
      matchesStatusFilter(row.Status, activeFilters.status)
      && rowWithinDateRange(row, activeFilters.startDate, activeFilters.endDate)
      && rowMatchesQuery(row, query)
    ));
  }, [activeTab, filters, rowsByTab]);

  const summary = useMemo(
    () => ({
      total: rows.length,
      pending: rows.filter((row) => /pending|submitted|need approval|waiting/i.test(String(row.Status || ''))).length,
      approved: rows.filter((row) => /approved|closed|hr approved/i.test(String(row.Status || ''))).length,
      actionNeeded: rows.filter((row) => /rejected|rework/i.test(String(row.Status || ''))).length
    }),
    [rows]
  );

  return {
    employeeId: user?.['Employee ID'] || '',
    currentUser: user,
    loading,
    error,
    activeTab,
    rows: filteredRows,
    allRows: rows,
    counts,
    summary,
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
    refresh
  };
}
