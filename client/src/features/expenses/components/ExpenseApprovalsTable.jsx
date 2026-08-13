import { useState } from 'react';
import { AlertDialog } from '@/components/modals/AlertDialog';
import { StatusPill } from '@/components/common/StatusPill';
import { expenseStatusTone, formatExpenseDate } from '@/features/expenses/services/expensesPresentation';
import { openProtectedFile, toPreviewUrl } from '@/lib/fileLinks';

export function ExpenseApprovalsTable({
  expenses = [],
  filters,
  onFilterChange,
  onFilterReset,
  onRequestAction
}) {
  const [alertMsg, setAlertMsg] = useState(null);
  return (
    <article className="migration-panel migration-panel--full">
      <div className="migration-panel__row">
        <h2>My Team Expenses</h2>
        <StatusPill tone="info">{expenses.length} claims</StatusPill>
      </div>

      <div className="approval-filter-card expenses-approval-filter-card">
        <div className="expenses-approval-grid">
          <label className="dashboard-control">
            <span>Employee</span>
            <input
              type="text"
              placeholder="Search by employee..."
              value={filters.employee}
              onChange={(event) => onFilterChange({ employee: event.target.value })}
            />
          </label>
          <label className="dashboard-control">
            <span>Status</span>
            <select value={filters.status} onChange={(event) => onFilterChange({ status: event.target.value })}>
              <option value="">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
            </select>
          </label>
          <label className="dashboard-control">
            <span>Search</span>
            <input
              type="text"
              placeholder="Type, description, remarks..."
              value={filters.search}
              onChange={(event) => onFilterChange({ search: event.target.value })}
            />
          </label>
          <div className="expenses-approval-grid__action">
            <button type="button" className="attendance-cta attendance-cta--gray" onClick={onFilterReset}>
              Reset
            </button>
          </div>
        </div>
      </div>

      <div className="dashboard-table-wrap">
        <table className="dashboard-table approval-table expenses-team-table">
          <thead>
            <tr>
              <th>Expense ID</th>
              <th>Employee</th>
              <th>Date</th>
              <th>Type</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Description</th>
              <th>Receipt</th>
              <th>Remarks</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {expenses.length ? (
              expenses.map((expense) => (
                <tr key={expense.ExpenseID || expense['Expense ID'] || expense._id}>
                  <td data-label="Expense ID">{expense.ExpenseID || expense['Expense ID'] || '-'}</td>
                  <td data-label="Employee">
                    <div className="approval-table__identity">
                      <strong>{expense['Employee Name'] || '-'}</strong>
                      <span>{expense['Employee ID'] || '-'}</span>
                    </div>
                  </td>
                  <td data-label="Date">{formatExpenseDate(expense.Date)}</td>
                  <td data-label="Type">{expense.Type || '-'}</td>
                  <td data-label="Amount">{expense.Amount || '-'}</td>
                  <td data-label="Status">
                    <StatusPill tone={expenseStatusTone(expense.Status)}>{expense.Status || 'Pending'}</StatusPill>
                  </td>
                  <td data-label="Description" className="approval-table__copy">{expense.Description || '-'}</td>
                  <td data-label="Receipt">
                    {expense['Receipt URL'] ? (
                      <a
                        className="forms-open-link attendance-cta attendance-cta--purple"
                        href={toPreviewUrl(expense['Receipt URL'])}
                        target="_blank"
                        rel="noreferrer"
                        onClick={async (event) => {
                          event.preventDefault();
                          try {
                            await openProtectedFile(expense['Receipt URL']);
                          } catch (error) {
                            setAlertMsg(error.message || 'Receipt could not be opened.');
                          }
                        }}
                      >
                        View
                      </a>
                    ) : (
                      <span className="status-pill status-pill--neutral">No Receipt</span>
                    )}
                  </td>
                  <td data-label="Remarks" className="approval-table__copy">{expense['Admin Remarks'] || '-'}</td>
                  <td data-label="Action">
                    <div className="approval-table__actions">
                      {expense._canApprove ? (
                        <>
                          <button
                            type="button"
                            className="attendance-cta attendance-cta--blue expense-approval-action"
                            onClick={() => onRequestAction({ mode: 'Approved', expense })}
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            className="attendance-cta attendance-cta--red expense-approval-action"
                            onClick={() => onRequestAction({ mode: 'Rejected', expense })}
                          >
                            Reject
                          </button>
                        </>
                      ) : (
                        <span className="status-pill status-pill--neutral">View only</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="10" className="dashboard-table__empty">No expense claims found for this filter.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <AlertDialog message={alertMsg} onClose={() => setAlertMsg(null)} />
    </article>
  );
}
