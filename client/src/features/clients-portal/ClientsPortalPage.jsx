import { useState } from 'react';
import { AppModal, ConfirmDialog } from '@/components/modals';
import { StatusPill } from '@/components/common/StatusPill';
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
    error, clearError,
    clients,
    allClientsCount,
    canManageClients,
    isSuperAdmin,
    submitting,
    message, clearMessage,
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
    <section className="page-card clients-portal-page">
      <ClientsPortalHeader
        employeeLabel={`${currentUser?.['Employee Name'] || currentUser?.Name || 'Employee'}${employeeId ? ` | ${employeeId}` : ''}`}
        onRefresh={refresh}
        showAddClient={isSuperAdmin}
        onAddClient={() => openEditor()}
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

      <ClientsPortalSummaryCards visibleCount={clients.length} totalCount={allClientsCount} isAdmin={canManageClients} />

      <ClientsPortalFilterPanel
        filters={filters}
        clientOptions={clientOptions}
        serviceOptions={serviceOptions}
        onUpdateFilters={updateFilters}
        onResetFilters={resetFilters}
      />

      <ClientDetailsCard client={detailsClient} onClose={() => setDetailsClient(null)} />
      {editor.open ? (
        <AppModal
          title={editor.client.Client_Id ? `Edit Client: ${editor.client.Client_Id}` : 'Add Client'}
          onClose={closeEditor}
          width="980px"
        >
          <ClientEditor editor={editor} submitting={submitting} onUpdate={updateEditor} onClose={closeEditor} onSubmit={submitEditor} />
        </AppModal>
      ) : null}

      <ClientsPortalTable
        clients={clients}
        allClientsCount={allClientsCount}
        isAdmin={canManageClients}
        submitting={submitting}
        onOpenDetails={setDetailsClient}
        onOpenEditor={openEditor}
    onRequestDeactivate={setDeleteTarget}
      />
      {deleteTarget ? <ConfirmDialog title="Delete Client" message={`Delete ${deleteTarget.Client_Id}? This permanently removes the client portal record and login.`} busy={submitting} onClose={() => setDeleteTarget(null)} onConfirm={async () => { await deleteClient(deleteTarget.Client_Id); setDeleteTarget(null); }} confirmLabel="Delete Client" /> : null}
    </section>
  );
}
