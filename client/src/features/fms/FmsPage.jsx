import { useState } from 'react';
import { StatusPill } from '@/components/common/StatusPill';
import { FormsPortalWorkspace } from '@/features/forms-portal/components/FormsPortalWorkspace';
import { FmsCreateDialog } from '@/features/fms/components/FmsCreateDialog';
import { FmsFilterPanel } from '@/features/fms/components/FmsFilterPanel';
import { FmsCompletionDialog } from '@/features/fms/components/FmsCompletionDialog';
import { FmsHeader } from '@/features/fms/components/FmsHeader';
import { FmsTabsPanel } from '@/features/fms/components/FmsTabsPanel';
import { FmsTaskTable } from '@/features/fms/components/FmsTaskTable';
import { useFmsData } from '@/features/fms/useFmsData';

export function FmsPage() {
  const {
    employeeId,
    currentUser,
    loading,
    error, clearError,
    submitting,
    tab,
    setTab,
    filters,
    setFilters,
    tasks,
    meta,
    pagination,
    setPage,
    teamTabsVisible,
    employeeOptions,
    categoryOptions,
    tabCounts,
    completeTask,
    canCreateFms,
    assignableUsers,
    assignableLoading,
    createTask,
    syncFms,
    reload
  } = useFmsData();
  const [message, setMessage] = useState(null);
  const clearMessage = () => setMessage(null);
  const [completionTask, setCompletionTask] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const formsTabActive = tab === 'fms-forms';

  const handleComplete = async (task) => {
    setCompletionTask(task);
  };

  const handleCompletionSubmit = async (remarks) => {
    const task = completionTask;
    const result = await completeTask(task.rowId || task.ID || task['Task ID'], remarks);
    setMessage({
      tone: result.success ? 'success' : 'danger',
      text: result.success ? `FMS task ${task.rowId || task.ID || task['Task ID']} marked done.` : result.message
    });
    if (result.success) setCompletionTask(null);
  };

  const handleCreateSubmit = async (payload) => {
    const result = await createTask(payload);
    setMessage({
      tone: result.success ? 'success' : 'danger',
      text: result.success ? `FMS task ${result.response?.item?.['Task ID'] || 'created'} added successfully.` : result.message
    });
    if (result.success) setCreateOpen(false);
  };

  const handleSyncSubmit = async () => {
    const result = await syncFms();
    setMessage({
      tone: result.success ? 'success' : 'danger',
      text: result.success ? `Successfully synced ${result.response.count} records (${result.response.changed} updated/new).` : result.message
    });
  };

  return (
    <section className="page-card fms-page">
      {submitting && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(255, 255, 255, 0.85)',
          backdropFilter: 'blur(4px)',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <svg style={{ animation: 'wt-spin 1s linear infinite', width: '48px', height: '48px', color: '#6941C6' }} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" strokeOpacity="0.25"></circle>
            <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p style={{ marginTop: '20px', fontWeight: '600', fontSize: '18px', color: '#111827' }}>Fetching FMS Data...</p>
          <p style={{ marginTop: '8px', fontSize: '14px', color: '#4B5563' }}>Please wait while we securely sync with the latest Google Sheet.</p>
        </div>
      )}

      <FmsHeader
        currentUser={currentUser}
        employeeId={employeeId}
        canCreateFms={canCreateFms && !formsTabActive}
        isSuperAdmin={String(meta?.role || '').toLowerCase() === 'super admin'}
        onCreate={() => setCreateOpen(true)}
        onSync={handleSyncSubmit}
        submitting={submitting}
      />

      <FmsTabsPanel
        role={meta.role}
        tab={tab}
        tabCounts={tabCounts}
        teamTabsVisible={teamTabsVisible}
        onTabChange={setTab}
      />

      {formsTabActive ? (
        <FormsPortalWorkspace
          showHeader={false}
          headerTitle="FMS Form"
          scopeDepartment="FMS"
          defaultDepartment="FMS"
          fixedDepartment="FMS"
        />
      ) : (
        <>
          <FmsFilterPanel
            filters={filters}
            employeeOptions={employeeOptions}
            categoryOptions={categoryOptions}
            onFilterChange={(patch) => setFilters((current) => ({ ...current, ...patch }))}
            onReset={() => setFilters({ emp: '', name: '', date: '', search: '' })}
            onRefresh={reload}
          />

          {message ? (
            <div className={`dashboard-banner${message.tone === 'danger' ? ' dashboard-banner--error' : ''}`}>
              <StatusPill tone={message.tone === 'danger' ? 'danger' : 'success'}>
                {message.tone === 'danger' ? 'Issue' : 'Done'}
              </StatusPill>
              <span>{message.text}</span>
            
              <button type="button" className="dashboard-banner__close" onClick={clearMessage}>OK</button>
            </div>
          ) : null}

          {error ? <div className="dashboard-banner dashboard-banner--error"><span>{error}</span><button type="button" className="dashboard-banner__close" onClick={clearError}>OK</button></div> : null}

          <article className="migration-panel migration-panel--full">
            <div className="migration-panel__row">
              <h2>FMS Task Table</h2>
              <StatusPill tone={loading ? 'neutral' : 'info'}>
                {loading ? 'Refreshing' : `${pagination?.total ?? tasks.length} tasks`}
              </StatusPill>
            </div>
            <FmsTaskTable tasks={tasks} pagination={pagination} submitting={submitting} onPageChange={setPage} onComplete={handleComplete} />
          </article>
        </>
      )}
      {completionTask ? <FmsCompletionDialog task={completionTask} saving={submitting} onClose={() => setCompletionTask(null)} onSubmit={handleCompletionSubmit} /> : null}
      {createOpen ? (
        <FmsCreateDialog
          employeeId={employeeId}
          currentUser={currentUser}
          assignableUsers={assignableUsers}
          loadingAssignableUsers={assignableLoading}
          saving={submitting}
          onClose={() => setCreateOpen(false)}
          onSubmit={handleCreateSubmit}
        />
      ) : null}
    </section>
  );
}
