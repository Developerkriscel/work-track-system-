import { useEffect, useRef, useState } from 'react';
import { fetchExpensesForUser, submitExpenseRecord } from '@/features/expenses/api';
import { useAuth } from '@/features/auth/AuthProvider';

function todayYmd() {
  const date = new Date();
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function useExpensesData() {
  const { user } = useAuth();
  const employeeId = user?.['Employee ID'] || '';
  const employeeName = user?.['Employee Name'] || user?.Name || employeeId;
  const [state, setState] = useState({
    loading: true,
    error: null,
    expenses: []
  });
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({
    date: todayYmd(),
    type: 'Travel',
    amount: '',
    description: '',
    receipt: null,
    receiptPreview: ''
  });
  const refreshRef = useRef(0);

  useEffect(() => {
    if (!employeeId) {
      setState({
        loading: false,
        error: null,
        expenses: []
      });
      return undefined;
    }

    let alive = true;

    async function loadExpenses() {
      setState((current) => ({ ...current, loading: true, error: null }));
      try {
        const payload = await fetchExpensesForUser(employeeId);
        if (!alive) return;
        setState({
          loading: false,
          error: null,
          expenses: Array.isArray(payload.data) ? payload.data : []
        });
      } catch (error) {
        if (!alive) return;
        setState({
          loading: false,
          error: error.message || 'Failed to load expenses.',
          expenses: []
        });
      }
    }

    loadExpenses();
    return () => {
      alive = false;
    };
  }, [employeeId, refreshRef.current]);

  function refresh() {
    refreshRef.current += 1;
    setState((current) => ({ ...current }));
  }

  function updateForm(patch) {
    setForm((current) => ({ ...current, ...patch }));
  }

  function resetForm() {
    setForm({
      date: todayYmd(),
      type: 'Travel',
      amount: '',
      description: '',
      receipt: null,
      receiptPreview: ''
    });
  }

  function openForm() {
    setFormOpen(true);
    setMessage(null);
  }

  function closeForm() {
    setFormOpen(false);
    resetForm();
  }

  async function submitForm() {
    if (!form.date || !form.type || !String(form.amount || '').trim() || !String(form.description || '').trim()) {
      setMessage({ tone: 'danger', text: 'Date, type, amount, and description are required.' });
      return { success: false, message: 'Missing required fields.' };
    }

    setSubmitting(true);
    setMessage(null);
    try {
      const payload = {
        'Employee ID': employeeId,
        'Employee Name': employeeName,
        Date: form.date,
        Type: form.type,
        Amount: form.amount,
        Description: form.description,
        Receipt: form.receipt
      };
      const result = await submitExpenseRecord(payload);
      setMessage({
        tone: result.success ? 'success' : 'danger',
        text: result.success ? 'Expense recorded successfully.' : result.message
      });
      if (result.success) {
        closeForm();
        refresh();
      }
      return result;
    } catch (error) {
      const result = { success: false, message: error.message || 'Expense submission failed.' };
      setMessage({ tone: 'danger', text: result.message });
      return result;
    } finally {
      setSubmitting(false);
    }
  }

  return {
    employeeId,
    currentUser: user || null,
    loading: state.loading,
    error: state.error,
    expenses: state.expenses,
    submitting,
    message,
    formOpen,
    openForm,
    closeForm,
    form,
    updateForm,
    resetForm,
    submitForm,
    refresh
  };
}
