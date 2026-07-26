import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/features/auth/AuthProvider';
import { fetchMyApprovalStatus } from '@/features/my-approval-status/api';

export function useMyApprovalStatusData() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rows, setRows] = useState([]);
  const [filters, setFilters] = useState({
    type: '',
    search: ''
  });

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

  const typeOptions = useMemo(
    () => Array.from(new Set(rows.map((row) => row.Type).filter(Boolean))).sort(),
    [rows]
  );

  const filteredRows = useMemo(() => {
    const query = String(filters.search || '').trim().toLowerCase();
    return rows.filter((row) => {
      if (filters.type && row.Type !== filters.type) return false;
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
    });
  }, [rows, filters]);

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
    rows: filteredRows,
    allRows: rows,
    summary,
    filters,
    typeOptions,
    updateFilters: (patch) => setFilters((current) => ({ ...current, ...patch })),
    resetFilters: () => setFilters({ type: '', search: '' }),
    refresh
  };
}
