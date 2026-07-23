import { useState } from 'react';
import { ConfirmDialog } from '@/features/tickets/components/ConfirmDialog';
import { StatusPill } from '@/components/common/StatusPill';
import { TicketCreateForm } from '@/features/tickets/components/TicketCreateForm';
import { TicketChatDialog } from '@/features/tickets/components/TicketChatDialog';
import { TicketFilterPanel } from '@/features/tickets/components/TicketFilterPanel';
import { TicketReassignDialog } from '@/features/tickets/components/TicketReassignDialog';
import { TicketScheduleDialog } from '@/features/tickets/components/TicketScheduleDialog';
import { TicketActionDialog } from '@/features/tickets/components/TicketActionDialog';
import { TicketApprovalTransferDialog } from '@/features/tickets/components/TicketApprovalTransferDialog';
import { TicketClientResponseDialog } from '@/features/tickets/components/TicketClientResponseDialog';
import { TicketDetailsDialog } from '@/features/tickets/components/TicketDetailsDialog';
import { TicketHeader } from '@/features/tickets/components/TicketHeader';
import { TicketTable } from '@/features/tickets/components/TicketTable';
import { ticketStatusOptions, useTicketSystemData } from '@/features/tickets/useTicketSystemData';

export function TicketSystemPage() {
  const {
    employeeId,
    currentUser,
    loading,
    error,
    submitting,
    clients,
    users,
    categories,
    tickets,
    filters,
    setFilters,
    applyFilters,
    resetFilters,
    submitNewTicket,
    submitNewTickets,
    submitTicketStatus,
    submitSchedule,
    submitReassign,
    submitApprovalAction,
    submitApprovalTransfer,
    submitClientTicketResponse,
    loadTicketMessages,
    submitTicketMessage
  } = useTicketSystemData();

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [message, setMessage] = useState(null);
  const [reassignTicket, setReassignTicket] = useState(null);
  const [scheduleTicket, setScheduleTicket] = useState(null);
  const [chatTicket, setChatTicket] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatSending, setChatSending] = useState(false);
  const [activeTab, setActiveTab] = useState('my');
  const [actionDialog, setActionDialog] = useState(null);
  const [transferDialog, setTransferDialog] = useState(null);
  const [clientResponseTicket, setClientResponseTicket] = useState(null);
  const [detailsTicket, setDetailsTicket] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null); // { onConfirm }
  const role = currentUser?.Role || currentUser?.role || 'User';
  const canViewTeam = ['Super Admin', 'Admin', 'Manager', 'HR'].includes(role);
  const visibleTickets = activeTab === 'team' && canViewTeam ? tickets : tickets.filter((ticket) => String(ticket['Employee ID'] || '').toLowerCase() === String(employeeId).toLowerCase());

  const handleCreate = async (payload) => {
    const result = Array.isArray(payload) ? await submitNewTickets(payload) : await submitNewTicket(payload);
    if (result.success) {
      setMessage({ tone: 'success', text: 'Ticket created successfully.' });
      setShowCreateForm(false);
    } else {
      setMessage({ tone: 'danger', text: result.message });
    }
  };

  const handleStatusAction = async (ticket, newStatus) => {
    if (newStatus === 'Paused' || newStatus === 'Completed') {
      setActionDialog({ ticket, action: newStatus });
      return;
    }

    // If trying to start a ticket, check for existing 'In Progress' ticket
    if (newStatus === 'In Progress') {
      const runningTicket = tickets.find(
        (t) =>
          t.Status === 'In Progress' &&
          String(t['Employee ID'] || '').toLowerCase() === String(employeeId || '').toLowerCase() &&
          t['Ticket ID'] !== ticket['Ticket ID']
      );
      if (runningTicket) {
        setConfirmDialog({
          runningTicketId: runningTicket['Ticket ID'],
          newTicket: ticket,
          onConfirm: async () => {
            setConfirmDialog(null);
            // First pause the running ticket
            await submitTicketStatus(runningTicket['Ticket ID'], {
              newStatus: 'Paused',
              updatedBy: employeeId,
              newRemarks: '[System]: Auto-paused to start another ticket.'
            });
            // Then start the new ticket
            const result = await submitTicketStatus(ticket['Ticket ID'], {
              newStatus: 'In Progress',
              updatedBy: employeeId,
              newRemarks: 'Updated to In Progress from Work Track System.'
            });
            setMessage({
              tone: result.success ? 'success' : 'danger',
              text: result.success
                ? `Ticket ${ticket['Ticket ID']} started. Previous ticket auto-paused.`
                : result.message
            });
          }
        });
        return;
      }
    }

    const remarks = `Updated to ${newStatus} from Work Track System.`;
    const result = await submitTicketStatus(ticket['Ticket ID'], {
      newStatus,
      updatedBy: employeeId,
      newRemarks: remarks
    });
    setMessage({
      tone: result.success ? 'success' : 'danger',
      text: result.success ? `Ticket ${ticket['Ticket ID']} updated to ${newStatus}.` : result.message
    });
  };

  const handleApprovalAction = (ticket, action) => setActionDialog({ ticket, action });
  const submitActionDialog = async (remarks, attachments = []) => {
    const { ticket, action } = actionDialog;
    const result = action === 'Approve' || action === 'Rework'
      ? await submitApprovalAction(ticket['Ticket ID'], action, remarks)
      : await submitTicketStatus(ticket['Ticket ID'], { newStatus: action, updatedBy: employeeId, newRemarks: remarks, attachment: attachments });
    setMessage({ tone: result.success ? 'success' : 'danger', text: result.success ? 'Ticket updated successfully.' : result.message });
    if (result.success) setActionDialog(null);
  };

  const handleScheduleAction = async (ticket) => {
    setScheduleTicket(ticket);
  };

  const handleScheduleSubmit = async (tat, planDate, reason) => {
    const ticket = scheduleTicket;
    const result = await submitSchedule(ticket['Ticket ID'], tat, planDate, reason);
    setMessage({
      tone: result.success ? 'success' : 'danger',
      text: result.success ? `Schedule updated for ${ticket['Ticket ID']}.` : result.message
    });
    if (result.success) setScheduleTicket(null);
  };

  const handleReassign = async (targetId, remarks) => {
    const ticket = reassignTicket?.ticket || reassignTicket;
    if (!ticket) return;
    const result = targetId === 'client'
      ? await submitReassign(ticket['Ticket ID'], 'client', remarks)
      : await submitReassign(ticket['Ticket ID'], targetId, remarks);
    setMessage({
      tone: result.success ? 'success' : 'danger',
      text: result.success ? (targetId === 'client' ? 'Ticket sent to client successfully.' : 'Ticket reassigned successfully.') : result.message
    });
    if (result.success) setReassignTicket(null);
  };

  const openChat = async (ticket) => {
    setChatTicket(ticket);
    setChatMessages([]);
    setChatLoading(true);
    try {
      const result = await loadTicketMessages(ticket['Ticket ID']);
      setChatMessages(result.messages || result.data || []);
    } catch (error) {
      setMessage({ tone: 'danger', text: error.message || 'Unable to load ticket discussion.' });
    } finally {
      setChatLoading(false);
    }
  };

  const sendChat = async (text) => {
    setChatSending(true);
    const result = await submitTicketMessage(chatTicket['Ticket ID'], text);
    if (result.success) {
      const latest = await loadTicketMessages(chatTicket['Ticket ID']);
      setChatMessages(latest.messages || latest.data || []);
    }
    setChatSending(false);
    if (!result.success) setMessage({ tone: 'danger', text: result.message });
    return result;
  };

  const handleToggleCreateForm = () => {
    const openTicket = visibleTickets.find(
      (t) =>
        t.Status && t.Status.toLowerCase() === 'in progress' &&
        String(t['Employee ID'] || t['employeeId'] || '').toLowerCase() === String(employeeId || '').toLowerCase()
    );
    if (openTicket) {
      setConfirmDialog({
        onConfirm: () => {
          setConfirmDialog(null);
          setShowCreateForm(true);
        }
      });
      return;
    }
    setShowCreateForm((current) => !current);
  };

  return (
    <section className="page-card">


      <TicketFilterPanel
        showCreateForm={showCreateForm}
        clients={clients}
        uniqueStatuses={ticketStatusOptions}
        filters={filters}
        onReset={resetFilters}
        onApply={applyFilters}
        onToggleCreateForm={handleToggleCreateForm}
        onFiltersChange={setFilters}
      />

      {message ? (
        <div className={`dashboard-banner${message.tone === 'danger' ? ' dashboard-banner--error' : ''}`}>
          <StatusPill tone={message.tone === 'danger' ? 'danger' : 'success'}>
            {message.tone === 'danger' ? 'Issue' : 'Done'}
          </StatusPill>
          <span>{message.text}</span>
        </div>
      ) : null}

      {showCreateForm ? (
        <article className="migration-panel migration-panel--full">
          <h2>Create New Ticket</h2>
          <TicketCreateForm
            clients={clients}
            categories={categories}
            employeeId={employeeId}
            users={users}
            role={role}
            submitting={submitting}
            onSubmit={handleCreate}
            onCancel={() => setShowCreateForm(false)}
          />
        </article>
      ) : null}

      {error ? <div className="dashboard-banner dashboard-banner--error">{error}</div> : null}

      <article className="migration-panel migration-panel--full">
        <div className="migration-panel__row" style={{ justifyContent: 'space-between', paddingBottom: '12px' }}>
          <div className="view-mode-tabs" style={{ marginBottom: 0 }}>
            <button type="button" className={activeTab === 'my' ? 'view-mode-tab view-mode-tab--active' : 'view-mode-tab'} onClick={() => setActiveTab('my')}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="view-mode-tab__icon"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
              My Tickets
            </button>
            {canViewTeam ? (
              <button type="button" className={activeTab === 'team' ? 'view-mode-tab view-mode-tab--active' : 'view-mode-tab'} onClick={() => setActiveTab('team')}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="view-mode-tab__icon"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
                Team Tickets
              </button>
            ) : null}
          </div>
          <StatusPill tone={loading ? 'neutral' : 'info'}>
            {loading ? 'Refreshing' : `${visibleTickets.length} tickets`}
          </StatusPill>
        </div>
      <TicketTable
          tickets={visibleTickets}
          role={role}
          submitting={submitting}
          onStatusAction={handleStatusAction}
          onScheduleAction={handleScheduleAction}
          onReassign={setReassignTicket}
          onChat={openChat}
          onApprovalAction={handleApprovalAction}
          onApprovalTransfer={setTransferDialog}
          onClientResponse={(ticket, mode) => {
            if (mode === 'client-send') {
              setReassignTicket({ ticket, mode: 'client' });
              return;
            }
            setClientResponseTicket(ticket);
          }}
          onDetails={setDetailsTicket}
        />
      </article>
      {reassignTicket ? <TicketReassignDialog ticket={reassignTicket.ticket || reassignTicket} mode={reassignTicket.mode || 'user'} users={users} saving={submitting} onClose={() => setReassignTicket(null)} onSubmit={handleReassign} /> : null}
      {scheduleTicket ? <TicketScheduleDialog ticket={scheduleTicket} saving={submitting} onClose={() => setScheduleTicket(null)} onSubmit={handleScheduleSubmit} /> : null}
      {chatTicket ? <TicketChatDialog ticket={chatTicket} messages={chatMessages} loading={chatLoading} sending={chatSending} onClose={() => setChatTicket(null)} onSend={sendChat} /> : null}
      {actionDialog ? <TicketActionDialog ticket={actionDialog.ticket} action={actionDialog.action} saving={submitting} onClose={() => setActionDialog(null)} onSubmit={submitActionDialog} /> : null}
      {transferDialog ? <TicketApprovalTransferDialog ticket={transferDialog} users={users} saving={submitting} onClose={() => setTransferDialog(null)} onSubmit={async (target, remarks) => { const result = await submitApprovalTransfer(transferDialog['Ticket ID'], target, remarks); setMessage({ tone: result.success ? 'success' : 'danger', text: result.success ? 'Approval transferred.' : result.message }); if (result.success) setTransferDialog(null); }} /> : null}
      {clientResponseTicket ? <TicketClientResponseDialog ticket={clientResponseTicket} saving={submitting} onClose={() => setClientResponseTicket(null)} onSubmit={async (responseText, planDate, attachment) => { const result = await submitClientTicketResponse(clientResponseTicket['Ticket ID'], responseText, planDate, attachment); setMessage({ tone: result.success ? 'success' : 'danger', text: result.success ? 'Client response saved.' : result.message }); if (result.success) setClientResponseTicket(null); }} /> : null}
      {detailsTicket ? <TicketDetailsDialog ticket={detailsTicket} onClose={() => setDetailsTicket(null)} /> : null}
      {confirmDialog ? (
        <ConfirmDialog
          tone="warning"
          title="Ek Ticket Pehle Se Chal Raha Hai!"
          message={
            confirmDialog.runningTicketId
              ? `Ticket [${confirmDialog.runningTicketId}] abhi "In Progress" mein hai. Naya ticket start karne par yeh automatically Pause ho jayega. Kya aap continue karna chahte hain?`
              : `Aapka ek ticket already "In Progress" hai. Naya ticket start karne se woh automatically close ho jayega. Kya aap continue karna chahte hain?`
          }
          confirmLabel="Haan, Continue Karein"
          cancelLabel="Nahi, Ruk Jao"
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(null)}
        />
      ) : null}
    </section>
  );
}
