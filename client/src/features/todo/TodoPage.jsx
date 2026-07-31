import { useState } from 'react';
import { AppModal } from '@/components/modals';
import { StatusPill } from '@/components/common/StatusPill';
import { ConfirmDialog } from '@/components/modals';
import { TodoEditDialog } from '@/features/todo/components/TodoEditDialog';
import { TodoFormPanel } from '@/features/todo/components/TodoFormPanel';
import { TodoHeader } from '@/features/todo/components/TodoHeader';
import { TodoSummaryCards } from '@/features/todo/components/TodoSummaryCards';
import { TodoTable } from '@/features/todo/components/TodoTable';
import { TodoToolbar } from '@/features/todo/components/TodoToolbar';
import { useTodoData } from '@/features/todo/useTodoData';

export function TodoPage() {
  const {
    employeeId,
    currentUser,
    loading,
    error, clearError,
    rows,
    allRows,
    submitting,
    message, clearMessage,
    refresh,
    statusFilter,
    setStatusFilter,
    formMode,
    setFormMode,
    singleForm,
    setSingleForm,
    bulkRows,
    setBulkRows,
    submitSingle,
    submitBulk,
    toggleRow,
    editRow,
    deleteRow,
    resetBulkRows
  } = useTodoData();
  const [editTarget, setEditTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [showFormModal, setShowFormModal] = useState(false);

  const handleEdit = async (row) => {
    setEditTarget(row);
  };

  const handleDelete = async (row) => {
    setDeleteTarget(row);
  };

  const saveEdit = async (form) => {
    await editRow(editTarget, form);
    setEditTarget(null);
  };

  const confirmDelete = async () => {
    await deleteRow(deleteTarget);
    setDeleteTarget(null);
  };

  return (
    <section className="page-card">
      <TodoHeader currentUser={currentUser} employeeId={employeeId} onRefresh={refresh} />

      {error ? (
        <div className="dashboard-banner dashboard-banner--error"><span>{error}</span><button type="button" className="dashboard-banner__close" onClick={clearError}>OK</button></div>
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

      <TodoSummaryCards rows={allRows} />

      <TodoToolbar
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        formMode={formMode}
        onFormModeChange={setFormMode}
        onOpenForm={() => setShowFormModal(true)}
      />

      {showFormModal ? (
        <AppModal
          title={formMode === 'single' ? 'Add a To-Do Task' : 'Bulk Add To-Do Tasks'}
          onClose={() => setShowFormModal(false)}
          width="1180px"
        >
          <TodoFormPanel
            formMode={formMode}
            singleForm={singleForm}
            onSingleChange={(patch) => setSingleForm((current) => ({ ...current, ...patch }))}
            onSingleSubmit={async () => {
              const result = await submitSingle();
              if (result.success) setShowFormModal(false);
              return result;
            }}
            bulkRows={bulkRows}
            onBulkRowChange={(rowId, patch) =>
              setBulkRows((current) => current.map((row) => (row.id === rowId ? { ...row, ...patch } : row)))
            }
            onBulkAddRow={() => setBulkRows((current) => [...current, {
              id: `bulk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
              task: '',
              priority: 'Medium',
              dueDate: '',
              tat: ''
            }])}
            onBulkRemoveRow={(rowId) => setBulkRows((current) => current.filter((row) => row.id !== rowId))}
            onBulkReset={resetBulkRows}
            onBulkSubmit={async () => {
              const result = await submitBulk();
              if (result.success) setShowFormModal(false);
              return result;
            }}
            submitting={submitting}
          />
        </AppModal>
      ) : null}

      <TodoTable rows={rows} submitting={submitting} onToggle={toggleRow} onEdit={handleEdit} onDelete={handleDelete} />
      {editTarget ? <TodoEditDialog row={editTarget} saving={submitting} onClose={() => setEditTarget(null)} onSubmit={saveEdit} /> : null}
      {deleteTarget ? <ConfirmDialog title="Delete To-Do Task" message={`Delete ${deleteTarget['Task ID'] || deleteTarget.TodoID}? This action will hide the task from your list.`} busy={submitting} onClose={() => setDeleteTarget(null)} onConfirm={confirmDelete} confirmLabel="Delete Task" /> : null}
    </section>
  );
}
