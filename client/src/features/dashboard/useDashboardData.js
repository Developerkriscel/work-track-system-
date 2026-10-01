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
  const normalizedRole = String(user?.Role || user?.role || '').trim().toLowerCase();
  const canUseTeamDashboard = /^(super admin|admin|hr|manager)$/i.test(normalizedRole);
  const [range, setRange] = useState('today');
  const [viewMode, setViewMode] = useState('my');
  const [taskPage, setTaskPage] = useState(1);
  const [state, setState] = useState({
    loading: true,
    tasksLoading: true,
    error: null,
    payload: null,
    tasksPayload: null
  });

  useEffect(() => {
    if (!canUseTeamDashboard && viewMode !== 'my') {
      setViewMode('my');
    }
  }, [canUseTeamDashboard, viewMode]);

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
    const controller = new AbortController();
    setState((current) => ({ ...current, loading: true, tasksLoading: true, error: null }));
    fetchDashboardData(employeeId, range, viewMode, {
      includeTasks: true, includeCollections: false, includeSummary: true,
      taskPage, taskPageSize: 20
    }, controller.signal).then((payload) => {
      if (!alive) return;
      if (payload.success === false) throw new Error(payload.message || 'Dashboard could not load.');
      setState({ loading: false, tasksLoading: false, error: null, payload, tasksPayload: payload });
    }).catch((error) => {
      if (!alive) return;
      setState({ loading: false, tasksLoading: false, error: error.message || 'Failed to load dashboard.', payload: null, tasksPayload: null });
    });
    return () => { alive = false; controller.abort(); };
  }, [employeeId, range, viewMode, taskPage]);

  const data = useMemo(() => {
    const summary = state.payload?.data || null;
    const tasks = state.tasksPayload?.data || null;
    if (!summary && !tasks) return null;
    return {
      ...(summary || {}),
      ...(tasks
        ? {
            todaysTasks: tasks.todaysTasks || [],
            upcomingTasks: tasks.upcomingTasks || [],
            taskPagination: tasks.taskPagination || summary?.taskPagination,
            taskTotals: tasks.taskTotals || summary?.taskTotals
          }
        : {})
    };
  }, [state.payload, state.tasksPayload]);
  const canViewTeamDashboard = Boolean(data?.canViewTeamDashboard ?? canUseTeamDashboard);

  return {
    employeeId,
    currentUser: user || null,
    range,
    setRange: (next) => { setTaskPage(1); setRange(next); },
    viewMode,
    setViewMode: (next) => { setTaskPage(1); setViewMode(next); },
    taskPage,
    setTaskPage,
    canViewTeamDashboard,
    ranges: dashboardRanges,
    loading: state.loading,
    tasksLoading: state.tasksLoading,
    error: state.error, clearError: () => setState((current) => ({ ...current, error: null })),
    data
  };
}
