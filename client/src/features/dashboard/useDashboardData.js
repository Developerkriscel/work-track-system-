import { useEffect, useMemo, useState } from 'react';
import { fetchDashboardData } from '@/features/dashboard/api';
import { useAuth } from '@/features/auth/AuthProvider';

export const dashboardRanges = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'week', label: 'This Week' },
  { value: 'last_week', label: 'Last Week' },
  { value: 'month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'all', label: 'All Time' }
];

export function useDashboardData() {
  const { user } = useAuth();
  const employeeId = user?.['Employee ID'] || '';
  const [range, setRange] = useState('today');
  const [state, setState] = useState({
    loading: true,
    error: null,
    payload: null
  });

  useEffect(() => {
    if (!employeeId) {
      setState({
        loading: false,
        error: null,
        payload: null
      });
      return undefined;
    }

    let alive = true;

    async function load() {
      setState((current) => ({
        ...current,
        loading: true,
        error: null
      }));

      try {
        const payload = await fetchDashboardData(employeeId, range);
        if (!alive) return;
        setState({
          loading: false,
          error: null,
          payload
        });
      } catch (error) {
        if (!alive) return;
        setState({
          loading: false,
          error: error.message || 'Failed to load dashboard data.',
          payload: null
        });
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, [employeeId, range]);

  const data = useMemo(() => state.payload?.data || null, [state.payload]);

  return {
    employeeId,
    currentUser: user || null,
    range,
    setRange,
    ranges: dashboardRanges,
    loading: state.loading,
    error: state.error, clearError: () => setState((current) => ({ ...current, error: null })),
    data
  };
}
