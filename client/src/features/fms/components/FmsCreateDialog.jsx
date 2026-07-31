import { useEffect, useState } from 'react';
import { AppModal } from '@/components/modals';

function todayYmd() {
  return new Date().toISOString().slice(0, 10);
}

function buildInitialForm(employeeId, assignableUsers = []) {
  const currentId = String(employeeId || '').trim();
  const defaultAssignee = assignableUsers.find((item) => String(item.id || '').trim().toLowerCase() === currentId.toLowerCase())?.id
    || assignableUsers[0]?.id
    || currentId
    || '';

  return {
    assigneeId: defaultAssignee,
    fmsName: '',
    taskName: '',
    taskDescription: '',
    what: '',
    how: '',
    stepNo: '',
    planDate: todayYmd(),
    tatMinutes: '60',
    formLink: '',
    remarks: ''
  };
}

export function FmsCreateDialog({
  employeeId,
  assignableUsers,
  loadingAssignableUsers,
  saving,
  onClose,
  onSubmit
}) {
  const [form, setForm] = useState(() => buildInitialForm(employeeId, assignableUsers));

  useEffect(() => {
    setForm((current) => {
      const defaultAssignee = assignableUsers.find((item) => String(item.id || '').trim().toLowerCase() === String(current.assigneeId || '').trim().toLowerCase())?.id
        || assignableUsers[0]?.id
        || String(employeeId || '').trim()
        || '';
      if (current.assigneeId === defaultAssignee) return current;
      return { ...current, assigneeId: defaultAssignee };
    });
  }, [assignableUsers, employeeId]);

  function patch(patchValue) {
    setForm((current) => ({ ...current, ...patchValue }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    onSubmit({
      employeeId: form.assigneeId,
      'Employee ID': form.assigneeId,
      assigneeId: form.assigneeId,
      'FMS Name': form.fmsName,
      fmsName: form.fmsName,
      'Task Name': form.taskName,
      taskName: form.taskName,
      'Task Description': form.taskDescription,
      Description: form.taskDescription,
      description: form.taskDescription,
      What: form.what,
      what: form.what,
      How: form.how,
      how: form.how,
      'Step No': form.stepNo,
      stepNo: form.stepNo,
      'Plan Date': form.planDate,
      planDate: form.planDate,
      TAT: form.tatMinutes,
      tatMinutes: form.tatMinutes,
      'Form Link': form.formLink,
      formLink: form.formLink,
      Remarks: form.remarks,
      remarks: form.remarks
    });
  }

  return (
    <AppModal title="Create FMS Task" onClose={onClose} width="800px">
      <form className="ticket-form-grid" onSubmit={handleSubmit}>
        <label className="dashboard-control">
          <span>Assign To *</span>
          <select
            value={form.assigneeId}
            onChange={(event) => patch({ assigneeId: event.target.value })}
            required
            disabled={loadingAssignableUsers && !assignableUsers.length}
          >
            {!assignableUsers.length ? (
              <option value="">{loadingAssignableUsers ? 'Loading employees...' : 'No assignable users found'}</option>
            ) : null}
            {assignableUsers.map((user) => (
              <option key={user.id} value={user.id}>
                {user.label}
              </option>
            ))}
          </select>
        </label>

        <label className="dashboard-control">
          <span>FMS Name *</span>
          <input
            type="text"
            value={form.fmsName}
            onChange={(event) => patch({ fmsName: event.target.value })}
            placeholder="e.g. CRM FMS"
            required
          />
        </label>

        <label className="dashboard-control forms-editor__full">
          <span>Task Name *</span>
          <input
            type="text"
            value={form.taskName}
            onChange={(event) => patch({ taskName: event.target.value })}
            placeholder="Enter task title"
            required
          />
        </label>

        <label className="dashboard-control forms-editor__full">
          <span>Task Description *</span>
          <textarea
            rows="4"
            value={form.taskDescription}
            onChange={(event) => patch({ taskDescription: event.target.value })}
            placeholder="Describe the work to be done"
            required
          />
        </label>

        <label className="dashboard-control">
          <span>What</span>
          <input
            type="text"
            value={form.what}
            onChange={(event) => patch({ what: event.target.value })}
            placeholder="Task category / what"
          />
        </label>

        <label className="dashboard-control">
          <span>How</span>
          <input
            type="text"
            value={form.how}
            onChange={(event) => patch({ how: event.target.value })}
            placeholder="How to do it"
          />
        </label>

        <label className="dashboard-control">
          <span>Step No</span>
          <input
            type="text"
            value={form.stepNo}
            onChange={(event) => patch({ stepNo: event.target.value })}
            placeholder="e.g. 1"
          />
        </label>

        <label className="dashboard-control">
          <span>Plan Date *</span>
          <input
            type="date"
            value={form.planDate}
            onChange={(event) => patch({ planDate: event.target.value })}
            required
          />
        </label>

        <label className="dashboard-control">
          <span>TAT (mins) *</span>
          <input
            type="number"
            min="1"
            value={form.tatMinutes}
            onChange={(event) => patch({ tatMinutes: event.target.value })}
            required
          />
        </label>

        <label className="dashboard-control forms-editor__full">
          <span>Form Link</span>
          <input
            type="url"
            value={form.formLink}
            onChange={(event) => patch({ formLink: event.target.value })}
            placeholder="https://..."
          />
        </label>

        <label className="dashboard-control forms-editor__full">
          <span>Remarks</span>
          <textarea
            rows="3"
            value={form.remarks}
            onChange={(event) => patch({ remarks: event.target.value })}
            placeholder="Optional notes"
          />
        </label>

        <div className="ticket-form-actions ticket-form-grid__full" style={{ justifyContent: 'flex-end', marginTop: '8px' }}>
          <button type="button" className="attendance-cta attendance-cta--gray" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="attendance-cta attendance-cta--blue" disabled={saving || loadingAssignableUsers}>
            {saving ? 'Creating...' : 'Create FMS'}
          </button>
        </div>
      </form>
    </AppModal>
  );
}
