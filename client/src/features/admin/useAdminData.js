import { useEffect, useMemo, useRef, useState } from 'react';
import {
  fetchAllManagersList,
  fetchAllUsersForAdmin,
  fetchEmpMasterData,
  fetchNextEmpCode,
  saveEmpMasterData,
  saveOrUpdateUser
} from '@/features/admin/api';
import { useAuth } from '@/features/auth/AuthProvider';

const STORAGE_KEY = 'worktrack.mern.admin.employeeId';

const departmentOptions = [
  'IT',
  'HR',
  'CRM',
  'Sales',
  'Telecalling',
  'Business Automations',
  'Operations',
  'Digital',
  'Director'
];

const roleOptions = ['User', 'Manager', 'Admin', 'HR', 'Super Admin'];
const statusOptions = ['Active', 'Inactive'];
const categoryOptions = ['Master', 'Employee', 'Freelancer', 'Intern'];

function readStoredEmployeeId(fallback = '') {
  if (typeof window === 'undefined') return fallback;
  return window.localStorage.getItem(STORAGE_KEY) || fallback;
}

function normalizeUser(values = {}) {
  return {
    Category: values.Category || values.category || 'Master',
    'Employee ID': values['Employee ID'] || values.id || '',
    'Employee Name': values['Employee Name'] || values.name || '',
    'Manager ID': values['Manager ID'] || values.Manager || '',
    'Task Approver': values['Task Approver'] || values.Approver || '',
    Department: values.Department || '',
    Role: values.Role || 'User',
    Password: values.Password || '',
    Status: values.Status || 'Active',
    'Mobile Number': values['Mobile Number'] || values.Mobile || '',
    Email: values.Email || ''
  };
}

function includesFilter(value, query) {
  if (!query) return true;
  return String(value || '').toLowerCase().includes(String(query || '').toLowerCase());
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

export function useAdminData() {
  const { user } = useAuth();
  const authenticatedEmployeeId = user?.['Employee ID'] || '';
  const [employeeId, setEmployeeIdState] = useState(() => readStoredEmployeeId(authenticatedEmployeeId));
  const [activeTab, setActiveTab] = useState('users');
  const [filters, setFilters] = useState({
    search: '',
    role: '',
    status: '',
    department: ''
  });
  const [state, setState] = useState({
    loading: true,
    error: null,
    users: [],
    empMaster: [],
    managers: []
  });
  const [message, setMessage] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [editor, setEditor] = useState({
    open: false,
    mode: 'edit',
    source: 'users',
    form: normalizeUser({})
  });
  const refreshRef = useRef(0);

  useEffect(() => {
    if (authenticatedEmployeeId && employeeId !== authenticatedEmployeeId) setEmployeeIdState(authenticatedEmployeeId);
    if (typeof window !== 'undefined') {
      if (authenticatedEmployeeId) window.localStorage.setItem(STORAGE_KEY, authenticatedEmployeeId);
    }
  }, [authenticatedEmployeeId, employeeId]);

  useEffect(() => {
    let alive = true;

    async function loadAdminData() {
      setState((current) => ({ ...current, loading: true, error: null }));
      try {
        const [usersPayload, managersPayload, empPayload] = await Promise.all([
          fetchAllUsersForAdmin(employeeId),
          fetchAllManagersList(),
          fetchEmpMasterData('Master')
        ]);

        if (!alive) return;

        setState({
          loading: false,
          error: null,
          users: safeArray(usersPayload?.data),
          empMaster: safeArray(empPayload?.data),
          managers: safeArray(managersPayload)
        });
      } catch (error) {
        if (!alive) return;
        setState({
          loading: false,
          error: error.message || 'Failed to load admin data.',
          users: [],
          empMaster: [],
          managers: []
        });
      }
    }

    loadAdminData();
    return () => {
      alive = false;
    };
  }, [employeeId, refreshRef.current]);

  const filteredUsers = useMemo(() => {
    return state.users.filter((user) => {
      const searchBlob = [
        user['Employee ID'],
        user['Employee Name'],
        user.Role,
        user.Department,
        user['Manager ID'],
        user['Task Approver'],
        user.Email
      ].join(' ');
      return (
        includesFilter(searchBlob, filters.search) &&
        (!filters.role || user.Role === filters.role) &&
        (!filters.status || user.Status === filters.status) &&
        (!filters.department || user.Department === filters.department)
      );
    });
  }, [state.users, filters]);

  const filteredEmpMaster = useMemo(() => {
    return state.empMaster.filter((user) => {
      const searchBlob = [
        user['Employee ID'],
        user['Employee Name'],
        user.Role,
        user.Department,
        user.Email,
        user['Mobile Number']
      ].join(' ');
      return (
        includesFilter(searchBlob, filters.search) &&
        (!filters.role || user.Role === filters.role) &&
        (!filters.status || user.Status === filters.status) &&
        (!filters.department || user.Department === filters.department)
      );
    });
  }, [state.empMaster, filters]);

  const managerOptions = useMemo(() => {
    return state.managers
      .filter((manager) => manager.id)
      .sort((left, right) => `${left.name} ${left.id}`.localeCompare(`${right.name} ${right.id}`));
  }, [state.managers]);

  const roleFilterOptions = useMemo(() => {
    return Array.from(new Set(state.users.map((user) => user.Role).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  }, [state.users]);

  const departmentFilterOptions = useMemo(() => {
    return Array.from(new Set(state.users.map((user) => user.Department).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  }, [state.users]);

  const summary = useMemo(() => {
    const active = state.users.filter((user) => String(user.Status || '').toLowerCase() === 'active').length;
    const managers = state.users.filter((user) => /manager|admin|hr|super admin/i.test(String(user.Role || ''))).length;
    const departments = new Set(state.users.map((user) => user.Department).filter(Boolean)).size;
    return {
      totalUsers: state.users.length,
      activeUsers: active,
      managers,
      departments
    };
  }, [state.users]);

  function setEmployeeId(value) {
    setEmployeeIdState(String(value || '').trim().toUpperCase());
  }

  function updateFilters(patch) {
    setFilters((current) => ({ ...current, ...patch }));
  }

  function resetFilters() {
    setFilters({ search: '', role: '', status: '', department: '' });
  }

  function refresh() {
    refreshRef.current += 1;
    setState((current) => ({ ...current }));
  }

  function closeEditor() {
    setEditor((current) => ({ ...current, open: false }));
  }

  function updateEditor(patch) {
    setEditor((current) => ({
      ...current,
      form: {
        ...current.form,
        ...patch
      }
    }));
  }

  async function openAddEditor(source = 'users') {
    const baseCategory = source === 'empMaster' ? 'Master' : 'Employee';
    let nextCode = '';
    try {
      const payload = await fetchNextEmpCode(baseCategory);
      nextCode = payload?.nextCode || payload?.code || '';
    } catch {
      nextCode = '';
    }

    setEditor({
      open: true,
      mode: 'add',
      source,
      form: normalizeUser({
        Category: baseCategory,
        'Employee ID': nextCode
      })
    });
  }

  function openEditEditor(source, row) {
    setEditor({
      open: true,
      mode: 'edit',
      source,
      form: normalizeUser(row)
    });
  }

  async function runAction(action, successText) {
    setSubmitting(true);
    setMessage(null);
    try {
      const result = await action();
      setMessage({
        tone: result.success ? 'success' : 'danger',
        text: result.success ? successText : result.message
      });
      if (result.success) refresh();
      return result;
    } catch (error) {
      const text = error.message || 'Action failed.';
      setMessage({ tone: 'danger', text });
      return { success: false, message: text };
    } finally {
      setSubmitting(false);
    }
  }

  async function submitEditor() {
    const form = normalizeUser(editor.form);
    if (!form['Employee Name'].trim()) {
      setMessage({ tone: 'danger', text: 'Employee Name is required.' });
      return { success: false, message: 'Employee Name is required.' };
    }

    if (!form['Employee ID'].trim()) {
      setMessage({ tone: 'danger', text: 'Employee ID is required.' });
      return { success: false, message: 'Employee ID is required.' };
    }

    const saveAction = editor.source === 'empMaster'
      ? () => saveEmpMasterData(form.Category || 'Master', form, employeeId)
      : () => saveOrUpdateUser(form, employeeId);

    const result = await runAction(
      saveAction,
      `${form['Employee Name']} (${form['Employee ID']}) saved successfully.`
    );

    if (result.success) closeEditor();
    return result;
  }

  return {
    employeeId,
    setEmployeeId,
    activeTab,
    setActiveTab,
    loading: state.loading,
    error: state.error,
    message,
    submitting,
    users: filteredUsers,
    allUsersCount: state.users.length,
    empMaster: filteredEmpMaster,
    allEmpMasterCount: state.empMaster.length,
    summary,
    filters,
    updateFilters,
    resetFilters,
    managerOptions,
    roleOptions,
    roleFilterOptions,
    statusOptions,
    departmentOptions,
    departmentFilterOptions,
    categoryOptions,
    editor,
    openAddEditor,
    openEditEditor,
    closeEditor,
    updateEditor,
    submitEditor,
    refresh
  };
}
