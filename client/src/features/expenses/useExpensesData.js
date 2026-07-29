import { useEffect, useRef, useState } from 'react';
import { fetchExpenseApprovalQueue, fetchExpensesForUser, submitExpenseApproval, submitExpenseRecord } from '@/features/expenses/api';
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
  const role = String(user?.Role || user?.role || 'User').trim().toLowerCase();
  const canApproveExpenses = ['admin', 'super admin', 'hr'].includes(role);
  const [state, setState] = useState({
    loading: true,
    error: null,
    expenses: [],
    approvals: []
  });
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [approvalFilters, setApprovalFilters] = useState({
    employee: '',
    status: '',
    search: ''
  });
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
        expenses: [],
        approvals: []
      });
      return undefined;
    }

    let alive = true;

    async function loadExpenses() {
      setState((current) => ({ ...current, loading: true, error: null }));
      try {
        const [expensePayload, approvalPayload] = await Promise.all([
          fetchExpensesForUser(employeeId),
          canApproveExpenses ? fetchExpenseApprovalQueue() : Promise.resolve({ success: true, data: [] })
        ]);
        if (!alive) return;
        setState({
          loading: false,
          error: null,
          expenses: Array.isArray(expensePayload.data) ? expensePayload.data : [],
          approvals: Array.isArray(approvalPayload.data) ? approvalPayload.data : []
        });
      } catch (error) {
        if (!alive) return;
        setState({
          loading: false,
          error: error.message || 'Failed to load expenses.',
          expenses: [],
          approvals: []
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

  function updateApprovalFilters(patch) {
    setApprovalFilters((current) => ({ ...current, ...patch }));
  }

  function resetApprovalFilters() {
    setApprovalFilters({
      employee: '',
      status: '',
      search: ''
    });
  }

  async function processApproval(expense, status, remarks) {
    setSubmitting(true);
    setMessage(null);
    try {
      const result = await submitExpenseApproval({
        expenseId: expense?.ExpenseID || expense?.['Expense ID'],
        status,
        remarks
      });
      setMessage({
        tone: result.success ? 'success' : 'danger',
        text: result.success ? result.message || `Expense claim ${status.toLowerCase()} successfully.` : result.message
      });
      if (result.success) refresh();
      return result;
    } catch (error) {
      const result = { success: false, message: error.message || 'Expense approval failed.' };
      setMessage({ tone: 'danger', text: result.message });
      return result;
    } finally {
      setSubmitting(false);
    }
  }

  const filteredApprovals = state.approvals.filter((expense) => {
    const employeeText = `${expense['Employee Name'] || ''} ${expense['Employee ID'] || ''}`.toLowerCase();
    const searchText = `${expense.Type || ''} ${expense.Description || ''} ${expense['Admin Remarks'] || ''}`.toLowerCase();
    const employeeMatch = !approvalFilters.employee || employeeText.includes(approvalFilters.employee.toLowerCase());
    const statusMatch = !approvalFilters.status || String(expense.Status || '').toLowerCase() === approvalFilters.status.toLowerCase();
    const searchMatch = !approvalFilters.search || searchText.includes(approvalFilters.search.toLowerCase());
    return employeeMatch && statusMatch && searchMatch;
  });

  return {
    employeeId,
    currentUser: user || null,
    canApproveExpenses,
    loading: state.loading,
    error: state.error,
    expenses: state.expenses,
    approvalQueue: state.approvals,
    filteredApprovals,
    approvalFilters,
    updateApprovalFilters,
    resetApprovalFilters,
    submitting,
    message,
    formOpen,
    openForm,
    closeForm,
    form,
    updateForm,
    resetForm,
    submitForm,
    processApproval,
    refresh
  };
}
