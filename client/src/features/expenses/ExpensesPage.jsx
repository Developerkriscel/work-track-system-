import { AppModal } from '@/components/modals';
import { StatusPill } from '@/components/common/StatusPill';
import { ExpenseApprovalDialog } from '@/features/expenses/components/ExpenseApprovalDialog';
import { ExpenseApprovalsTable } from '@/features/expenses/components/ExpenseApprovalsTable';
import { ExpenseFormPanel } from '@/features/expenses/components/ExpenseFormPanel';
import { ExpensesHeader } from '@/features/expenses/components/ExpensesHeader';
import { ExpensesHistoryTable } from '@/features/expenses/components/ExpensesHistoryTable';
import { ExpensesSummaryCards } from '@/features/expenses/components/ExpensesSummaryCards';
import { useExpensesData } from '@/features/expenses/useExpensesData';
import { useState } from 'react';

export function ExpensesPage() {
  const [approvalDialog, setApprovalDialog] = useState(null);
  const [activeView, setActiveView] = useState('mine');
  const {
    employeeId,
    currentUser,
    canApproveExpenses,
    loading,
    error,
    expenses,
    approvalQueue,
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
    submitForm,
    processApproval,
    refresh
  } = useExpensesData();

  async function handleApprovalSubmit(values) {
    const result = await processApproval(approvalDialog?.expense, approvalDialog?.mode, values.remarks);
    if (result?.success) setApprovalDialog(null);
  }

  return (
    <section className="page-card">
      <ExpensesHeader
        currentUser={currentUser}
        employeeId={employeeId}
        onRefresh={refresh}
        onOpenForm={openForm}
      />

      {error ? (
        <div className="dashboard-banner dashboard-banner--error">{error}</div>
      ) : null}

      {message ? (
        <div className={`dashboard-banner${message.tone === 'danger' ? ' dashboard-banner--error' : ''}`}>
          <StatusPill tone={message.tone === 'danger' ? 'danger' : 'success'}>
            {message.tone === 'danger' ? 'Update failed' : 'Update complete'}
          </StatusPill>
          <span>{message.text}</span>
        </div>
      ) : null}

      {canApproveExpenses ? (
        <article className="migration-panel migration-panel--full expenses-view-switcher">
          <div className="approval-tabs">
            <button
              type="button"
              className={`approval-tab-btn${activeView === 'mine' ? ' approval-tab-btn--active' : ''}`}
              onClick={() => setActiveView('mine')}
            >
              <span>My Expenses</span>
              <span className={`approval-tab-btn__count${expenses.length ? '' : ' approval-tab-btn__count--muted'}`}>{expenses.length}</span>
            </button>
            <button
              type="button"
              className={`approval-tab-btn${activeView === 'team' ? ' approval-tab-btn--active' : ''}`}
              onClick={() => setActiveView('team')}
            >
              <span>My Team Expenses</span>
              <span className={`approval-tab-btn__count${approvalQueue.length ? '' : ' approval-tab-btn__count--muted'}`}>{approvalQueue.length}</span>
            </button>
          </div>
        </article>
      ) : null}

      {activeView === 'mine' ? <ExpensesSummaryCards expenses={expenses} /> : null}

      {formOpen ? (
        <AppModal title="Record an Expense" onClose={closeForm} width="980px">
          <ExpenseFormPanel
            form={form}
            submitting={submitting}
            onChange={updateForm}
            onClose={closeForm}
            onSubmit={submitForm}
          />
        </AppModal>
      ) : null}

      {canApproveExpenses && activeView === 'team' ? (
        <ExpenseApprovalsTable
          expenses={filteredApprovals}
          filters={approvalFilters}
          onFilterChange={updateApprovalFilters}
          onFilterReset={resetApprovalFilters}
          onRequestAction={setApprovalDialog}
        />
      ) : null}

      {activeView === 'mine' ? <ExpensesHistoryTable expenses={expenses} title="My Expenses" /> : null}

      {approvalDialog ? (
        <ExpenseApprovalDialog
          action={approvalDialog}
          busy={submitting}
          onClose={() => setApprovalDialog(null)}
          onSubmit={handleApprovalSubmit}
        />
      ) : null}
    </section>
  );
}
