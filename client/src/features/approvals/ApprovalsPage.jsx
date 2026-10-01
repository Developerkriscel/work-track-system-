import { useMemo, useState } from 'react';
import { StatusPill } from '@/components/common/StatusPill';
import { BadgeCheck, Tickets, Users } from '@/components/common/icons';
import { ApprovalsHeader } from '@/features/approvals/components/ApprovalsHeader';
import { ApprovalActionDialog } from '@/features/approvals/components/ApprovalActionDialog';
import { ApprovalsTabsAndFilters } from '@/features/approvals/components/ApprovalsTabsAndFilters';
import { AttendanceApprovalTable, IntimationApprovalTable, LeaveApprovalTable } from '@/features/approvals/components/GenericApprovalTables';
import { TicketApprovalTable } from '@/features/approvals/components/TicketApprovalTable';
import { useApprovalsData } from '@/features/approvals/useApprovalsData';
import { TicketDetailsDialog } from '@/features/tickets/components/TicketDetailsDialog';
import { fetchTicketDetails } from '@/features/tickets/api';

function ApprovalServerPager({ loading, pageInfo = {}, onPageChange }) {
  const page = Math.max(1, Number(pageInfo.page || 1));
  const pageSize = Math.max(1, Number(pageInfo.pageSize || 10));
  const total = Math.max(0, Number(pageInfo.total || 0));
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize && page <= 1) return null;
  const first = total ? ((page - 1) * pageSize) + 1 : 0;
  const last = Math.min(page * pageSize, total);
  return (
    <div className="react-data-table__footer approval-server-pager">
      <span className="react-data-table__info">Showing {first} to {last} of {total} entries</span>
      <div className="react-data-table__pager">
        <button type="button" disabled={loading || page <= 1} onClick={() => onPageChange(1)} aria-label="First page">First</button>
        <button type="button" disabled={loading || page <= 1} onClick={() => onPageChange(Math.max(1, page - 1))} aria-label="Previous page">Prev</button>
        <span className="react-data-table__pager-current">{page}</span>
        <button type="button" disabled={loading || page >= pageCount} onClick={() => onPageChange(Math.min(pageCount, page + 1))} aria-label="Next page">Next</button>
        <button type="button" disabled={loading || page >= pageCount} onClick={() => onPageChange(pageCount)} aria-label="Last page">Last</button>
      </div>
    </div>
  );
}

export function ApprovalsPage() {
  const {
    employeeId,
    currentUser,
    activeTab,
    setActiveTab,
    loading,
    rowsLoading,
    pagination,
    setApprovalPage,
    error, clearError,
    submitting,
    message, clearMessage,
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
  } = useApprovalsData();
  const [actionDialog, setActionDialog] = useState(null);
  const [detailsTicket, setDetailsTicket] = useState(null);

  async function handleViewDetails(row) {
    const ticketId = row['Ticket ID'];
    if (!ticketId) return;
    try {
      const response = await fetchTicketDetails(ticketId);
      setDetailsTicket(response?.item || row);
    } catch {
      setDetailsTicket(row);
    }
  }

  async function submitDialogAction(values) {
    let result;
    if (actionDialog.kind === 'ticket-approve') result = await approveTicket(actionDialog.ticketId, values.remarks);
    if (actionDialog.kind === 'ticket-rework') result = await reworkTicket(actionDialog.ticketId, values.remarks);
    if (actionDialog.kind === 'ticket-transfer') result = await moveTicketApproval(actionDialog.ticketId, values.target, values.remarks);
    if (actionDialog.kind === 'approve') result = await approveItem(actionDialog.type, actionDialog.id, values);
    if (actionDialog.kind === 'reject') result = await rejectItem(actionDialog.type, actionDialog.id, values);
    if (result?.success !== false) setActionDialog(null);
  }

  const totalPending = useMemo(
    () => counts.tickets + counts.leaves + counts.intimations + counts.attendance,
    [counts]
  );

  return (
    <section className="page-card approvals-page">
      <ApprovalsHeader
        employeeLabel={`${currentUser?.['Employee Name'] || currentUser?.Name || 'Approver'}${employeeId ? ` | ${employeeId}` : ''}`}
        onRefresh={refresh}
      />

      {error ? (
        <div className="dashboard-banner dashboard-banner--error">
          <span>{error}</span>
          <button type="button" className="dashboard-banner__close" onClick={clearError}>OK</button>
        </div>
      ) : null}

      {message ? (
        <div className={`dashboard-banner${message.tone === 'danger' ? ' dashboard-banner--error' : ''}`}>
          <StatusPill tone={message.tone === 'danger' ? 'danger' : 'success'}>{message.tone === 'danger' ? 'Action failed' : 'Action complete'}</StatusPill>
          <span>{message.text}</span>
        
          <button type="button" className="dashboard-banner__close" onClick={clearMessage}>OK</button>
        </div>
      ) : null}

      <div className="dashboard-kpi-grid approvals-kpi-grid">
        <article className="dashboard-kpi-card">
          <div className="dashboard-kpi-card__icon dashboard-kpi-card__icon--blue">
            <BadgeCheck className="dashboard-kpi-card__icon-svg" />
          </div>
          <p className="dashboard-kpi-card__label">Total Pending</p>
          <p className="dashboard-kpi-card__value">{totalPending}</p>
        </article>
        <article className="dashboard-kpi-card">
          <div className="dashboard-kpi-card__icon dashboard-kpi-card__icon--purple">
            <Tickets className="dashboard-kpi-card__icon-svg" />
          </div>
          <p className="dashboard-kpi-card__label">Ticket Queue</p>
          <p className="dashboard-kpi-card__value">{counts.tickets}</p>
        </article>
        <article className="dashboard-kpi-card">
          <div className="dashboard-kpi-card__icon dashboard-kpi-card__icon--green">
            <Users className="dashboard-kpi-card__icon-svg" />
          </div>
          <p className="dashboard-kpi-card__label">Team Filters</p>
          <p className="dashboard-kpi-card__value">{userOptions.length}</p>
        </article>
      </div>

      <article className="migration-panel migration-panel--full">
        <ApprovalsTabsAndFilters
          activeTab={activeTab}
          counts={counts}
          filters={filters}
          userOptions={userOptions}
          ticketCategories={ticketCategories}
          onTabChange={setActiveTab}
          onFilterChange={updateFilter}
          onFilterReset={resetFilter}
        />

        {activeTab === 'tickets' ? (
          <TicketApprovalTable
            rows={filteredTickets}
            approvers={approvers}
            submitting={submitting}
            onRequestAction={setActionDialog}
            loading={rowsLoading}
            onViewDetails={handleViewDetails}
          />
        ) : null}

        {activeTab === 'leaves' ? (
          <LeaveApprovalTable rows={filteredLeaves} loading={rowsLoading} submitting={submitting} onRequestAction={setActionDialog} />
        ) : null}

        {activeTab === 'intimations' ? (
          <IntimationApprovalTable rows={filteredIntimations} loading={rowsLoading} submitting={submitting} onRequestAction={setActionDialog} />
        ) : null}

        {activeTab === 'attendance' ? (
          <AttendanceApprovalTable rows={filteredAttendance} loading={rowsLoading} submitting={submitting} onRequestAction={setActionDialog} />
        ) : null}

        <ApprovalServerPager
          loading={rowsLoading}
          pageInfo={pagination[activeTab]}
          onPageChange={(page) => setApprovalPage(activeTab, page)}
        />
      </article>
      {actionDialog ? <ApprovalActionDialog action={actionDialog} approvers={approvers} saving={submitting} onClose={() => setActionDialog(null)} onSubmit={submitDialogAction} /> : null}
      {detailsTicket ? <TicketDetailsDialog ticket={detailsTicket} onClose={() => setDetailsTicket(null)} /> : null}
    </section>
  );
}
