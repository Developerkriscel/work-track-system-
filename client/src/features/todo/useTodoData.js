import { useEffect, useMemo, useRef, useState } from 'react';
import {
  createBulkTodos,
  createTodo,
  fetchTodos,
  removeTodo,
  toggleTodo,
  updateTodo
} from '@/features/todo/api';
import { useAuth } from '@/features/auth/AuthProvider';

function createEmptyBulkRow() {
  return {
    id: `bulk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    task: '',
    priority: 'Medium',
    dueDate: '',
    tat: ''
  };
}

export function useTodoData() {
  const { user } = useAuth();
  const employeeId = user?.['Employee ID'] || '';
  const currentUser = user || null;
  const [state, setState] = useState({
    loading: true,
    error: null,
    rows: []
  });
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [formMode, setFormMode] = useState('single');
  const [singleForm, setSingleForm] = useState({
    task: '',
    priority: 'Medium',
    dueDate: '',
    tat: ''
  });
  const [bulkRows, setBulkRows] = useState([createEmptyBulkRow()]);
  const refreshRef = useRef(0);

  useEffect(() => {
    if (!employeeId) {
      setState({ loading: false, error: null, rows: [] });
      return undefined;
    }

    let alive = true;

    async function load() {
      setState((current) => ({ ...current, loading: true, error: null }));
      try {
        const payload = await fetchTodos(employeeId);
        if (!alive) return;
        setState({
          loading: false,
          error: null,
          rows: Array.isArray(payload.data) ? payload.data : []
        });
      } catch (error) {
        if (!alive) return;
        setState({
          loading: false,
          error: error.message || 'Failed to load to-do tasks.',
          rows: []
        });
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, [employeeId, refreshRef.current]);

  const visibleRows = useMemo(() => {
    return state.rows
      .filter((row) => !String(row.Status || '').toLowerCase().includes('deleted'))
      .filter((row) => {
        if (!statusFilter) return true;
        return String(row.Status || '').toLowerCase() === statusFilter.toLowerCase();
      });
  }, [state.rows, statusFilter]);

  function refresh() {
    refreshRef.current += 1;
    setState((current) => ({ ...current }));
  }

  function resetSingleForm() {
    setSingleForm({
      task: '',
      priority: 'Medium',
      dueDate: '',
      tat: ''
    });
  }

  function resetBulkRows() {
    setBulkRows([createEmptyBulkRow()]);
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

  async function submitSingle() {
    if (!singleForm.task.trim()) {
      setMessage({ tone: 'danger', text: 'Task is required.' });
      return { success: false, message: 'Task is required.' };
    }

    const result = await runAction(
      () => createTodo(employeeId, singleForm.task, singleForm.priority, singleForm.dueDate, singleForm.tat),
      'To-do task created successfully.'
    );
    if (result.success) resetSingleForm();
    return result;
  }

  async function submitBulk() {
    const sanitizedRows = bulkRows
      .map((row) => ({
        task: row.task.trim(),
        priority: row.priority || 'Medium',
        dueDate: row.dueDate || '',
        tat: row.tat || ''
      }))
      .filter((row) => row.task);

    if (!sanitizedRows.length) {
      setMessage({ tone: 'danger', text: 'Add at least one task in bulk list.' });
      return { success: false, message: 'No valid bulk rows.' };
    }

    const result = await runAction(
      () => createBulkTodos(employeeId, sanitizedRows),
      `${sanitizedRows.length} to-do task(s) created successfully.`
    );
    if (result.success) resetBulkRows();
    return result;
  }

  async function toggleRow(row) {
    return runAction(
      () => toggleTodo(row['Task ID'] || row.TodoID, row.Status || 'Pending'),
      `To-do task ${row['Task ID'] || row.TodoID} updated successfully.`
    );
  }

  async function editRow(row, values) {
    return runAction(
      () => updateTodo(row['Task ID'] || row.TodoID, values.task, values.priority, values.dueDate, values.tat),
      `To-do task ${row['Task ID'] || row.TodoID} updated successfully.`
    );
  }

  async function deleteRow(row) {
    return runAction(
      () => removeTodo(row['Task ID'] || row.TodoID),
      `To-do task ${row['Task ID'] || row.TodoID} deleted successfully.`
    );
  }

  return {
    employeeId,
    currentUser,
    loading: state.loading,
    error: state.error, clearError: () => setState((current) => ({ ...current, error: null })),
    rows: visibleRows,
    allRows: state.rows,
    submitting,
    message, clearMessage: () => setMessage(null),
    refresh,
    statusFilter,
    setStatusFilter,
    formMode,
    setFormMode,
    singleForm,
    setSingleForm,
    bulkRows,
    setBulkRows,
    submitSingle,
    submitBulk,
    toggleRow,
    editRow,
    deleteRow,
    resetBulkRows
  };
}
