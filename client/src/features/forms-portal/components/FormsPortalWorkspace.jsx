import { useState } from 'react';
import { AppModal, ConfirmDialog } from '@/components/modals';
import { StatusPill } from '@/components/common/StatusPill';
import { FormsPortalEditor } from '@/features/forms-portal/components/FormsPortalEditor';
import { FormsPortalFilterPanel } from '@/features/forms-portal/components/FormsPortalFilterPanel';
import { FormsPortalHeader } from '@/features/forms-portal/components/FormsPortalHeader';
import { FormsPortalTable } from '@/features/forms-portal/components/FormsPortalTable';
import { useFormsPortalData } from '@/features/forms-portal/useFormsPortalData';

export function FormsPortalWorkspace({
  headerEyebrow = 'Assigned Forms',
  headerTitle = 'Forms Portal',
  showHeader = true,
  scopeDepartment = '',
  defaultDepartment = '',
  fixedDepartment = ''
}) {
  const {
    employeeId,
    currentUser,
    error, clearError,
    forms,
    allFormsCount,
    filters,
    updateFilters,
    resetFilters,
    refresh,
    isAdmin,
    assignableUsers,
    submitting,
    message, clearMessage,
    departmentOptions,
    sheetOptions,
    editor,
    openAddEditor,
    openEditEditor,
    closeEditor,
    updateEditor,
    submitEditor,
    removeForm
  } = useFormsPortalData({ scopeDepartment, defaultDepartment });
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [formViewer, setFormViewer] = useState(null);

  return (
    <>
      {showHeader ? (
        <FormsPortalHeader
          eyebrow={headerEyebrow}
          title={headerTitle}
          employeeLabel={`${currentUser?.['Employee Name'] || currentUser?.Name || 'Employee'}${employeeId ? ` | ${employeeId}` : ''}`}
          isAdmin={isAdmin}
          onRefresh={refresh}
          onAddForm={openAddEditor}
        />
      ) : isAdmin ? (
        <article className="migration-panel migration-panel--full">
          <div className="migration-panel__row">
            <h2>{headerTitle}</h2>
            <div className="dashboard-controls">
              <button type="button" className="attendance-cta attendance-cta--purple" onClick={openAddEditor}>
                Add New Form
              </button>
            </div>
          </div>
        </article>
      ) : null}

      {error ? (
        <div className="dashboard-banner dashboard-banner--error">
          <span>{error}</span>
          <button type="button" className="dashboard-banner__close" onClick={clearError}>OK</button>
        </div>
      ) : null}

      {message ? (
        <div className={`dashboard-banner${message.tone === 'danger' ? ' dashboard-banner--error' : ''}`}>
          <StatusPill tone={message.tone === 'danger' ? 'danger' : 'success'}>
            {message.tone === 'danger' ? 'Update failed' : 'Update complete'}
          </StatusPill>
          <span>{message.text}</span>
          <button type="button" className="dashboard-banner__close" onClick={clearMessage}>OK</button>
        </div>
      ) : null}

      <FormsPortalFilterPanel
        filters={filters}
        departmentOptions={departmentOptions}
        sheetOptions={sheetOptions}
        onUpdateFilters={updateFilters}
        onResetFilters={resetFilters}
      />

      {editor.open && isAdmin ? (
        <AppModal
          title={editor.mode === 'edit' ? `Edit Form: ${editor.form['Sheet name'] || ''}` : 'Add New Form'}
          onClose={closeEditor}
          width="860px"
        >
          <FormsPortalEditor
            editor={editor}
            assignableUsers={assignableUsers}
            submitting={submitting}
            fixedDepartment={fixedDepartment}
            onUpdate={updateEditor}
            onClose={closeEditor}
            onSubmit={submitEditor}
          />
        </AppModal>
      ) : null}

      <FormsPortalTable
        forms={forms}
        allFormsCount={allFormsCount}
        isAdmin={isAdmin}
        submitting={submitting}
        onOpenForm={setFormViewer}
        onOpenEdit={openEditEditor}
        onRequestRemove={setDeleteTarget}
      />

      {formViewer ? (
        <AppModal
          title={formViewer['Sheet name'] || 'Open Form'}
          onClose={() => setFormViewer(null)}
          width="1180px"
        >
          <div className="forms-portal-viewer">
            <iframe
              className="forms-portal-viewer__frame"
              src={formViewer['Form link'] || 'about:blank'}
              title={formViewer['Sheet name'] || 'Form'}
            />
            <div className="forms-portal-viewer__fallback">
              <span>If this form blocks embedded preview, open it directly.</span>
              <a
                className="inline-action inline-action--ghost"
                href={formViewer['Form link'] || '#'}
                target="_blank"
                rel="noreferrer"
              >
                Open in new tab
              </a>
            </div>
          </div>
        </AppModal>
      ) : null}

      {deleteTarget ? (
        <ConfirmDialog
          title="Delete Form"
          message={`Delete ${deleteTarget['Sheet name']}? This removes the form record from the portal.`}
          busy={submitting}
          onClose={() => setDeleteTarget(null)}
          onConfirm={async () => {
            await removeForm(deleteTarget['Sheet name']);
            setDeleteTarget(null);
          }}
          confirmLabel="Delete Form"
        />
      ) : null}
    </>
  );
}
