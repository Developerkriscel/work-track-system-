import { useState } from 'react';
import { AppModal, ConfirmDialog } from '@/components/modals';
import { StatusPill } from '@/components/common/StatusPill';
import { FormsPortalEditor } from '@/features/forms-portal/components/FormsPortalEditor';
import { FormsPortalFilterPanel } from '@/features/forms-portal/components/FormsPortalFilterPanel';
import { FormsPortalHeader } from '@/features/forms-portal/components/FormsPortalHeader';
import { FormsPortalTable } from '@/features/forms-portal/components/FormsPortalTable';
import { useFormsPortalData } from '@/features/forms-portal/useFormsPortalData';

export function FormsPortalPage() {
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
  } = useFormsPortalData();
  const [deleteTarget, setDeleteTarget] = useState(null);

  return (
    <section className="page-card">
      <FormsPortalHeader
        employeeLabel={`${currentUser?.['Employee Name'] || currentUser?.Name || 'Employee'}${employeeId ? ` | ${employeeId}` : ''}`}
        isAdmin={isAdmin}
        onRefresh={refresh}
        onAddForm={openAddEditor}
      />

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
        onOpenEdit={openEditEditor}
        onRequestRemove={setDeleteTarget}
      />
      {deleteTarget ? <ConfirmDialog title="Delete Form" message={`Delete ${deleteTarget['Sheet name']}? This removes the form record from the portal.`} busy={submitting} onClose={() => setDeleteTarget(null)} onConfirm={async () => { await removeForm(deleteTarget['Sheet name']); setDeleteTarget(null); }} confirmLabel="Delete Form" /> : null}
    </section>
  );
}
