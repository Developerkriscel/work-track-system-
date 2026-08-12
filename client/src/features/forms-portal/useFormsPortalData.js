import { useEffect, useMemo, useRef, useState } from 'react';
import {
  addFormsPortalData,
  deleteFormsPortalData,
  fetchFormsAssignableUsers,
  fetchFormsData,
  saveFormsPortalData
} from '@/features/forms-portal/api';
import { useAuth } from '@/features/auth/AuthProvider';

function parseVisibleUsers(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim().toUpperCase()).filter(Boolean);
  }
  return String(value)
    .split(',')
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean);
}

function normalizeForm(values) {
  const visibilityType = String(values['Visibility Type'] || values.visibilityType || 'SELECTED_USERS').toUpperCase();
  const visibleUsers = visibilityType === 'ALL' ? [] : parseVisibleUsers(values['Visible Users'] || values.visibleUsers || values.Viewer);
  return {
    Department: values.Department || '',
    'Sheet name': values['Sheet name'] || '',
    For: values.For || '',
    'Form link': values['Form link'] || '',
    'Visibility Type': visibilityType,
    'Visible Users': visibilityType === 'ALL' ? '' : visibleUsers.join(', '),
    Viewer: visibilityType === 'ALL' ? 'ALL' : visibleUsers.join(', '),
    Status: values.Status || 'Active'
  };
}

export function useFormsPortalData({ scopeDepartment = '', defaultDepartment = '' } = {}) {
  const { user } = useAuth();
  const employeeId = user?.['Employee ID'] || '';
  const [filters, setFilters] = useState({
    department: '',
    sheet: '',
    search: ''
  });
  const [state, setState] = useState({
    loading: true,
    error: null,
    forms: []
  });
  const [assignableUsers, setAssignableUsers] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);
  const [editor, setEditor] = useState({
    open: false,
    mode: 'add',
    form: normalizeForm({})
  });
  const refreshRef = useRef(0);
  const currentRole = String(user?.Role || user?.role || '').trim();
  const canManageForms = /^(super admin|admin)$/i.test(currentRole);

  useEffect(() => {
    if (!employeeId) {
      setState({
        loading: false,
        error: null,
        forms: []
      });
      return undefined;
    }

    let alive = true;

    async function loadForms() {
      setState((current) => ({ ...current, loading: true, error: null }));
      try {
        const payload = await fetchFormsData(employeeId);
        if (!alive) return;
        setState({
          loading: false,
          error: null,
          forms: Array.isArray(payload.data) ? payload.data : []
        });
      } catch (error) {
        if (!alive) return;
        setState({
          loading: false,
          error: error.message || 'Failed to load forms portal data.',
          forms: []
        });
      }
    }

    loadForms();
    return () => {
      alive = false;
    };
  }, [employeeId, refreshRef.current]);

  useEffect(() => {
    if (!employeeId || !canManageForms) {
      setAssignableUsers([]);
      setIsAdmin(false);
      return undefined;
    }

    let alive = true;

    async function loadAssignableUsers() {
      try {
        const payload = await fetchFormsAssignableUsers(employeeId);
        if (!alive) return;
        const users = Array.isArray(payload.data) ? payload.data : [];
        setAssignableUsers(users);
        setIsAdmin(Boolean(payload.success));
      } catch {
        if (!alive) return;
        setAssignableUsers([]);
        setIsAdmin(false);
      }
    }

    loadAssignableUsers();
    return () => {
      alive = false;
    };
  }, [employeeId]);

  useEffect(() => {
    setIsAdmin(canManageForms);
  }, [canManageForms]);

  const scopedForms = useMemo(() => {
    const scope = String(scopeDepartment || '').trim().toLowerCase();
    if (!scope) return state.forms;
    return state.forms.filter((form) => String(form.Department || '').trim().toLowerCase() === scope);
  }, [scopeDepartment, state.forms]);

  const departmentOptions = useMemo(() => {
    return Array.from(new Set(scopedForms.map((form) => form.Department).filter((dept) => dept && dept.toLowerCase() !== 'all'))).sort((left, right) => left.localeCompare(right));
  }, [scopedForms]);

  const sheetOptions = useMemo(() => {
    return Array.from(new Set(scopedForms.map((form) => form['Sheet name']).filter(Boolean))).sort((left, right) => left.localeCompare(right));
  }, [scopedForms]);

  const filteredForms = useMemo(() => {
    return scopedForms.filter((form) => {
      const matchesDepartment = !filters.department || form.Department === filters.department;
      const matchesSheet = !filters.sheet || form['Sheet name'] === filters.sheet;
      const query = String(filters.search || '').toLowerCase();
      const searchBlock = [
        form.Department,
        form['Sheet name'],
        form.For,
        form['Form link'],
        form.Viewer,
        form['Visible Users']
      ].join(' ').toLowerCase();
      return matchesDepartment && matchesSheet && (!query || searchBlock.includes(query));
    });
  }, [filters, scopedForms]);

  function updateFilters(patch) {
    setFilters((current) => ({ ...current, ...patch }));
  }

  function resetFilters() {
    setFilters({ department: '', sheet: '', search: '' });
  }

  function refresh() {
    refreshRef.current += 1;
    setState((current) => ({ ...current }));
  }

  function openAddEditor() {
    setEditor({
      open: true,
      mode: 'add',
      form: normalizeForm({ Department: defaultDepartment || scopeDepartment || '' })
    });
  }

  function openEditEditor(form) {
    setEditor({
      open: true,
      mode: 'edit',
      form: normalizeForm(form)
    });
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
      const result = { success: false, message: error.message || 'Action failed.' };
      setMessage({ tone: 'danger', text: result.message });
      return result;
    } finally {
      setSubmitting(false);
    }
  }

  async function submitEditor() {
    const form = normalizeForm({
      ...editor.form,
      Department: defaultDepartment || scopeDepartment || editor.form.Department
    });
    if (!form['Sheet name'].trim() || !form.For.trim() || !form['Form link'].trim()) {
      setMessage({ tone: 'danger', text: 'Category / Sheet Name, Purpose, and Form Link are required.' });
      return { success: false, message: 'Missing required fields.' };
    }
    if (form['Visibility Type'] === 'SELECTED_USERS' && !parseVisibleUsers(form['Visible Users']).length) {
      setMessage({ tone: 'danger', text: 'Please select at least one employee for Selected Users access.' });
      return { success: false, message: 'No selected users.' };
    }

    const action = editor.mode === 'edit'
      ? () => saveFormsPortalData(form, employeeId)
      : () => addFormsPortalData(form, employeeId);

    const result = await runAction(
      action,
      editor.mode === 'edit' ? `Form ${form['Sheet name']} updated successfully.` : `Form ${form['Sheet name']} added successfully.`
    );
    if (result.success) closeEditor();
    return result;
  }

  function removeForm(sheetName) {
    return runAction(
      () => deleteFormsPortalData(sheetName, employeeId),
      `Form ${sheetName} deleted successfully.`
    );
  }

  return {
    employeeId,
    currentUser: user || null,
    loading: state.loading,
    error: state.error, clearError: () => setState((current) => ({ ...current, error: null })),
    forms: filteredForms,
    allFormsCount: scopedForms.length,
    filters,
    updateFilters,
    resetFilters,
    refresh,
    isAdmin,
    assignableUsers,
    submitting,
    message, clearMessage: () => setMessage(null),
    departmentOptions,
    sheetOptions,
    editor,
    openAddEditor,
    openEditEditor,
    closeEditor,
    updateEditor,
    submitEditor,
    removeForm
  };
}
