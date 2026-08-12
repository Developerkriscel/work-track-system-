import { listRows } from './legacyStore.service.js';

const safe = (value) => String(value ?? '').trim();
const eq = (left, right) => safe(left).toLowerCase() === safe(right).toLowerCase();
const first = (row, keys, fallback = '') => keys.map((key) => row?.[key]).find((value) => safe(value)) ?? fallback;
const ok = (payload = {}) => ({ success: true, ...payload });

function splitIds(value = '') {
  return safe(value)
    .split(',')
    .map((item) => safe(item).toLowerCase())
    .filter(Boolean);
}

function notificationTimestamp(row = {}, fallback = '') {
  return first(
    row,
    [
      'Last Update Date',
      'Latest Update Date',
      'Completed At',
      'Done Date',
      'Timestamp',
      'Date',
      'Start Date',
      'Intimation Date',
      'Due Date',
      'Plan Date'
    ],
    fallback || new Date().toISOString()
  );
}

function notificationRecord({ id, module, type, view, status, message, timestamp, actor = '', owner = '', meta = {} }) {
  return {
    id,
    type,
    module,
    view,
    Status: status || 'Updated',
    Message: message || `${type || 'Item'} updated`,
    Timestamp: timestamp,
    'Last Update Date': timestamp,
    Actor: actor,
    Owner: owner,
    ...meta
  };
}

function buildManagedIds(employeeId, users = []) {
  return new Set(
    users
      .filter((item) => {
        if (!eq(first(item, ['Status', 'status'], 'Active'), 'Active')) return false;
        const itemEmployeeId = first(item, ['Employee ID', 'User ID', 'EMP Code', 'employeeId', 'userId', 'empCode']);
        if (eq(itemEmployeeId, employeeId)) return false;
        const managerIds = splitIds(first(item, ['Manager ID', 'Manager', 'managerId', 'manager']));
        const approverIds = splitIds(first(item, ['Task Approver', 'taskApprover']));
        return managerIds.includes(employeeId.toLowerCase()) || approverIds.includes(employeeId.toLowerCase());
      })
      .map((item) => safe(first(item, ['Employee ID', 'User ID', 'EMP Code', 'employeeId', 'userId', 'empCode'])).toUpperCase())
      .filter(Boolean)
  );
}

function fmsVisibilityDecision(context, task = {}) {
  const taskEmpId = safe(first(task, ['Employee ID', 'EmpID', 'empId'])).toUpperCase();
  const approvers = splitIds(first(task, ['Task Approver', 'Manager ID', 'Manager']));
  const status = safe(first(task, ['Status'], 'Pending'));
  const isMyTask = taskEmpId === context.employeeId;
  const isTeamTask = context.managedIds.has(taskEmpId);
  const isApprover = approvers.includes(context.employeeId.toLowerCase());
  const canSee = context.isElevated || isMyTask || isTeamTask || isApprover;
  return {
    canSee,
    isMyTask,
    isTeamTask,
    isApprover,
    status
  };
}

function employeeNotificationScope(employeeId, users = []) {
  const cleanEmpId = safe(employeeId).toUpperCase();
  const user = users.find((item) => eq(first(item, ['Employee ID', 'User ID', 'EMP Code', 'employeeId', 'userId', 'empCode']), cleanEmpId));
  const role = first(user, ['Role', 'role', 'Designation'], 'User');
  const isElevated = ['Admin', 'Super Admin', 'HR', 'Manager'].includes(role);
  const managedIds = buildManagedIds(cleanEmpId, users);
  return { employeeId: cleanEmpId, role, isElevated, managedIds };
}

function isNewerThanCutoff(timestampValue, cutoff) {
  const parsed = Date.parse(timestampValue);
  if (!cutoff) return true;
  return Number.isNaN(parsed) || parsed >= cutoff;
}

async function rows() {
  const [
    users,
    tickets,
    leaves,
    intimations,
    attendance,
    expenses,
    fms,
    todos,
    social
  ] = await Promise.all([
    listRows('User'),
    listRows('Ticket'),
    listRows('Leave'),
    listRows('Intimation'),
    listRows('Attendance'),
    listRows('Expense'),
    listRows('FmsTask'),
    listRows('Todo'),
    listRows('SocialMedia')
  ]);

  return { users, tickets, leaves, intimations, attendance, expenses, fms, todos, social };
}

export async function getEmployeeNotifications(employeeId, lastCheckTimestamp = 0) {
  const data = await rows();
  const cutoff = Number(lastCheckTimestamp) || Date.parse(lastCheckTimestamp) || 0;
  const scope = employeeNotificationScope(employeeId, data.users);
  const notifications = [];

  const pushIfVisible = (item, visible) => {
    if (!visible || !isNewerThanCutoff(item.Timestamp || item['Last Update Date'], cutoff)) return;
    notifications.push(item);
  };

  data.tickets.forEach((ticket) => {
    const ticketId = first(ticket, ['Ticket ID', 'ID', 'ticketId']);
    const ownerId = safe(first(ticket, ['Employee ID', 'User ID', 'employeeId', 'EmpID'])).toUpperCase();
    const approvers = splitIds(first(ticket, ['Task Approver', 'taskApprover']));
    const isMine = ownerId === scope.employeeId;
    const isApprover = approvers.includes(scope.employeeId.toLowerCase());
    const isTeam = scope.managedIds.has(ownerId);
    const visible = scope.isElevated ? (isMine || isApprover || isTeam) : (isMine || isApprover);
    if (!visible) return;

    pushIfVisible(notificationRecord({
      id: ticketId,
      module: 'tickets',
      type: 'Ticket',
      view: 'ticket-system-view',
      status: first(ticket, ['Status'], 'Updated'),
      message: `${first(ticket, ['Task Description', 'Description'], 'Ticket')} is ${first(ticket, ['Status'], 'Updated')}`,
      timestamp: notificationTimestamp(ticket),
      actor: first(ticket, ['Last Action By'], ''),
      owner: first(ticket, ['Employee Name'], ownerId),
      meta: { 'Ticket ID': ticketId }
    }), true);
  });

  data.leaves.forEach((leave) => {
    const ownerId = safe(first(leave, ['Employee ID', 'User ID', 'employeeId', 'EmpID'])).toUpperCase();
    const ownerName = first(leave, ['Employee Name', 'Name', 'employeeName', 'name'], ownerId);
    const status = first(leave, ['Status', 'status'], 'Pending');
    const visibleToOwner = ownerId === scope.employeeId;
    const visibleToApprover = /pending/i.test(status) && (['Super Admin', 'HR'].includes(scope.role) || scope.managedIds.has(ownerId));
    pushIfVisible(notificationRecord({
      id: first(leave, ['LeaveID', 'Leave ID', 'ID']),
      module: 'leave',
      type: 'Leave',
      view: visibleToOwner ? 'attendance-view' : 'approvals-view',
      status,
      message: visibleToOwner ? `Leave request is ${status}` : `New leave request from ${ownerName}`,
      timestamp: notificationTimestamp(leave, first(leave, ['Start Date', 'Date'])),
      owner: ownerName
    }), visibleToOwner || visibleToApprover);
  });

  data.intimations.forEach((item) => {
    const ownerId = safe(first(item, ['Employee ID', 'User ID', 'employeeId', 'EmpID'])).toUpperCase();
    const ownerName = first(item, ['Employee Name', 'Name', 'employeeName', 'name'], ownerId);
    const status = first(item, ['Status', 'status'], 'Submitted');
    const visibleToOwner = ownerId === scope.employeeId;
    const visibleToApprover = /pending|submitted/i.test(status) && (['Super Admin', 'HR'].includes(scope.role) || scope.managedIds.has(ownerId));
    pushIfVisible(notificationRecord({
      id: first(item, ['IntimationID', 'Intimation ID', 'ID']),
      module: 'intimation',
      type: 'Intimation',
      view: visibleToOwner ? 'attendance-view' : 'approvals-view',
      status,
      message: visibleToOwner ? `Intimation is ${status}` : `New intimation from ${ownerName}`,
      timestamp: notificationTimestamp(item, first(item, ['Intimation Date', 'Date'])),
      owner: ownerName
    }), visibleToOwner || visibleToApprover);
  });

  data.attendance.forEach((item) => {
    const ownerId = safe(first(item, ['Employee ID', 'User ID', 'employeeId', 'EmpID'])).toUpperCase();
    const ownerName = first(item, ['Employee Name', 'Name', 'employeeName', 'name'], ownerId);
    const status = first(item, ['Status', 'status'], first(item, ['Action', 'action'], 'Present'));
    const visibleToOwner = ownerId === scope.employeeId;
    const visibleToApprover = /pending|need approval/i.test(status) && (['Super Admin', 'HR'].includes(scope.role) || scope.managedIds.has(ownerId));
    pushIfVisible(notificationRecord({
      id: first(item, ['AttendanceID', 'ID']),
      module: 'attendance',
      type: 'Attendance',
      view: visibleToOwner ? 'attendance-view' : 'approvals-view',
      status,
      message: visibleToOwner ? `Attendance update: ${status}` : `Attendance approval needed for ${ownerName}`,
      timestamp: notificationTimestamp(item, first(item, ['Date'])),
      owner: ownerName
    }), visibleToOwner || visibleToApprover);
  });

  data.expenses.forEach((item) => {
    const ownerId = safe(first(item, ['Employee ID', 'User ID', 'employeeId', 'EmpID'])).toUpperCase();
    const ownerName = first(item, ['Employee Name', 'Name', 'employeeName', 'name'], ownerId);
    const status = first(item, ['Status', 'status'], 'Pending');
    const visibleToOwner = ownerId === scope.employeeId;
    const visibleToApprover = /pending/i.test(status) && ['Super Admin', 'HR', 'Admin'].includes(scope.role);
    pushIfVisible(notificationRecord({
      id: first(item, ['ExpenseID', 'ID']),
      module: 'expense',
      type: 'Expense',
      view: 'expense-view',
      status,
      message: visibleToOwner ? `Expense request is ${status}` : `Expense approval needed for ${ownerName}`,
      timestamp: notificationTimestamp(item, first(item, ['Date'])),
      owner: ownerName
    }), visibleToOwner || visibleToApprover);
  });

  data.fms.forEach((task) => {
    const decision = fmsVisibilityDecision(scope, task);
    if (!decision.canSee) return;
    pushIfVisible(notificationRecord({
      id: first(task, ['Task ID', 'ID', 'rowId']),
      module: 'fms',
      type: 'FMS',
      view: 'fms-view',
      status: first(task, ['Status'], 'Pending'),
      message: `${first(task, ['Task Description', 'Description'], 'FMS task')} is ${first(task, ['Status'], 'Pending')}`,
      timestamp: notificationTimestamp(task, first(task, ['Done Date', 'Plan Date', 'Date'])),
      owner: first(task, ['Employee Name', 'User', 'who'], '')
    }), decision.isMyTask || decision.isTeamTask || ['Super Admin', 'HR'].includes(scope.role));
  });

  data.todos.forEach((todo) => {
    const ownerId = safe(first(todo, ['Employee ID', 'User ID', 'employeeId', 'EmpID'])).toUpperCase();
    if (ownerId !== scope.employeeId) return;
    pushIfVisible(notificationRecord({
      id: first(todo, ['Task ID', 'TodoID', 'ID']),
      module: 'todo',
      type: 'To-Do',
      view: 'todo-view',
      status: first(todo, ['Status'], 'Pending'),
      message: `${first(todo, ['Task', 'Description'], 'To-do')} is ${first(todo, ['Status'], 'Pending')}`,
      timestamp: notificationTimestamp(todo, first(todo, ['Due Date', 'Date']))
    }), true);
  });

  notifications.sort((left, right) => (Date.parse(right.Timestamp || right['Last Update Date']) || 0) - (Date.parse(left.Timestamp || left['Last Update Date']) || 0));
  const items = notifications.slice(0, 100);
  return ok({ notifications: items, updates: items, serverTime: Date.now(), hasMore: notifications.length > items.length, total: notifications.length });
}

export async function getClientNotifications(clientId, lastCheckTimestamp = new Date(0).toISOString()) {
  const data = await rows();
  const cutoff = Date.parse(lastCheckTimestamp) || 0;

  const ticketUpdates = data.tickets
    .filter((ticket) => eq(first(ticket, ['Client_Id', 'Client ID', 'clientId']), clientId))
    .filter((ticket) => {
      const updateTime = Date.parse(first(ticket, ['Last Update Date', 'Timestamp', 'Date']));
      return !cutoff || Number.isNaN(updateTime) || updateTime >= cutoff;
    })
    .map((ticket) => ({
      id: first(ticket, ['Ticket ID', 'ID']),
      type: 'Ticket',
      module: 'tickets',
      view: 'client-tickets-view',
      Status: first(ticket, ['Status'], 'Updated'),
      Message: `${first(ticket, ['Task Description', 'Description'], 'Ticket')} is ${first(ticket, ['Status'], 'Updated')}`,
      Timestamp: first(ticket, ['Last Update Date', 'Timestamp', 'Date'], new Date().toISOString())
    }));

  const checklistUpdates = data.fms
    .filter((task) => eq(first(task, ['Client_Id', 'Client ID']), clientId))
    .filter((task) => {
      const updateTime = Date.parse(notificationTimestamp(task, first(task, ['Done Date', 'Plan Date', 'Date'])));
      return !cutoff || Number.isNaN(updateTime) || updateTime >= cutoff;
    })
    .map((task) => ({
      id: first(task, ['Task ID', 'ID', 'rowId']),
      type: 'Checklist',
      module: 'fms',
      view: 'client-fms-view',
      Status: first(task, ['Status'], 'Updated'),
      Message: `${first(task, ['Task Description', 'Description'], 'Checklist task')} is ${first(task, ['Status'], 'Updated')}`,
      Timestamp: notificationTimestamp(task, first(task, ['Done Date', 'Plan Date', 'Date']))
    }));

  const socialUpdates = data.social
    .filter((post) => eq(first(post, ['Client_Id', 'Client ID', 'clientId']), clientId))
    .filter((post) => {
      const updateTime = Date.parse(first(post, ['Latest Update Date', 'Planned Post Date', 'Date']));
      return !cutoff || Number.isNaN(updateTime) || updateTime >= cutoff;
    })
    .map((post) => ({
      id: first(post, ['Post ID', 'ID']),
      type: 'Social Media',
      module: 'social',
      view: 'client-social-view',
      Status: first(post, ['Status'], 'Updated'),
      Message: `${first(post, ['Description', 'Caption'], 'Social post')} is ${first(post, ['Status'], 'Updated')}`,
      Timestamp: first(post, ['Latest Update Date', 'Planned Post Date', 'Date'], new Date().toISOString())
    }));

  const updates = [...ticketUpdates, ...checklistUpdates, ...socialUpdates]
    .sort((left, right) => (Date.parse(right.Timestamp) || 0) - (Date.parse(left.Timestamp) || 0))
    .slice(0, 100);

  return ok({ updates, notifications: updates, serverTime: new Date().toISOString(), hasMore: updates.length < ticketUpdates.length + checklistUpdates.length + socialUpdates.length, total: ticketUpdates.length + checklistUpdates.length + socialUpdates.length });
}
