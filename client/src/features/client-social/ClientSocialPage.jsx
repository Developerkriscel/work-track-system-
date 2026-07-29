import { StatusPill } from '@/components/common/StatusPill';
import { ClientSocialDetailsPanel } from '@/features/client-social/components/ClientSocialDetailsPanel';
import { ClientSocialRemarkDialog } from '@/features/client-social/components/ClientSocialRemarkDialog';
import { ClientSocialFilterPanel } from '@/features/client-social/components/ClientSocialFilterPanel';
import { ClientSocialHeader } from '@/features/client-social/components/ClientSocialHeader';
import { ClientSocialSummaryCards } from '@/features/client-social/components/ClientSocialSummaryCards';
import { ClientSocialTable } from '@/features/client-social/components/ClientSocialTable';
import { useClientSocialData } from '@/features/client-social/useClientSocialData';
import { useState } from 'react';

export function ClientSocialPage() {
  const {
    clientId,
    clientName,
    loading,
    error,
    rows,
    allRows,
    submitting,
    message,
    filters,
    updateFilters,
    resetFilters,
    refresh,
    platformOptions,
    statusOptions,
    details,
    openDetails,
    closeDetails,
    updateStatus,
    addRemark
  } = useClientSocialData();
  const [remarkAction, setRemarkAction] = useState(null);

  const handleApprove = async (row) => {
    setRemarkAction({ type: 'approve', row, defaultValue: 'Approved by client' });
  };

  const handleFeedback = async (row) => {
    setRemarkAction({ type: 'feedback', row, defaultValue: 'Please revise this creative.' });
  };

  const handleAddRemark = async (historyItem) => {
    setRemarkAction({ type: 'remark', historyItem, defaultValue: historyItem['Client Remark'] || '' });
  };

  const submitRemark = async (remark) => {
    const action = remarkAction;
    if (action.type === 'approve') await updateStatus(action.row, 'Approved by Client', remark);
    if (action.type === 'feedback') await updateStatus(action.row, 'Client Feedback', remark);
    if (action.type === 'remark') {
      await addRemark(action.historyItem['History ID'] || action.historyItem.historyId, remark);
      if (details.post) await openDetails(details.post);
    }
    setRemarkAction(null);
  };

  return (
    <section className="page-card">
      <ClientSocialHeader clientId={clientId} clientName={clientName} onRefresh={refresh} />

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

      <ClientSocialSummaryCards rows={allRows} />

      <ClientSocialFilterPanel
        filters={filters}
        platformOptions={platformOptions}
        statusOptions={statusOptions}
        onUpdateFilters={updateFilters}
        onResetFilters={resetFilters}
      />

      <ClientSocialDetailsPanel details={details} submitting={submitting} onClose={closeDetails} onAddRemark={handleAddRemark} />

      {loading ? <div className="dashboard-banner">Loading social tasks...</div> : null}

      <ClientSocialTable
        rows={rows}
        submitting={submitting}
        onOpenDetails={openDetails}
        onApprove={handleApprove}
        onFeedback={handleFeedback}
      />
      {remarkAction ? <ClientSocialRemarkDialog action={remarkAction} saving={submitting} onClose={() => setRemarkAction(null)} onSubmit={submitRemark} /> : null}
    </section>
  );
}
