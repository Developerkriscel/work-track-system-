import { StatusPill } from '@/components/common/StatusPill';
import { AdminEditor } from '@/features/admin/components/AdminEditor';
import { AdminHeader } from '@/features/admin/components/AdminHeader';
import { AdminSummaryCards } from '@/features/admin/components/AdminSummaryCards';
import { AdminTabsAndFilters } from '@/features/admin/components/AdminTabsAndFilters';
import { AdminUsersTable } from '@/features/admin/components/AdminUsersTable';
import { useAdminData } from '@/features/admin/useAdminData';

export function AdminPage() {
  const {
    employeeId,
    setEmployeeId,
    activeTab,
    setActiveTab,
    loading,
    error,
    message,
    submitting,
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
    closeEditor,
    updateEditor,
    submitEditor,
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
      ) : null}

      <AdminUsersTable rows={users} count={allUsersCount} onEdit={(row) => openEditEditor('users', row)} />
    </section>
  );
}
