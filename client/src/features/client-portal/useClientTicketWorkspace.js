import { useCallback, useMemo, useState } from 'react';
import { Tickets } from '@/components/common/icons';
import {
  createClientTickets,
  fetchClientTickets,
  submitClientTicketResponse,
  updateClientTicketStatus
} from '@/features/client-portal/api';
import {
  clientTicketPriorityTone,
  displayClientTicketStatus,
  fileToBase64Attachment,
  groupClientTickets,
  makeClientTicketDraft,
  resolveClientRange,
  shortIsoDate,
  shortTicketDescription,
  sortClientTickets,
  ticketLatestUpdate,
  ticketLatestUpdatePreview,
  ticketStatusTone
} from '@/features/client-portal/services';
import { useClientPortalResource } from '@/features/client-portal/useClientPortalResource';

const EMPTY_ROWS = Object.freeze([]);

const RANGE_OPTIONS = Object.freeze([
  { value: 'all', label: 'All Time' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'custom', label: 'Custom Range' }
]);

const TAB_CONFIG = Object.freeze([
  { value: 'all', label: 'All Tickets' },
  { value: 'open', label: 'Pending/Open' },
  { value: 'response', label: 'Awaiting Response' },
  { value: 'closed', label: 'Closed' }
]);

const MODE_CONFIG = Object.freeze([
  { value: 'list', label: 'All Tickets' },
  { value: 'form', label: 'Submit New Ticket' }
]);

export function useClientTicketWorkspace() {
  const [activeMode, setActiveMode] = useState('list');
  const [activeTab, setActiveTab] = useState('all');
  const [range, setRange] = useState('all');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [draftRows, setDraftRows] = useState([makeClientTicketDraft()]);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);
  const [refreshToken, setRefreshToken] = useState(0);

  const loadResource = useCallback(async (clientId) => {
    const resolved = resolveClientRange(range, customStart, customEnd);
    const payload = await fetchClientTickets(clientId, resolved.startDate, resolved.endDate, null);
    return Array.isArray(payload.data) ? sortClientTickets(payload.data) : EMPTY_ROWS;
  }, [customEnd, customStart, range, refreshToken]);

  const { client, clientId, loading, error, value } = useClientPortalResource(loadResource, EMPTY_ROWS);
  const groupedRows = useMemo(() => groupClientTickets(value), [value]);

  const tabCounts = useMemo(() => ({
    all: groupedRows.all.length,
    open: groupedRows.open.length,
    response: groupedRows.response.length,
    closed: groupedRows.closed.length
  }), [groupedRows]);

  const visibleRows = groupedRows[activeTab] || groupedRows.all;

  const summaryItems = useMemo(() => ([
    { label: 'Total Tickets', value: tabCounts.all, tone: 'purple', Icon: Tickets },
    { label: 'Pending/Open', value: tabCounts.open, tone: 'blue', Icon: Tickets },
    { label: 'Awaiting Response', value: tabCounts.response, tone: 'red', Icon: Tickets },
    { label: 'Closed', value: tabCounts.closed, tone: 'green', Icon: Tickets }
  ]), [tabCounts]);

  const resetDrafts = useCallback(() => {
    setDraftRows([makeClientTicketDraft()]);
  }, []);

  const addDraftRow = useCallback(() => {
    setDraftRows((current) => [...current, makeClientTicketDraft()]);
  }, []);

  const removeDraftRow = useCallback((rowId) => {
    setDraftRows((current) => {
      const next = current.filter((row) => row.id !== rowId);
      return next.length ? next : [makeClientTicketDraft()];
    });
  }, []);

  const updateDraftRow = useCallback((rowId, patch) => {
    setDraftRows((current) => current.map((row) => (row.id === rowId ? { ...row, ...patch } : row)));
  }, []);

  const refresh = useCallback(() => {
    setRefreshToken((current) => current + 1);
  }, []);

  const submitTickets = useCallback(async () => {
    if (!client) {
      setMessage({ tone: 'danger', text: 'Client session is not available.' });
      return { success: false };
    }

    const trimmedRows = draftRows.map((row) => ({
      ...row,
      category: row.category.trim(),
      description: row.description.trim()
    }));

    const invalidRow = trimmedRows.find((row) => !row.category || !row.description);
    if (invalidRow) {
      const failure = { success: false, message: 'Category and description are required for every ticket.' };
      setMessage({ tone: 'danger', text: failure.message });
      return failure;
    }

    setSubmitting(true);
    try {
      const ticketList = await Promise.all(trimmedRows.map(async (row) => ({
        category: row.category,
        description: row.description,
        priority: row.priority || 'Medium',
        completionDate: row.completionDate || '',
        attachments: await Promise.all((row.attachments || []).map(fileToBase64Attachment))
      })));

      const result = await createClientTickets(ticketList, client);
      const success = result?.success !== false;

      setMessage({
        tone: success ? 'success' : 'danger',
        text: success
          ? `${result?.data?.length || ticketList.length} ticket(s) submitted successfully.`
          : (result?.message || 'Unable to submit tickets.')
      });

      if (success) {
        resetDrafts();
        setActiveMode('list');
        setActiveTab('all');
        refresh();
      }

      return result;
    } catch (submissionError) {
      const failure = { success: false, message: submissionError.message || 'Unable to submit tickets.' };
      setMessage({ tone: 'danger', text: failure.message });
      return failure;
    } finally {
      setSubmitting(false);
    }
  }, [client, draftRows, refresh, resetDrafts]);

  const updateStatus = useCallback(async (ticketId, newStatus, remarks = '') => {
    if (!clientId) {
      return { success: false, message: 'Client session is not available.' };
    }

    setSubmitting(true);
    try {
      const result = await updateClientTicketStatus(ticketId, newStatus, remarks, clientId);
      const success = result?.success !== false;
      setMessage({
        tone: success ? 'success' : 'danger',
        text: success
          ? `Ticket ${ticketId} updated to ${newStatus}.`
          : (result?.message || 'Unable to update ticket.')
      });
      if (success) refresh();
      return result;
    } catch (submissionError) {
      const failure = { success: false, message: submissionError.message || 'Unable to update ticket.' };
      setMessage({ tone: 'danger', text: failure.message });
      return failure;
    } finally {
      setSubmitting(false);
    }
  }, [clientId, refresh]);

  const submitResponse = useCallback(async (ticketId, remarks, file) => {
    if (!client) {
      return { success: false, message: 'Client session is not available.' };
    }

    setSubmitting(true);
    try {
      const attachment = file ? await fileToBase64Attachment(file) : null;
      const result = await submitClientTicketResponse(ticketId, remarks, attachment, client);
      const success = result?.success !== false;
      setMessage({
        tone: success ? 'success' : 'danger',
        text: success
          ? `Response sent for ${ticketId}.`
          : (result?.message || 'Unable to send response.')
      });
      if (success) {
        setActiveTab('open');
        refresh();
      }
      return result;
    } catch (submissionError) {
      const failure = { success: false, message: submissionError.message || 'Unable to send response.' };
      setMessage({ tone: 'danger', text: failure.message });
      return failure;
    } finally {
      setSubmitting(false);
    }
  }, [client, refresh]);

  return {
    activeMode,
    activeTab,
    client,
    customEnd,
    customStart,
    draftRows,
    error,
    groupedRows,
    loading,
    message,
    modeOptions: MODE_CONFIG,
    range,
    rangeOptions: RANGE_OPTIONS,
    setActiveMode,
    setActiveTab,
    setCustomEnd,
    setCustomStart,
    setMessage,
    setRange,
    submitting,
    submitResponse,
    submitTickets,
    summaryItems,
    tabCounts,
    tabOptions: TAB_CONFIG,
    ticketPriorityTone: clientTicketPriorityTone,
    ticketStatusLabel: displayClientTicketStatus,
    ticketStatusTone,
    visibleRows,
    updateStatus,
    addDraftRow,
    removeDraftRow,
    resetDrafts,
    updateDraftRow,
    refresh,
    formatDate: shortIsoDate,
    latestUpdate: ticketLatestUpdate,
    latestUpdatePreview: ticketLatestUpdatePreview,
    shortDescription: shortTicketDescription
  };
}
