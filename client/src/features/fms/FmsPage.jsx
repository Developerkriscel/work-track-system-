import { useState } from 'react';
import { StatusPill } from '@/components/common/StatusPill';
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
    error,
    submitting,
    tab,
    setTab,
    filters,
    setFilters,
    tasks,
    meta,
    employeeOptions,
    categoryOptions,
    tabCounts,
    completeTask
  } = useFmsData();
  const [message, setMessage] = useState(null);
  const [completionTask, setCompletionTask] = useState(null);

  const handleComplete = async (task) => {
    setCompletionTask(task);
  };

  const handleCompletionSubmit = async (remarks) => {
    const task = completionTask;
    const result = await completeTask(task.rowId || task.ID || task['Task ID'], remarks);
    setMessage({
      tone: result.success ? 'success' : 'danger',
      text: result.success ? `FMS task ${task.rowId || task.ID} marked done.` : result.message
    });
    if (result.success) setCompletionTask(null);
  };

  return (
    <section className="page-card">
      <FmsHeader currentUser={currentUser} employeeId={employeeId} />

      <FmsTabsPanel
        role={meta.role}
        tab={tab}
        tabCounts={tabCounts}
        onTabChange={setTab}
      />

      <FmsFilterPanel
        filters={filters}
        employeeOptions={employeeOptions}
        categoryOptions={categoryOptions}
        onFilterChange={(patch) => setFilters((current) => ({ ...current, ...patch }))}
        onReset={() => setFilters({ emp: '', name: '', date: '' })}
      />

      {message ? (
        <div className={`dashboard-banner${message.tone === 'danger' ? ' dashboard-banner--error' : ''}`}>
          <StatusPill tone={message.tone === 'danger' ? 'danger' : 'success'}>
            {message.tone === 'danger' ? 'Issue' : 'Done'}
          </StatusPill>
          <span>{message.text}</span>
        </div>
      ) : null}

      {error ? <div className="dashboard-banner dashboard-banner--error">{error}</div> : null}

      <article className="migration-panel migration-panel--full">
        <div className="migration-panel__row">
          <h2>FMS Task Table</h2>
          <StatusPill tone={loading ? 'neutral' : 'info'}>
            {loading ? 'Refreshing' : `${tasks.length} tasks`}
          </StatusPill>
        </div>
        <FmsTaskTable tasks={tasks} submitting={submitting} onComplete={handleComplete} />
      </article>
      {completionTask ? <FmsCompletionDialog task={completionTask} saving={submitting} onClose={() => setCompletionTask(null)} onSubmit={handleCompletionSubmit} /> : null}
    </section>
  );
}
