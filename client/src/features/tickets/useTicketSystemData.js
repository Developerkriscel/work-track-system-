import { useEffect, useMemo, useState } from 'react';
import {
  createTicket,
  createBulkTickets,
  fetchTicketDetails,
  fetchTicketMessages,
  fetchTicketSystemData,
  markTicketMessagesRead,
  postTicketMessage,
  reassignTicket,
  submitTicketApprovalAction,
  submitClientResponse,
  transferTicketApproval,
  updateTicket,
  updateTicketSchedule
} from '@/features/tickets/api';
import { useAuth } from '@/features/auth/AuthProvider';

function sortStatusWeight(status) {
  const value = String(status || '').trim().toLowerCase();
  
  // Actionable tickets go to the top (1-9)
  if (value === 'in progress') return 1;
  if (value === 'open') return 2;
  if (value === 'approved') return 3; // 'Approved' means approved by admin, ready to start!
  if (value === 'paused') return 4;
  if (value === 'rework' || value === 'reassigned' || value.includes('rework')) return 5;
  
  // Terminal or waiting tickets go to the very bottom (90+)
  if (value === 'pending approval' || value.includes('pending')) return 90;
  if (value === 'completed') return 91;
  if (value === 'closed' || value === 'approved by client' || value === 'cancelled') return 92;
  if (value.includes('approved')) return 93;
  
  // Any other status (e.g. Assigned, New, Not Started) should be treated as active and put above the terminal ones
  return 10;
}

export const ticketStatusOptions = [
  'In Progress',
  'Open',
  'Paused',
  'Rework / Reassigned',
  'Pending Approval',
  'Closed'
];

function normalizeDate(value) {
  if (!value) return null;
  const raw = String(value).trim();
  const ymd = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymd) return new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]));
  const dmy = raw.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (dmy) return new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function filterTickets(tickets, filters) {
  const clientIds = filters.clientIds;
  const statuses = filters.statuses;
  const search = filters.search.trim().toLowerCase();

  function matchesPeriod(ticket) {
    if (!filters.timePeriod || filters.timePeriod === 'All Time') return true;
    const rawDate = ticket['Plan Date'] || ticket.Date || ticket.Timestamp;
    const date = normalizeDate(rawDate);
    if (!date) return false;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const value = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const day = today.getDay();
    const mondayOffset = day === 0 ? 6 : day - 1;
    const startThisWeek = new Date(today);
    startThisWeek.setDate(today.getDate() - mondayOffset);
    const startLastWeek = new Date(startThisWeek);
    startLastWeek.setDate(startThisWeek.getDate() - 7);
    const endLastWeek = new Date(startThisWeek);
    endLastWeek.setDate(startThisWeek.getDate() - 1);
    const startThisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const startLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const endLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
    if (filters.timePeriod === 'Today') return value.getTime() === today.getTime();
    if (filters.timePeriod === 'This Week') return value >= startThisWeek && value <= today;
    if (filters.timePeriod === 'Last Week') return value >= startLastWeek && value <= endLastWeek;
    if (filters.timePeriod === 'This Month') return value >= startThisMonth && value <= today;
    if (filters.timePeriod === 'Last Month') return value >= startLastMonth && value <= endLastMonth;
    return true;
  }

  return tickets.filter((ticket) => {
    const matchesClient =
      !clientIds.length ||
      clientIds.some((clientId) => [ticket.Client_Id, ticket['Client ID']].some((value) => String(value || '').toLowerCase() === String(clientId).toLowerCase()));

    const ticketStatus = String(ticket.Status || '');
    const matchesStatus = !statuses.length || statuses.some((status) => {
      if (status === 'Rework / Reassigned') return /rework|reassigned/i.test(ticketStatus);
      return status.trim().toLowerCase() === ticketStatus.trim().toLowerCase();
    });

    const matchesSearch =
      !search ||
      [
        ticket['Ticket ID'],
        ticket['Task Description'],
        ticket.Name,
        ticket['Employee Name'],
        ticket.Status,
        ticket.Priority
      ]
        .join(' ')
        .toLowerCase()
        .includes(search);

    return matchesClient && matchesStatus && matchesSearch && matchesPeriod(ticket);
  });
}

function sortTickets(tickets) {
  return [...tickets].sort((a, b) => {
    const statusDiff = sortStatusWeight(a.Status) - sortStatusWeight(b.Status);
    if (statusDiff !== 0) return statusDiff;
    const dateA = normalizeDate(a['Plan Date'])?.getTime() || 0;
    const dateB = normalizeDate(b['Plan Date'])?.getTime() || 0;
    if (dateB !== dateA) return dateB - dateA;
    const startA = String(a['Start Time'] || '');
    const startB = String(b['Start Time'] || '');
    return startB.localeCompare(startA);
  });
}

export function useTicketSystemData() {
  const { user } = useAuth();
  const employeeId = user?.['Employee ID'] || '';
  const [state, setState] = useState({
    loading: true,
    error: null,
    payload: null
  });
  const [filters, setFilters] = useState({
    clientIds: [],
    statuses: [],
    search: '',
    timePeriod: 'All Time'
  });
  const [appliedFilters, setAppliedFilters] = useState(filters);
  const [submitting, setSubmitting] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [activeTab, setActiveTab] = useState('my');
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10, total: 0, totalPages: 1, start: 0, end: 0 });

  const reload = () => {
    setRefreshKey((current) => current + 1);
  };

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

    async function load() {
      setState((current) => ({ ...current, loading: true, error: null }));
      try {
        const payload = await fetchTicketSystemData(employeeId, {
          page: pagination.page,
          pageSize: pagination.pageSize,
          viewMode: activeTab,
          filters: appliedFilters
        });
        if (!alive) return;
        const nextPagination = payload.pagination || {};
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
          error: error.message || 'Failed to load ticket system.',
          payload: null
        });
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, [employeeId, refreshKey, activeTab, appliedFilters, pagination.page, pagination.pageSize]);

  useEffect(() => {
    if (!employeeId || activeTab !== 'my' || appliedFilters.search || appliedFilters.clientIds.length || appliedFilters.statuses.length || appliedFilters.timePeriod !== 'All Time') {
      return undefined;
    }
    const role = String(user?.Role || user?.role || '').toLowerCase();
    if (!['super admin', 'admin', 'manager', 'hr'].includes(role)) {
      return undefined;
    }
    const timer = setTimeout(() => {
      void fetchTicketSystemData(employeeId, {
        page: 1,
        pageSize: 10,
        viewMode: 'team',
        filters: {
          clientIds: [],
          statuses: [],
          search: '',
          timePeriod: 'All Time'
        }
      }).catch(() => null);
    }, 250);
    return () => clearTimeout(timer);
  }, [employeeId, activeTab, appliedFilters, user]);

  const rawTickets = state.payload?.tickets || [];
  const clients = state.payload?.clients?.length
    ? state.payload.clients
    : state.payload?.dropdowns?.clients || [];
  const users = state.payload?.users || [];
  const allUsers = state.payload?.allUsers || state.payload?.dropdowns?.allUsers || users;
  const categories = state.payload?.categories || [];
  const clientOriginRawTickets = state.payload?.clientOriginTickets || [];
  const rawBuddyTickets = state.payload?.buddyTickets || [];

  const filteredTickets = useMemo(
    () => sortTickets(filterTickets(rawTickets, appliedFilters)),
    [rawTickets, appliedFilters]
  );
  const filteredClientOriginTickets = useMemo(
    () => sortTickets(filterTickets(clientOriginRawTickets, appliedFilters)),
    [clientOriginRawTickets, appliedFilters]
  );
  const filteredBuddyTickets = useMemo(
    () => sortTickets(filterTickets(rawBuddyTickets, appliedFilters)),
    [rawBuddyTickets, appliedFilters]
  );

  function applyFilters() {
    setPagination((current) => ({ ...current, page: 1 }));
    setAppliedFilters(filters);
  }

  function resetFilters() {
    const next = { clientIds: [], statuses: [], search: '', timePeriod: 'All Time' };
    setFilters(next);
    setPagination((current) => ({ ...current, page: 1 }));
    setAppliedFilters(next);
  }

  function changeActiveTab(nextTab) {
    setPagination((current) => ({ ...current, page: 1 }));
    setActiveTab(nextTab);
  }

  function changeTicketPage(nextPage) {
    setPagination((current) => ({ ...current, page: Math.max(1, Number(nextPage) || 1) }));
  }

  function changeTicketPageSize(nextPageSize) {
    setPagination((current) => ({ ...current, page: 1, pageSize: Number(nextPageSize) || 10 }));
  }

  async function submitNewTicket(payload) {
    setSubmitting(true);
    try {
      const response = await createTicket(payload);
      reload();
      return { success: true, response };
    } catch (error) {
      return { success: false, message: error.message || 'Ticket create failed.' };
    } finally {
      setSubmitting(false);
    }
  }

  async function submitNewTickets(tickets) {
    setSubmitting(true);
    try {
      const response = await createBulkTickets(tickets);
      reload();
      return { success: true, response };
    } catch (error) {
      return { success: false, message: error.message || 'Bulk ticket create failed.' };
    } finally {
      setSubmitting(false);
    }
  }

  async function submitTicketStatus(ticketId, updatePayload) {
    setSubmitting(true);
    try {
      const response = await updateTicket(ticketId, updatePayload);
      reload();
      return { success: true, response };
    } catch (error) {
      return { success: false, message: error.message || 'Ticket update failed.' };
    } finally {
      setSubmitting(false);
    }
  }

  async function submitSchedule(ticketId, tat, planDate, reason) {
    setSubmitting(true);
    try {
      const response = await updateTicketSchedule(ticketId, tat, planDate, reason, employeeId);
      reload();
      return { success: true, response };
    } catch (error) {
      return { success: false, message: error.message || 'Schedule update failed.' };
    } finally {
      setSubmitting(false);
    }
  }

  async function submitReassign(ticketId, targetId, remarks) {
    setSubmitting(true);
    try {
      const response = await reassignTicket(ticketId, targetId, employeeId, remarks);
      reload();
      return { success: true, response };
    } catch (error) {
      return { success: false, message: error.message || 'Ticket reassignment failed.' };
    } finally {
      setSubmitting(false);
    }
  }

  async function submitApprovalAction(ticketId, action, remarks) {
    setSubmitting(true);
    try {
      const response = await submitTicketApprovalAction(ticketId, action, remarks);
      reload();
      return { success: true, response };
    } catch (error) {
      return { success: false, message: error.message || 'Approval action failed.' };
    } finally {
      setSubmitting(false);
    }
  }

  async function submitApprovalTransfer(ticketId, targetManagerId, remarks) {
    setSubmitting(true);
    try {
      const response = await transferTicketApproval(ticketId, targetManagerId, remarks);
      reload();
      return { success: true, response };
    } catch (error) {
      return { success: false, message: error.message || 'Approval transfer failed.' };
    } finally {
      setSubmitting(false);
    }
  }

  async function submitClientTicketResponse(ticketId, responseText, planDate, attachment) {
    setSubmitting(true);
    try {
      const response = await submitClientResponse(ticketId, responseText, planDate, attachment);
      reload();
      return { success: true, response };
    } catch (error) {
      return { success: false, message: error.message || 'Client response could not be saved.' };
    } finally {
      setSubmitting(false);
    }
  }

  async function loadTicketMessages(ticketId) {
    return fetchTicketMessages(ticketId);
  }

  async function loadTicketDetails(ticketId) {
    return fetchTicketDetails(ticketId);
  }

  async function submitTicketMessage(ticketId, messageText) {
    try {
      const response = await postTicketMessage(ticketId, messageText, employeeId);
      return { success: true, response };
    } catch (error) {
      return { success: false, message: error.message || 'Message could not be sent.' };
    }
  }

  return {
    employeeId,
    currentUser: user || null,
    loading: state.loading,
    error: state.error, clearError: () => setState((current) => ({ ...current, error: null })),
    submitting,
    activeTab,
    setActiveTab: changeActiveTab,
    clients,
    users,
    allUsers,
    categories,
    tickets: filteredTickets,
    buddyTickets: filteredBuddyTickets,
    clientOriginTickets: filteredClientOriginTickets,
    canViewClientTickets: Boolean(state.payload?.canViewClientTickets),
    counts: state.payload?.counts || { my: 0, team: 0, client: 0, buddy: 0 },
    pagination,
    setTicketPage: changeTicketPage,
    setTicketPageSize: changeTicketPageSize,
    filters,
    setFilters,
    applyFilters,
    resetFilters,
    reload,
    submitNewTicket,
    submitNewTickets,
    submitTicketStatus,
    submitSchedule,
    submitReassign,
    submitApprovalAction,
    submitApprovalTransfer,
    submitClientTicketResponse,
    loadTicketDetails,
    loadTicketMessages,
    submitTicketMessage,
    markTicketMessagesRead
  };
}
