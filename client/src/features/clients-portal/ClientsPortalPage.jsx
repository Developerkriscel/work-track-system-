import { useState } from 'react';
import { StatusPill } from '@/components/common/StatusPill';
import { ConfirmDialog } from '@/components/modals';
import { ClientDetailsCard } from '@/features/clients-portal/components/ClientDetailsCard';
import { ClientEditor } from '@/features/clients-portal/components/ClientEditor';
import { ClientsPortalFilterPanel } from '@/features/clients-portal/components/ClientsPortalFilterPanel';
import { ClientsPortalHeader } from '@/features/clients-portal/components/ClientsPortalHeader';
import { ClientsPortalSummaryCards } from '@/features/clients-portal/components/ClientsPortalSummaryCards';
import { ClientsPortalTable } from '@/features/clients-portal/components/ClientsPortalTable';
import { useClientsPortalData } from '@/features/clients-portal/useClientsPortalData';

export function ClientsPortalPage() {
  const {
    employeeId,
    currentUser,
    loading,
    error,
    clients,
    allClientsCount,
    isAdmin,
    isSuperAdmin,
    submitting,
    message,
    filters,
    updateFilters,
    resetFilters,
    refresh,
    clientOptions,
    serviceOptions,
    editor,
    openEditor,
    closeEditor,
    updateEditor,
    submitEditor,
    deleteClient,
    detailsClient,
    setDetailsClient
  } = useClientsPortalData();
  const [deleteTarget, setDeleteTarget] = useState(null);

  return (
    <section className="page-card">
      <ClientsPortalHeader
        employeeLabel={`${currentUser?.['Employee Name'] || currentUser?.Name || 'Employee'}${employeeId ? ` | ${employeeId}` : ''}`}
        onRefresh={refresh}
        showAddClient={isSuperAdmin}
        onAddClient={() => openEditor()}
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

      <ClientsPortalSummaryCards visibleCount={clients.length} totalCount={allClientsCount} isAdmin={isAdmin} />

      <ClientsPortalFilterPanel
        filters={filters}
        clientOptions={clientOptions}
        serviceOptions={serviceOptions}
        onUpdateFilters={updateFilters}
        onResetFilters={resetFilters}
      />

      <ClientDetailsCard client={detailsClient} onClose={() => setDetailsClient(null)} />
      <ClientEditor editor={editor} submitting={submitting} onUpdate={updateEditor} onClose={closeEditor} onSubmit={submitEditor} />

      <ClientsPortalTable
        clients={clients}
        allClientsCount={allClientsCount}
        isAdmin={isAdmin}
        submitting={submitting}
        onOpenDetails={setDetailsClient}
        onOpenEditor={openEditor}
    onRequestDeactivate={setDeleteTarget}
      />
      {deleteTarget ? <ConfirmDialog title="Delete Client" message={`Delete ${deleteTarget.Client_Id}? This permanently removes the client portal record and login.`} busy={submitting} onClose={() => setDeleteTarget(null)} onConfirm={async () => { await deleteClient(deleteTarget.Client_Id); setDeleteTarget(null); }} confirmLabel="Delete Client" /> : null}
    </section>
  );
}
