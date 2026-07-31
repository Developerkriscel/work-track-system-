import { useState } from 'react';
import { AppModal } from '@/components/modals';
import { StatusPill } from '@/components/common/StatusPill';
import { AdminEditor } from '@/features/admin/components/AdminEditor';
import { AdminHeader } from '@/features/admin/components/AdminHeader';
import { AdminSummaryCards } from '@/features/admin/components/AdminSummaryCards';
import { AdminTabsAndFilters } from '@/features/admin/components/AdminTabsAndFilters';
import { AdminUsersTable } from '@/features/admin/components/AdminUsersTable';
import { useAdminData } from '@/features/admin/useAdminData';
import { ConfirmDialog } from '@/features/tickets/components/ConfirmDialog';

export function AdminPage() {
  const [deleteTarget, setDeleteTarget] = useState(null);
  const {
    employeeId,
    currentRole,
    setEmployeeId,
    activeTab,
    setActiveTab,
    loading,
    error, clearError,
    message, clearMessage,
    submitting,
    deletingId,
    users,
    allUsersCount,
    summary,
    filters,
    updateFilters,
    resetFilters,
    managerOptions,
    roleOptions,
    roleFilterOptions,
    statusOptions,
    departmentOptions,
    departmentFilterOptions,
    categoryOptions,
    editor,
    openAddEditor,
    openEditEditor,
    openViewEditor,
    closeEditor,
    updateEditor,
    submitEditor,
    removeUser,
    refresh
  } = useAdminData();

  return (
    <section className="page-card">
      <AdminHeader
        employeeId={employeeId}
        onEmployeeIdChange={setEmployeeId}
        activeTab={activeTab}
        onRefresh={refresh}
        onAdd={openAddEditor}
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

      <AdminSummaryCards summary={summary} />

      <AdminTabsAndFilters
        activeTab={activeTab}
        onTabChange={setActiveTab}
        filters={filters}
        onFilterChange={updateFilters}
        onResetFilters={resetFilters}
        roleFilterOptions={roleFilterOptions}
        roleOptions={roleOptions}
        statusOptions={statusOptions}
        departmentFilterOptions={departmentFilterOptions}
        departmentOptions={departmentOptions}
      />

      {editor.open ? (
        <AppModal
          title={editor.mode === 'view' ? 'User Details' : editor.mode === 'edit' ? 'Edit User Details' : 'Add New Employee'}
          onClose={closeEditor}
          width="860px"
        >
          <AdminEditor
            editor={editor}
            managerOptions={managerOptions}
            roleOptions={roleOptions}
            statusOptions={statusOptions}
            departmentOptions={departmentOptions}
            categoryOptions={categoryOptions}
            submitting={submitting}
            onUpdate={updateEditor}
            onClose={closeEditor}
            onSubmit={submitEditor}
          />
        </AppModal>
      ) : null}

      <AdminUsersTable
        rows={users}
        count={allUsersCount}
        currentRole={currentRole}
        deletingId={deletingId}
        onView={(row) => openViewEditor('users', row)}
        onEdit={(row) => openEditEditor('users', row)}
        onDelete={(row) => setDeleteTarget(row)}
      />

      {deleteTarget ? (
        <ConfirmDialog
          title="Delete User?"
          message={`Delete ${deleteTarget['Employee Name'] || 'this user'} (${deleteTarget['Employee ID'] || ''})? This action cannot be undone.`}
          confirmLabel="Delete User"
          tone="danger"
          onCancel={() => setDeleteTarget(null)}
          onConfirm={async () => {
            await removeUser(deleteTarget);
            setDeleteTarget(null);
          }}
        />
      ) : null}
    </section>
  );
}
