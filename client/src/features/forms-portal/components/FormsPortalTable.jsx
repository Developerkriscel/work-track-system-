import { StatusPill } from '@/components/common/StatusPill';
import { visibleUsersSummary } from '@/features/forms-portal/services/formsPresentation';

export function FormsPortalTable({
  forms,
  allFormsCount,
  isAdmin,
  submitting,
  onOpenEdit,
  onRequestRemove
}) {
  return (
    <article className="migration-panel migration-panel--full">
      <div className="migration-panel__row">
        <h2>Forms List</h2>
        <StatusPill tone="info">
          {forms.length} of {allFormsCount}
        </StatusPill>
      </div>

      <div className="dashboard-table-wrap">
        <table className="dashboard-table approval-table">
          <thead>
            <tr>
              <th>Department</th>
              <th>Category / Sheet Name</th>
              <th>For / Purpose</th>
              <th>Form Action</th>
              {isAdmin ? <th>Actions</th> : null}
            </tr>
          </thead>
          <tbody>
            {forms.length ? (
              forms.map((form) => {
                const summary = visibleUsersSummary(form);
                return (
                  <tr key={form['Form ID'] || form['Sheet name']}>
                    <td data-label="Department">
                      <span className="ticket-id-chip">{form.Department || 'General'}</span>
                    </td>
                    <td data-label="Category / Sheet Name">
                      <div className="approval-user-cell">
                        <strong>{form['Sheet name'] || '-'}</strong>
                        <span>{form['Form ID'] || form.ID || '-'}</span>
                      </div>
                    </td>
                    <td data-label="For / Purpose" className="approval-table__copy">{form.For || '-'}</td>
                    <td data-label="Form Action">
                      <div className="forms-action-stack">
                        <a
                          href={form['Form link'] || '#'}
                          target="_blank"
                          rel="noreferrer"
                          className="attendance-cta attendance-cta--purple forms-open-link"
                        >
                          Open Form
                        </a>
                        {isAdmin && <StatusPill tone={summary.tone}>{summary.label}</StatusPill>}
                      </div>
                    </td>
                    {isAdmin ? (
                      <td data-label="Action">
                        <div className="approval-action-stack form-portal-action-stack">
                          <button type="button" className="ticket-action-btn ticket-action-btn--done" onClick={() => onOpenEdit(form)}>
                            Edit
                          </button>
                          <button
                            type="button"
                            className="ticket-action-btn ticket-action-btn--delete"
                            disabled={submitting}
                            onClick={() => {
                              onRequestRemove(form);
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    ) : null}
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={isAdmin ? 5 : 4} className="dashboard-table__empty">
                  No forms found for this employee and filter combination.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </article>
  );
}
