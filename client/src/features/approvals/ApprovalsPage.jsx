import { useMemo, useState } from 'react';
import { StatusPill } from '@/components/common/StatusPill';
import { BadgeCheck, Tickets, Users } from '@/components/common/icons';
import { ApprovalsHeader } from '@/features/approvals/components/ApprovalsHeader';
import { ApprovalActionDialog } from '@/features/approvals/components/ApprovalActionDialog';
import { ApprovalsTabsAndFilters } from '@/features/approvals/components/ApprovalsTabsAndFilters';
import { AttendanceApprovalTable, IntimationApprovalTable, LeaveApprovalTable } from '@/features/approvals/components/GenericApprovalTables';
import { TicketApprovalTable } from '@/features/approvals/components/TicketApprovalTable';
import { useApprovalsData } from '@/features/approvals/useApprovalsData';

export function ApprovalsPage() {
  const {
    employeeId,
    currentUser,
    activeTab,
    setActiveTab,
    loading,
    error,
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
  } = useApprovalsData();
  const [actionDialog, setActionDialog] = useState(null);

  async function submitDialogAction(values) {
    let result;
    if (actionDialog.kind === 'ticket-approve') result = await approveTicket(actionDialog.ticketId, values.remarks);
    if (actionDialog.kind === 'ticket-rework') result = await reworkTicket(actionDialog.ticketId, values.remarks);
    if (actionDialog.kind === 'ticket-transfer') result = await moveTicketApproval(actionDialog.ticketId, values.target, values.remarks);
    if (actionDialog.kind === 'approve') result = await approveItem(actionDialog.type, actionDialog.id, values.remarks);
    if (actionDialog.kind === 'reject') result = await rejectItem(actionDialog.type, actionDialog.id, values.remarks);
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
        <div className="dashboard-banner dashboard-banner--error">{error}</div>
      ) : null}

      {message ? (
        <div className={`dashboard-banner${message.tone === 'danger' ? ' dashboard-banner--error' : ''}`}>
          <StatusPill tone={message.tone === 'danger' ? 'danger' : 'success'}>{message.tone === 'danger' ? 'Action failed' : 'Action complete'}</StatusPill>
          <span>{message.text}</span>
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
          />
        ) : null}

        {activeTab === 'leaves' ? (
          <LeaveApprovalTable rows={filteredLeaves} submitting={submitting} onRequestAction={setActionDialog} />
        ) : null}

        {activeTab === 'intimations' ? (
          <IntimationApprovalTable rows={filteredIntimations} submitting={submitting} onRequestAction={setActionDialog} />
        ) : null}

        {activeTab === 'attendance' ? (
          <AttendanceApprovalTable rows={filteredAttendance} submitting={submitting} onRequestAction={setActionDialog} />
        ) : null}
      </article>
      {actionDialog ? <ApprovalActionDialog action={actionDialog} approvers={approvers} saving={submitting} onClose={() => setActionDialog(null)} onSubmit={submitDialogAction} /> : null}
    </section>
  );
}
