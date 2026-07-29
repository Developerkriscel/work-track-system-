import { useState } from 'react';
import { StatusPill } from '@/components/common/StatusPill';
import {
  ClientPortalHeader,
  ClientPortalSummaryGrid,
  ClientTicketChatDialog,
  ClientTicketActionDialog,
  ClientTicketComposer,
  ClientTicketDetailsDialog,
  ClientTicketModeTabs,
  ClientTicketRangeFilter,
  ClientTicketResponseDialog,
  ClientTicketStatusTabs,
  ClientTicketTable
} from '@/features/client-portal/components';
import {
  fetchClientTicketDetails,
  fetchClientTicketMessages,
  markClientTicketMessagesAsRead,
  postClientTicketMessage
} from '@/features/client-portal/api';
import { useClientTicketWorkspace } from '@/features/client-portal/useClientTicketWorkspace';

export function ClientTicketsPage() {
  const {
    activeMode,
    activeTab,
    client,
    customEnd,
    customStart,
    draftRows,
    error,
    formatDate,
    latestUpdate,
    latestUpdatePreview,
    loading,
    message,
    modeOptions,
    range,
    rangeOptions,
    setActiveMode,
    setActiveTab,
    setCustomEnd,
    setCustomStart,
    setMessage,
    setRange,
    shortDescription,
    submitting,
    submitResponse,
    submitTickets,
    summaryItems,
    tabCounts,
    tabOptions,
    ticketPriorityTone,
    ticketStatusLabel,
    ticketStatusTone,
    visibleRows,
    updateStatus,
    addDraftRow,
    removeDraftRow,
    updateDraftRow
  } = useClientTicketWorkspace();
  const [detailsTicket, setDetailsTicket] = useState(null);
  const [chatState, setChatState] = useState({ ticket: null, messages: [], loading: false, sending: false });
  const [responseTicket, setResponseTicket] = useState(null);
  const [statusAction, setStatusAction] = useState(null);

  const handleApprove = async (row) => {
    setStatusAction({ type: 'approve', ticketId: row.ID || row['Ticket ID'] });
  };

  const handleReopen = async (row) => {
    setStatusAction({ type: 'reopen', ticketId: row.ID || row['Ticket ID'] });
  };

  const handleRespond = async (row) => {
    setResponseTicket(row);
  };

  const handleOpenDetails = async (row) => {
    const ticketId = row.ID || row['Ticket ID'];
    try {
      const response = await fetchClientTicketDetails(ticketId, client?.Client_Id || client?.['Client ID'] || null);
      if (response?.success === false) {
        setMessage({ tone: 'danger', text: response.message || 'Unable to load ticket details.' });
        return;
      }
      setDetailsTicket(response.data || row);
    } catch (errorMessage) {
      setMessage({ tone: 'danger', text: errorMessage.message || 'Unable to load ticket details.' });
    }
  };

  const handleOpenChat = async (row) => {
    const ticketId = row.ID || row['Ticket ID'];
    setChatState({ ticket: row, messages: [], loading: true, sending: false });
    try {
      await markClientTicketMessagesAsRead(ticketId, client?.Client_Id || client?.['Client ID'] || null);
      const response = await fetchClientTicketMessages(ticketId);
      if (response?.success === false) {
        setMessage({ tone: 'danger', text: response.message || 'Unable to load ticket discussion.' });
        setChatState({ ticket: null, messages: [], loading: false, sending: false });
        return;
      }
      setChatState({
        ticket: row,
        messages: response.messages || response.data || [],
        loading: false,
        sending: false
      });
    } catch (errorMessage) {
      setMessage({ tone: 'danger', text: errorMessage.message || 'Unable to load ticket discussion.' });
      setChatState({ ticket: null, messages: [], loading: false, sending: false });
    }
  };

  const handleSendChat = async (messageText) => {
    const ticketId = chatState.ticket?.ID || chatState.ticket?.['Ticket ID'];
    if (!ticketId || !client) return { success: false };
    setChatState((current) => ({ ...current, sending: true }));
    try {
      const response = await postClientTicketMessage(ticketId, messageText, client);
      if (response?.success === false) {
        setMessage({ tone: 'danger', text: response.message || 'Unable to send message.' });
        setChatState((current) => ({ ...current, sending: false }));
        return response;
      }
      const refreshResponse = await fetchClientTicketMessages(ticketId);
      setChatState((current) => ({
        ...current,
        messages: refreshResponse.messages || refreshResponse.data || [],
        sending: false
      }));
      return response;
    } catch (errorMessage) {
      setMessage({ tone: 'danger', text: errorMessage.message || 'Unable to send message.' });
      setChatState((current) => ({ ...current, sending: false }));
      return { success: false, message: errorMessage.message };
    }
  };

  const handleSubmitResponse = async (remarks, file) => {
    if (!responseTicket) return { success: false };
    return submitResponse(responseTicket.ID || responseTicket['Ticket ID'], remarks, file);
  };

  const submitStatusAction = async (remarks) => {
    const action = statusAction;
    await updateStatus(action.ticketId, action.type === 'approve' ? 'Approved' : 'Open', remarks);
    setStatusAction(null);
  };

  return (
    <section className="page-card">
      <ClientPortalHeader title="My Tickets" statusLabel={client?.['Client Name'] || 'Client Workspace'} />

      {error ? <div className="dashboard-banner dashboard-banner--error">{error}</div> : null}

      {message ? (
        <div className={`dashboard-banner${message.tone === 'danger' ? ' dashboard-banner--error' : ''}`}>
          <StatusPill tone={message.tone === 'danger' ? 'danger' : 'success'}>
            {message.tone === 'danger' ? 'Issue' : 'Done'}
          </StatusPill>
          <span>{message.text}</span>
          <button type="button" className="inline-action inline-action--ghost" onClick={() => setMessage(null)}>
            Dismiss
          </button>
        </div>
      ) : null}

      <ClientPortalSummaryGrid items={summaryItems} />

      <article className="migration-panel migration-panel--full">
        <div className="migration-panel__row client-ticket-workspace__header">
          <h2>Ticket Workspace</h2>
          <ClientTicketModeTabs activeMode={activeMode} options={modeOptions} onChange={setActiveMode} />
        </div>

        {activeMode === 'list' ? (
          <>
            <div className="client-ticket-workspace__toolbar">
              <ClientTicketStatusTabs activeTab={activeTab} counts={tabCounts} options={tabOptions} onChange={setActiveTab} />
              <ClientTicketRangeFilter
                range={range}
                onRangeChange={setRange}
                rangeOptions={rangeOptions}
                customStart={customStart}
                onCustomStartChange={setCustomStart}
                customEnd={customEnd}
                onCustomEndChange={setCustomEnd}
              />
            </div>

            <ClientTicketTable
              activeTab={activeTab}
              formatDate={formatDate}
              latestUpdate={latestUpdate}
              latestUpdatePreview={latestUpdatePreview}
              loading={loading}
              onApprove={handleApprove}
              onChat={handleOpenChat}
              onOpenDetails={handleOpenDetails}
              onReopen={handleReopen}
              onRespond={handleRespond}
              rows={visibleRows}
              shortDescription={shortDescription}
              statusLabel={ticketStatusLabel}
              statusTone={ticketStatusTone}
              ticketPriorityTone={ticketPriorityTone}
              submitting={submitting}
            />
          </>
        ) : (
          <ClientTicketComposer
            draftRows={draftRows}
            onAddRow={addDraftRow}
            onChangeRow={updateDraftRow}
            onRemoveRow={removeDraftRow}
            onCancel={() => setActiveMode('list')}
            onSubmit={submitTickets}
            submitting={submitting}
          />
        )}
      </article>

      {detailsTicket ? (
        <ClientTicketDetailsDialog
          formatDate={formatDate}
          onClose={() => setDetailsTicket(null)}
          onOpenDiscussion={(ticket) => {
            setDetailsTicket(null);
            handleOpenChat(ticket);
          }}
          ticket={detailsTicket}
          priorityToneResolver={ticketPriorityTone}
          statusLabelResolver={ticketStatusLabel}
          toneResolver={ticketStatusTone}
        />
      ) : null}

      {responseTicket ? (
        <ClientTicketResponseDialog
          onClose={() => setResponseTicket(null)}
          onSubmit={handleSubmitResponse}
          submitting={submitting}
          ticketId={responseTicket.ID || responseTicket['Ticket ID'] || '-'}
        />
      ) : null}

      {statusAction ? <ClientTicketActionDialog action={statusAction} saving={submitting} onClose={() => setStatusAction(null)} onSubmit={submitStatusAction} /> : null}

      {chatState.ticket && !chatState.loading ? (
        <ClientTicketChatDialog
          clientName={client?.['Client Name'] || 'Client'}
          messages={chatState.messages}
          onClose={() => setChatState({ ticket: null, messages: [], loading: false, sending: false })}
          onSend={handleSendChat}
          sending={chatState.sending}
          ticketId={chatState.ticket.ID || chatState.ticket['Ticket ID'] || '-'}
        />
      ) : null}
    </section>
  );
}
