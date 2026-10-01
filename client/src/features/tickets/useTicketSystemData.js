import { useEffect, useState } from 'react';
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

export const ticketStatusOptions = [
  'In Progress',
  'Open',
  'Paused',
  'Rework / Reassigned',
  'Pending Approval',
  'Closed'
];

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
    frequencies: [],
    employeeIds: [],
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
    const controller = new AbortController();

    async function load() {
      setState((current) => ({ ...current, loading: true, error: null }));
      try {
        const payload = await fetchTicketSystemData(employeeId, {
          page: pagination.page,
          pageSize: pagination.pageSize,
          viewMode: activeTab,
          filters: appliedFilters
        }, controller.signal);
        if (!alive) return;
        if (payload.success === false) throw new Error(payload.message || 'Failed to load tickets.');
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
        setPagination((current) => ({ ...current, total: 0, totalPages: 1, start: 0, end: 0 }));
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
      controller.abort();
    };
  }, [employeeId, refreshKey, activeTab, appliedFilters, pagination.page, pagination.pageSize]);

  const rawTickets = state.payload?.tickets || [];
  const clients = state.payload?.clients?.length
    ? state.payload.clients
    : state.payload?.dropdowns?.clients || [];
  const users = state.payload?.users || [];
  const allUsers = state.payload?.allUsers || state.payload?.dropdowns?.allUsers || users;
  const categories = state.payload?.categories || [];
  const clientOriginRawTickets = state.payload?.clientOriginTickets || [];
  const rawAutoTickets = state.payload?.autoTickets || [];
  const rawBuddyTickets = state.payload?.buddyTickets || [];

  // The server filters, sorts and paginates the whole scope. Filtering a page again
  // can hide rows while retaining the server total.
  const filteredTickets = rawTickets;
  const filteredClientOriginTickets = clientOriginRawTickets;
  const filteredAutoTickets = rawAutoTickets;
  const filteredBuddyTickets = rawBuddyTickets;

  function applyFilters() {
    setPagination((current) => ({ ...current, page: 1 }));
    setAppliedFilters(filters);
  }

  function applySpecificFilters(newFilters) {
    setFilters(newFilters);
    setPagination((current) => ({ ...current, page: 1 }));
    setAppliedFilters(newFilters);
  }

  function resetFilters() {
    const next = { clientIds: [], statuses: [], search: '', timePeriod: 'All Time' };
    setFilters(next);
    setPagination((current) => ({ ...current, page: 1 }));
    setAppliedFilters(next);
  }

  function changeActiveTab(nextTab) {
    if (nextTab === activeTab) return;
    setState((current) => ({ ...current, loading: true }));
    setPagination((current) => ({ ...current, page: 1, total: 0, totalPages: 1, start: 0, end: 0 }));
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
    autoTickets: filteredAutoTickets,
    buddyTickets: filteredBuddyTickets,
    clientOriginTickets: filteredClientOriginTickets,
    canViewClientTickets: Boolean(state.payload?.canViewClientTickets),
    counts: state.payload?.counts || { my: 0, team: 0, client: 0, auto: 0, buddy: 0 },
    pagination,
    setTicketPage: changeTicketPage,
    setTicketPageSize: changeTicketPageSize,
    filters,
    setFilters,
    applyFilters,
    applySpecificFilters,
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
