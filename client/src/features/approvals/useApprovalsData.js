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

function sortApprovalRows(rows = [], getDateValue) {
  return [...rows].sort((left, right) => {
    const actionableDiff = Number(Boolean(right?._isActionableByMe)) - Number(Boolean(left?._isActionableByMe));
    if (actionableDiff) return actionableDiff;

    const rightDate = new Date(getDateValue(right) || right?.['Last Update Date'] || right?.Timestamp || 0).getTime();
    const leftDate = new Date(getDateValue(left) || left?.['Last Update Date'] || left?.Timestamp || 0).getTime();
    return rightDate - leftDate;
  });
}

export function useApprovalsData() {
  const { user } = useAuth();
  const employeeId = user?.['Employee ID'] || '';
  const [activeTab, setActiveTab] = useState('tickets');
  const [filters, setFilters] = useState({
    tickets: { employee: '', category: '', startDate: '', endDate: '', search: '', status: '' },
    leaves: { employee: '', startDate: '', endDate: '', search: '', status: '' },
    intimations: { employee: '', startDate: '', endDate: '', search: '', status: '' },
    attendance: { employee: '', startDate: '', endDate: '', search: '', status: '' }
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
      const isPending = /pending approval|hr approved/i.test(ticket.Status);
      const isStatusMatch = !filter.status || 
        (filter.status === 'pending' && isPending) || 
        (filter.status === 'approved' && /approved/i.test(ticket.Status) && !isPending) ||
        (filter.status === 'rejected' && /reject|rework|closed/i.test(ticket.Status));

      return (
        isStatusMatch &&
        includesFilter(employeeText, filter.employee) &&
        (!filter.category || (ticket['Task Category'] || ticket.Category) === filter.category) &&
        inDateRange(ticket['Plan Date'], filter.startDate, filter.endDate) &&
        includesFilter(searchable, filter.search)
      );
    });
  }, [filters.tickets, state.data.tickets]);

  const filteredLeaves = useMemo(() => {
    const filter = filters.leaves;
    const rows = state.data.leaves.filter((item) => {
      const employeeText = `${item['Employee Name'] || item.employeeName || ''} ${item['Employee ID'] || item.employeeId || ''}`;
      const searchable = [item['Leave Type'] || item.leaveType || item.type, item.Reason || item.reason, item['Day Type'] || item.dayType].join(' ');
      const isPending = /pending/i.test(item.Status);
      const isStatusMatch = !filter.status || 
        (filter.status === 'pending' && isPending) || 
        (filter.status === 'approved' && /approved/i.test(item.Status)) ||
        (filter.status === 'rejected' && /reject/i.test(item.Status));

      return (
        isStatusMatch &&
        includesFilter(employeeText, filter.employee) &&
        inDateRange(item['Start Date'] || item.startDate, filter.startDate, filter.endDate) &&
        inDateRange(item['End Date'] || item.endDate, filter.startDate, filter.endDate) &&
        includesFilter(searchable, filter.search)
      );
    });
    return sortApprovalRows(rows, (item) => item?.['Start Date'] || item?.startDate);
  }, [filters.leaves, state.data.leaves]);

  const filteredIntimations = useMemo(() => {
    const filter = filters.intimations;
    const rows = state.data.intimations.filter((item) => {
      const employeeText = `${item['Employee Name'] || item.employeeName || ''} ${item['Employee ID'] || item.employeeId || ''}`;
      const searchable = [item['Intimation Type'] || item.type, item.Reason || item.reason].join(' ');
      const isPending = /pending|submitted/i.test(item.Status);
      const isStatusMatch = !filter.status || 
        (filter.status === 'pending' && isPending) || 
        (filter.status === 'approved' && /approved/i.test(item.Status)) ||
        (filter.status === 'rejected' && /reject/i.test(item.Status));

      return (
        isStatusMatch &&
        includesFilter(employeeText, filter.employee) &&
        inDateRange(item['Intimation Date'] || item.Date || item.date, filter.startDate, filter.endDate) &&
        includesFilter(searchable, filter.search)
      );
    });
    return sortApprovalRows(rows, (item) => item?.['Intimation Date'] || item?.Date || item?.date);
  }, [filters.intimations, state.data.intimations]);

  const filteredAttendance = useMemo(() => {
    const filter = filters.attendance;
    return state.data.attendance.filter((item) => {
      const employeeText = `${item['Employee Name'] || ''} ${item['Employee ID'] || ''}`;
      const searchable = [item.Status, item.Remarks, item['Admin Remarks']].join(' ');
      const isPending = /pending|need approval/i.test(item.Status);
      const isStatusMatch = !filter.status || 
        (filter.status === 'pending' && isPending) || 
        (filter.status === 'approved' && /present|approved/i.test(item.Status) && !isPending) ||
        (filter.status === 'rejected' && /reject|absent/i.test(item.Status));

      return (
        isStatusMatch &&
        includesFilter(employeeText, filter.employee) &&
        inDateRange(item.Date || item.DateStr, filter.startDate, filter.endDate) &&
        includesFilter(searchable, filter.search)
      );
    });
  }, [filters.attendance, state.data.attendance]);

  const counts = useMemo(
    () => ({
      tickets: state.data.tickets.filter((t) => t._isActionableByMe === true).length,
      leaves: state.data.leaves.filter((l) => l._isActionableByMe === true).length,
      intimations: state.data.intimations.filter((i) => i._isActionableByMe === true).length,
      attendance: state.data.attendance.filter((a) => a._isActionableByMe === true).length
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
        search: '',
        status: ''
      }
    }));
  }

  function refresh() {
    refreshRef.current += 1;
    setState((current) => ({ ...current }));
  }

  function keepApprovedItemVisible(tab) {
    setFilters((current) => {
      if (!current?.[tab] || current[tab].status !== 'pending') return current;
      return {
        ...current,
        [tab]: {
          ...current[tab],
          status: ''
        }
      };
    });
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

  function approveItem(type, id, values = {}) {
    const payload = typeof values === 'string' ? { remarks: values } : values;
    return runAction(
      () => submitApprovalAction({
        adminId: employeeId,
        type,
        id,
        action: 'Approved',
        remarks: payload.remarks || '',
        ...(payload.newPunchIn ? { newPunchIn: payload.newPunchIn } : {}),
        ...(payload.newPunchOut ? { newPunchOut: payload.newPunchOut } : {})
      }),
      `${type} approved successfully.`
    ).then((result) => {
      if (result?.success) {
        const tab = /leave/i.test(type) ? 'leaves' : /intimation/i.test(type) ? 'intimations' : /attendance/i.test(type) ? 'attendance' : '';
        if (tab) keepApprovedItemVisible(tab);
      }
      return result;
    });
  }

  function rejectItem(type, id, values = {}) {
    const payload = typeof values === 'string' ? { remarks: values } : values;
    return runAction(
      () => submitApprovalAction({
        adminId: employeeId,
        type,
        id,
        action: 'Rejected',
        remarks: payload.remarks || ''
      }),
      `${type} rejected successfully.`
    ).then((result) => {
      if (result?.success) {
        const tab = /leave/i.test(type) ? 'leaves' : /intimation/i.test(type) ? 'intimations' : /attendance/i.test(type) ? 'attendance' : '';
        if (tab) keepApprovedItemVisible(tab);
      }
      return result;
    });
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
