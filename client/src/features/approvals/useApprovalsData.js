import { useEffect, useMemo, useRef, useState } from 'react';
import {
  fetchPendingApprovals,
  fetchTaskApproversList,
  submitApprovalAction,
  submitTicketApproval,
  transferTicketApproval
} from '@/features/approvals/api';
import { useAuth } from '@/features/auth/AuthProvider';

function normalizeDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function includesFilter(value, query) {
  if (!query) return true;
  return String(value || '').toLowerCase().includes(query.toLowerCase());
}

function inDateRange(value, start, end) {
  if (!start && !end) return true;
  const normalized = normalizeDate(value);
  if (!normalized) return false;
  if (start && normalized < start) return false;
  if (end && normalized > end) return false;
  return true;
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

export function useApprovalsData() {
  const { user } = useAuth();
  const employeeId = user?.['Employee ID'] || '';
  const [activeTab, setActiveTab] = useState('tickets');
  const [filters, setFilters] = useState({
    tickets: { employee: '', category: '', startDate: '', endDate: '', search: '' },
    leaves: { employee: '', startDate: '', endDate: '', search: '' },
    intimations: { employee: '', startDate: '', endDate: '', search: '' },
    attendance: { employee: '', startDate: '', endDate: '', search: '' }
  });
  const [state, setState] = useState({
    loading: true,
    error: null,
    data: { tickets: [], leaves: [], intimations: [], attendance: [], users: [] }
  });
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);
  const [approvers, setApprovers] = useState([]);
  const refreshRef = useRef(0);

  useEffect(() => {
    if (!employeeId) {
      setState({
        loading: false,
        error: null,
        data: { tickets: [], leaves: [], intimations: [], attendance: [], users: [] }
      });
      return undefined;
    }

    let alive = true;

    async function loadApprovals() {
      setState((current) => ({ ...current, loading: true, error: null }));
      try {
        const payload = await fetchPendingApprovals(employeeId);
        if (!alive) return;
        setState({
          loading: false,
          error: null,
          data: {
            tickets: safeArray(payload.tickets),
            leaves: safeArray(payload.leaves),
            intimations: safeArray(payload.intimations),
            attendance: safeArray(payload.attendance),
            users: safeArray(payload.users)
          }
        });
      } catch (error) {
        if (!alive) return;
        setState({
          loading: false,
          error: error.message || 'Failed to load approvals.',
          data: { tickets: [], leaves: [], intimations: [], attendance: [], users: [] }
        });
      }
    }

    loadApprovals();
    return () => {
      alive = false;
    };
  }, [employeeId, refreshRef.current]);

  useEffect(() => {
    let alive = true;

    async function loadApprovers() {
      try {
        const payload = await fetchTaskApproversList();
        if (!alive) return;
        setApprovers(safeArray(payload));
      } catch {
        if (!alive) return;
        setApprovers([]);
      }
    }

    loadApprovers();
    return () => {
      alive = false;
    };
  }, []);

  const userOptions = useMemo(() => {
    const users = state.data.users.map((user) => ({
      id: user.id || user['Employee ID'],
      name: user.name || user['Employee Name'] || user.id
    }));
    return users.sort((left, right) => String(left.name || '').localeCompare(String(right.name || '')));
  }, [state.data.users]);

  const ticketCategories = useMemo(() => {
    return Array.from(
      new Set(state.data.tickets.map((ticket) => ticket['Task Category'] || ticket.Category).filter(Boolean))
    ).sort((left, right) => left.localeCompare(right));
  }, [state.data.tickets]);

  const filteredTickets = useMemo(() => {
    const filter = filters.tickets;
    return state.data.tickets.filter((ticket) => {
      const employeeText = `${ticket['Employee Name'] || ''} ${ticket['Employee ID'] || ''}`;
      const searchable = [
        ticket['Ticket ID'],
        ticket['Task Description'],
        ticket.Remarks,
        ticket.Name,
        ticket['Client Name'],
        ticket['Client ID']
      ].join(' ');
      return (
        includesFilter(employeeText, filter.employee) &&
        (!filter.category || (ticket['Task Category'] || ticket.Category) === filter.category) &&
        inDateRange(ticket['Plan Date'], filter.startDate, filter.endDate) &&
        includesFilter(searchable, filter.search)
      );
    });
  }, [filters.tickets, state.data.tickets]);

  const filteredLeaves = useMemo(() => {
    const filter = filters.leaves;
    return state.data.leaves.filter((item) => {
      const employeeText = `${item['Employee Name'] || ''} ${item['Employee ID'] || ''}`;
      const searchable = [item['Leave Type'], item.Reason, item['Day Type']].join(' ');
      return (
        includesFilter(employeeText, filter.employee) &&
        inDateRange(item['Start Date'], filter.startDate, filter.endDate) &&
        inDateRange(item['End Date'], filter.startDate, filter.endDate) &&
        includesFilter(searchable, filter.search)
      );
    });
  }, [filters.leaves, state.data.leaves]);

  const filteredIntimations = useMemo(() => {
    const filter = filters.intimations;
    return state.data.intimations.filter((item) => {
      const employeeText = `${item['Employee Name'] || ''} ${item['Employee ID'] || ''}`;
      const searchable = [item['Intimation Type'], item.Reason].join(' ');
      return (
        includesFilter(employeeText, filter.employee) &&
        inDateRange(item['Intimation Date'] || item.Date, filter.startDate, filter.endDate) &&
        includesFilter(searchable, filter.search)
      );
    });
  }, [filters.intimations, state.data.intimations]);

  const filteredAttendance = useMemo(() => {
    const filter = filters.attendance;
    return state.data.attendance.filter((item) => {
      const employeeText = `${item['Employee Name'] || ''} ${item['Employee ID'] || ''}`;
      const searchable = [item.Status, item.Remarks, item['Admin Remarks']].join(' ');
      return (
        includesFilter(employeeText, filter.employee) &&
        inDateRange(item.Date || item.DateStr, filter.startDate, filter.endDate) &&
        includesFilter(searchable, filter.search)
      );
    });
  }, [filters.attendance, state.data.attendance]);

  const counts = useMemo(
    () => ({
      tickets: state.data.tickets.length,
      leaves: state.data.leaves.length,
      intimations: state.data.intimations.length,
      attendance: state.data.attendance.length
    }),
    [state.data]
  );

  function updateFilter(tab, patch) {
    setFilters((current) => ({
      ...current,
      [tab]: {
        ...current[tab],
        ...patch
      }
    }));
  }

  function resetFilter(tab) {
    setFilters((current) => ({
      ...current,
      [tab]: {
        employee: '',
        category: '',
        startDate: '',
        endDate: '',
        search: ''
      }
    }));
  }

  function refresh() {
    refreshRef.current += 1;
    setState((current) => ({ ...current }));
  }

  async function runAction(action, successMessage) {
    setSubmitting(true);
    setMessage(null);
    try {
      const result = await action();
      setMessage({
        tone: result.success ? 'success' : 'danger',
        text: result.success ? successMessage : result.message
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

  function approveItem(type, id, remarks = '') {
    return runAction(
      () => submitApprovalAction({ adminId: employeeId, type, id, action: 'Approved', remarks }),
      `${type} approved successfully.`
    );
  }

  function rejectItem(type, id, remarks = '') {
    return runAction(
      () => submitApprovalAction({ adminId: employeeId, type, id, action: 'Rejected', remarks }),
      `${type} rejected successfully.`
    );
  }

  function approveTicket(ticketId, remarks = '') {
    return runAction(
      () => submitTicketApproval(ticketId, employeeId, 'Approve', remarks),
      `Ticket ${ticketId} approved successfully.`
    );
  }

  function reworkTicket(ticketId, remarks = '') {
    return runAction(
      () => submitTicketApproval(ticketId, employeeId, 'Reject', remarks),
      `Ticket ${ticketId} sent for rework.`
    );
  }

  function moveTicketApproval(ticketId, targetManagerId, remarks = '') {
    return runAction(
      () => transferTicketApproval(ticketId, targetManagerId, employeeId, remarks),
      `Approval transferred for ${ticketId}.`
    );
  }

  return {
    employeeId,
    currentUser: user || null,
    activeTab,
    setActiveTab,
    loading: state.loading,
    error: state.error,
    submitting,
    message,
    userOptions,
    approvers,
    ticketCategories,
    counts,
    filters,
    updateFilter,
    resetFilter,
    refresh,
    filteredTickets,
    filteredLeaves,
    filteredIntimations,
    filteredAttendance,
    approveItem,
    rejectItem,
    approveTicket,
    reworkTicket,
    moveTicketApproval
  };
}
