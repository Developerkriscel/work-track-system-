import { RefreshCw } from '@/components/common/icons';

export function ExpensesHeader({ currentUser, employeeId, onRefresh, onOpenForm }) {
  return (
    <div className="page-card__header">
      <div>
        <p className="page-card__eyebrow">Expense Management</p>
        <h1 className="page-card__title">My Expenses</h1>
      </div>

      <div className="dashboard-controls">
        <div className="page-card__status">
          {(currentUser?.['Employee Name'] || currentUser?.Name || 'Employee')} {employeeId ? `| ${employeeId}` : ''}
        </div>
        <button type="button" className="attendance-cta attendance-cta--blue approvals-refresh-btn" onClick={onRefresh}>
          <RefreshCw className="approvals-refresh-btn__icon" />
          Refresh
        </button>
        <button type="button" className="attendance-cta attendance-cta--green" onClick={onOpenForm}>
          Record New Expense
        </button>
      </div>
    </div>
  );
}
