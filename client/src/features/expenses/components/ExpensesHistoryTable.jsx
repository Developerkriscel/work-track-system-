import { StatusPill } from '@/components/common/StatusPill';
import { expenseStatusTone, formatExpenseDate } from '@/features/expenses/services/expensesPresentation';

export function ExpensesHistoryTable({ expenses = [] }) {
  return (
    <article className="migration-panel migration-panel--full">
      <div className="migration-panel__row">
        <h2>My Recent Expenses</h2>
        <StatusPill tone="info">{expenses.length} items</StatusPill>
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
            {expenses.length ? (
              expenses.map((expense) => (
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
                      <a className="forms-open-link attendance-cta attendance-cta--purple" href={expense['Receipt URL']} target="_blank" rel="noreferrer">
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
    </article>
  );
}
