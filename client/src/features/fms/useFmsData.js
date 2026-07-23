import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchFmsTasks, markFmsTaskDone } from '@/features/fms/api';
import { useAuth } from '@/features/auth/AuthProvider';

function normalizedDate(value) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isCompleted(task) {
  return !!(task.actualDate || task['Done Date'] || '').toString().trim();
}

function classifyTask(task, today) {
  const plan = normalizedDate(task.planDate || task['Plan Date'] || task.Date);
  const completed = isCompleted(task);
  const future = plan && plan > today && !completed;
  const pending = !completed && !future;

  return {
    ...task,
    _planDateObj: plan,
    _completed: completed,
    _future: future,
    _pending: pending
  };
}

function visibleByTab(tasks, tab) {
  switch (tab) {
    case 'my-pending':
      return tasks.filter((task) => task._isMyTask && task._pending);
    case 'my-future':
      return tasks.filter((task) => task._isMyTask && task._future);
    case 'my-completed':
      return tasks.filter((task) => task._isMyTask && task._completed);
    case 'team-pending':
      return tasks.filter((task) => task._isTeamTask && task._pending);
    case 'team-future':
      return tasks.filter((task) => task._isTeamTask && task._future);
    case 'team-completed':
      return tasks.filter((task) => task._isTeamTask && task._completed);
    default:
      return tasks;
  }
}

function applyFilters(tasks, filters) {
  return tasks.filter((task) => {
    const employeeMatch =
      !filters.emp ||
      String(task.empId || task['Employee ID'] || '').trim() === filters.emp;

    const categoryMatch =
      !filters.name ||
      String(task.fmsName || task['Client Name'] || task.Client || '').trim() === filters.name;

    const dateMatch =
      !filters.date ||
      String(task.planDate || task['Plan Date'] || task.Date || '').trim() === filters.date;

    return employeeMatch && categoryMatch && dateMatch;
  });
}

export function useFmsData() {
  const { user } = useAuth();
  const employeeId = user?.['Employee ID'] || '';
  const [tab, setTab] = useState('my-pending');
  const [filters, setFilters] = useState({ emp: '', name: '', date: '' });
  const [state, setState] = useState({ loading: true, error: null, payload: null });
  const [submitting, setSubmitting] = useState(false);
  const refreshKey = useRef(0);

  const reload = () => {
    refreshKey.current += 1;
    setState((current) => ({ ...current }));
  };

  useEffect(() => {
    if (!employeeId) {
      setState({ loading: false, error: null, payload: null });
      return undefined;
    }

    let alive = true;

    async function load() {
      setState((current) => ({ ...current, loading: true, error: null }));
      try {
        const payload = await fetchFmsTasks(employeeId);
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
          error: error.message || 'Failed to load FMS tasks.',
          payload: null
        });
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, [employeeId, refreshKey.current]);

  const today = useMemo(() => {
    const value = new Date();
    value.setHours(0, 0, 0, 0);
    return value;
  }, []);

  const tasks = useMemo(
    () => (state.payload?.data || []).map((task) => classifyTask(task, today)),
    [state.payload, today]
  );

  const meta = state.payload?.meta || { role: 'User', teamCount: 0 };
  const visibleTasks = useMemo(
    () => applyFilters(visibleByTab(tasks, tab), filters),
    [tasks, tab, filters]
  );

  const employeeOptions = useMemo(
    () =>
      Array.from(
        new Set(tasks.map((task) => String(task.empId || task['Employee ID'] || '').trim()).filter(Boolean))
      ),
    [tasks]
  );

  const categoryOptions = useMemo(
    () =>
      Array.from(
        new Set(tasks.map((task) => String(task.fmsName || task['Client Name'] || task.Client || '').trim()).filter(Boolean))
      ),
    [tasks]
  );

  const tabCounts = useMemo(
    () => ({
      'my-pending': tasks.filter((task) => task._isMyTask && task._pending).length,
      'my-future': tasks.filter((task) => task._isMyTask && task._future).length,
      'my-completed': tasks.filter((task) => task._isMyTask && task._completed).length,
      'team-pending': tasks.filter((task) => task._isTeamTask && task._pending).length,
      'team-future': tasks.filter((task) => task._isTeamTask && task._future).length,
      'team-completed': tasks.filter((task) => task._isTeamTask && task._completed).length
    }),
    [tasks]
  );

  async function completeTask(rowId, remarks) {
    setSubmitting(true);
    try {
      const response = await markFmsTaskDone(rowId, remarks, employeeId);
      reload();
      return { success: true, response };
    } catch (error) {
      return { success: false, message: error.message || 'FMS complete failed.' };
    } finally {
      setSubmitting(false);
    }
  }

  return {
    employeeId,
    currentUser: user || null,
    loading: state.loading,
    error: state.error,
    submitting,
    tab,
    setTab,
    filters,
    setFilters,
    tasks: visibleTasks,
    meta,
    employeeOptions,
    categoryOptions,
    tabCounts,
    completeTask
  };
}
