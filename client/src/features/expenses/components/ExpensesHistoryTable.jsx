import { useState } from 'react';
import { AlertDialog } from '@/components/modals/AlertDialog';
import { StatusPill } from '@/components/common/StatusPill';
import { expenseStatusTone, formatExpenseDate } from '@/features/expenses/services/expensesPresentation';
import { openProtectedFile, toPreviewUrl } from '@/lib/fileLinks';

export function ExpensesHistoryTable({ expenses = [], title = 'My Recent Expenses' }) {
  const [alertMsg, setAlertMsg] = useState(null);
  const rows = [...expenses].sort((left, right) => {
    const rightTime = new Date(right?.['Last Update Date'] || right?.Date || 0).getTime() || 0;
    const leftTime = new Date(left?.['Last Update Date'] || left?.Date || 0).getTime() || 0;
    return rightTime - leftTime;
  });

  return (
    <article className="migration-panel migration-panel--full">
      <div className="migration-panel__row">
        <h2>{title}</h2>
        <StatusPill tone="info">{rows.length} items</StatusPill>
      </div>

      <div className="dashboard-table-wrap">
        <table className="dashboard-table approval-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Description</th>
              <th>Receipt</th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((expense) => (
                <tr key={expense.ExpenseID || expense._id}>
                  <td>{formatExpenseDate(expense.Date)}</td>
                  <td>{expense.Type || '-'}</td>
                  <td>{expense.Amount || '-'}</td>
                  <td>
                    <StatusPill tone={expenseStatusTone(expense.Status)}>{expense.Status || 'Pending'}</StatusPill>
                  </td>
                  <td className="approval-table__copy">{expense.Description || '-'}</td>
                  <td>
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
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="6" className="dashboard-table__empty">No expenses found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <AlertDialog message={alertMsg} onClose={() => setAlertMsg(null)} />
    </article>
  );
}
