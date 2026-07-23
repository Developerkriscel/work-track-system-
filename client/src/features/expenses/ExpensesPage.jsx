import { StatusPill } from '@/components/common/StatusPill';
import { ExpenseFormPanel } from '@/features/expenses/components/ExpenseFormPanel';
import { ExpensesHeader } from '@/features/expenses/components/ExpensesHeader';
import { ExpensesHistoryTable } from '@/features/expenses/components/ExpensesHistoryTable';
import { ExpensesSummaryCards } from '@/features/expenses/components/ExpensesSummaryCards';
import { useExpensesData } from '@/features/expenses/useExpensesData';

export function ExpensesPage() {
  const {
    employeeId,
    currentUser,
    loading,
    error,
    expenses,
    submitting,
    message,
    formOpen,
    openForm,
    closeForm,
    form,
    updateForm,
    submitForm,
    refresh
  } = useExpensesData();

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

      <ExpensesSummaryCards expenses={expenses} />

      {formOpen ? (
        <ExpenseFormPanel
          form={form}
          submitting={submitting}
          onChange={updateForm}
          onClose={closeForm}
          onSubmit={submitForm}
        />
      ) : null}

      <ExpensesHistoryTable expenses={expenses} />
    </section>
  );
}
