import { useEffect, useMemo, useState } from 'react';
import { createFmsTask, fetchFmsAssignableUsers, fetchFmsTasks, markFmsTaskDone } from '@/features/fms/api';
import { useAuth } from '@/features/auth/AuthProvider';

function normalizedDate(value) {
  if (!value) return null;
  const raw = String(value).trim();
  const ymd = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymd) return new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]));
  const dmy = raw.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);
  if (dmy) return new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isCompleted(task) {
  const doneDate = (task.actualDate || task['Done Date'] || '').toString().trim();
  if (doneDate) return true;
  return /complete|done/i.test(String(task.Status || task.status || '').trim());
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

function sortTasks(tasks) {
  return [...tasks].sort((left, right) => {
    const leftDate = left._planDateObj?.getTime() || 0;
    const rightDate = right._planDateObj?.getTime() || 0;
    if (left._completed !== right._completed) return Number(left._completed) - Number(right._completed);
    return leftDate - rightDate;
  });
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

    const searchHaystack = [
      task.empId,
      task.who,
      task.what,
      task.when,
      task.how,
      task.fmsName,
      task['Client Name'],
      task.Client,
      task.taskName,
      task['Task Description'],
      task.Description,
      task.stepNo,
      task.Status,
      task['On Time Status']
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    const searchMatch =
      !filters.search ||
      searchHaystack.includes(String(filters.search || '').trim().toLowerCase());

    return employeeMatch && categoryMatch && dateMatch && searchMatch;
  });
}

export function useFmsData() {
  const { user } = useAuth();
  const employeeId = user?.['Employee ID'] || '';
  const [tab, setTab] = useState('my-pending');
  const [filters, setFilters] = useState({ emp: '', name: '', date: '', search: '' });
  const [state, setState] = useState({ loading: true, error: null, payload: null });
  const [submitting, setSubmitting] = useState(false);
  const [assignableUsers, setAssignableUsers] = useState([]);
  const [assignableLoading, setAssignableLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 60, total: 0, totalPages: 1, start: 0, end: 0 });

  const reload = () => {
    setRefreshKey((current) => current + 1);
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
        const payload = await fetchFmsTasks(employeeId, {
          paginated: true,
          tab,
          filters,
          page: pagination.page,
          pageSize: pagination.pageSize
        });
        if (!alive) return;
        const nextPagination = payload.meta?.pagination || {};
        setState({
          loading: false,
          error: null,
          payload
        });
        setPagination((current) => ({
          ...current,
          page: nextPagination.page || current.page,
          pageSize: nextPagination.pageSize || current.pageSize,
          total: nextPagination.total || 0,
          totalPages: nextPagination.totalPages || 1,
          start: nextPagination.start || 0,
          end: nextPagination.end || 0
        }));
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
  }, [employeeId, refreshKey, tab, filters, pagination.page, pagination.pageSize]);

  const today = useMemo(() => {
    const value = new Date();
    value.setHours(0, 0, 0, 0);
    return value;
  }, []);

  const tasks = useMemo(
    () => sortTasks((state.payload?.data || []).map((task) => classifyTask(task, today))),
    [state.payload, today]
  );

  const meta = state.payload?.meta || { role: 'User', teamCount: 0 };
  const canCreateFms = Boolean(meta.canCreate);

  useEffect(() => {
    if (!employeeId || !canCreateFms) {
      setAssignableUsers([]);
      setAssignableLoading(false);
      return undefined;
    }

    let alive = true;

    async function loadAssignableUsers() {
      setAssignableLoading(true);
      try {
        const response = await fetchFmsAssignableUsers(employeeId);
        if (!alive) return;
        setAssignableUsers(Array.isArray(response.data) ? response.data : []);
      } catch (error) {
        if (!alive) return;
        setAssignableUsers([]);
      } finally {
        if (alive) setAssignableLoading(false);
      }
    }

    loadAssignableUsers();
    return () => {
      alive = false;
    };
  }, [employeeId, canCreateFms]);

  const serverPaged = Boolean(meta.serverPaged);

  const visibleTasks = useMemo(
    () => serverPaged ? tasks : applyFilters(visibleByTab(tasks, tab), filters),
    [filters, serverPaged, tab, tasks]
  );

  const teamTabsVisible = useMemo(
    () => ['team-pending', 'team-future', 'team-completed'].some((key) => ((meta.tabCounts || tabCountsCache(tasks))[key] || 0) > 0),
    [meta.tabCounts, tasks]
  );

  const employeeOptions = useMemo(
    () => {
      if (Array.isArray(meta.employeeOptions)) return meta.employeeOptions;
      const seen = new Map();
      tasks
        .filter((task) => task._isTeamTask)
        .forEach((task) => {
          const value = String(task.empId || task['Employee ID'] || '').trim();
          if (!value || seen.has(value)) return;
          const person = String(task.who || task['Employee Name'] || value).trim();
          const label = person && person !== value ? `${person} (${value})` : value;
          seen.set(value, { value, label });
        });
      return Array.from(seen.values());
    },
    [meta.employeeOptions, tasks]
  );

  const categoryOptions = useMemo(
    () => Array.isArray(meta.categoryOptions)
      ? meta.categoryOptions
      : Array.from(
        new Set(tasks.map((task) => String(task.fmsName || task['Client Name'] || task.Client || '').trim()).filter(Boolean))
      ),
    [meta.categoryOptions, tasks]
  );

  const tabCounts = useMemo(
    () => meta.tabCounts || tabCountsCache(tasks),
    [meta.tabCounts, tasks]
  );

  useEffect(() => {
    if (!teamTabsVisible && tab.startsWith('team-')) {
      setTab('my-pending');
    }
  }, [teamTabsVisible, tab]);

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

  async function createTask(payload) {
    setSubmitting(true);
    try {
      const response = await createFmsTask(payload, employeeId);
      reload();
      return { success: true, response };
    } catch (error) {
      return { success: false, message: error.message || 'FMS create failed.' };
    } finally {
      setSubmitting(false);
    }
  }

  return {
    employeeId,
    currentUser: user || null,
    loading: state.loading,
    error: state.error, clearError: () => setState((current) => ({ ...current, error: null })),
    submitting,
    tab,
    setTab: (nextTab) => {
      setPagination((current) => ({ ...current, page: 1 }));
      setTab(nextTab);
    },
    filters,
    setFilters: (updater) => {
      setPagination((current) => ({ ...current, page: 1 }));
      setFilters(updater);
    },
    reload,
    tasks: visibleTasks,
    meta,
    pagination,
    setPage: (page) => setPagination((current) => ({ ...current, page: Math.max(1, Number(page) || 1) })),
    canCreateFms,
    assignableUsers,
    assignableLoading,
    teamTabsVisible,
    employeeOptions,
    categoryOptions,
    tabCounts,
    completeTask,
    createTask
  };
}

function tabCountsCache(tasks) {
  return {
    'my-pending': tasks.filter((task) => task._isMyTask && task._pending).length,
    'my-future': tasks.filter((task) => task._isMyTask && task._future).length,
    'my-completed': tasks.filter((task) => task._isMyTask && task._completed).length,
    'team-pending': tasks.filter((task) => task._isTeamTask && task._pending).length,
    'team-future': tasks.filter((task) => task._isTeamTask && task._future).length,
    'team-completed': tasks.filter((task) => task._isTeamTask && task._completed).length
  };
}
