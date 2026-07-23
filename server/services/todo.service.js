import { enforceAttendanceGate } from './attendance.service.js';
import { insertRow, listRows, upsertRow } from './legacyStore.service.js';

const safe = (value) => String(value ?? '').trim();
const eq = (left, right) => safe(left).toLowerCase() === safe(right).toLowerCase();
const first = (row, keys, fallback = '') => keys.map((key) => row?.[key]).find((value) => safe(value)) ?? fallback;
const ok = (payload = {}) => ({ success: true, ...payload });
const fail = (message) => ({ success: false, message });

function nowIso() {
  return new Date().toISOString();
}

function asTodoRow(row = {}) {
  const id = first(row, ['Task ID', 'TodoID', 'ID', 'todoId', 'taskId']);
  const employeeId = first(row, ['Employee ID', 'EmpID', 'employeeId']);
  const employeeName = first(row, ['Employee Name', 'User', 'employeeName'], employeeId);
  const task = first(row, ['Task', 'Description', 'task']);
  const dueDate = first(row, ['Due Date', 'Date', 'dueDate']);

  return {
    ...row,
    'Task ID': id,
    ID: id,
    TodoID: id,
    'Employee ID': employeeId,
    EmpID: employeeId,
    'Employee Name': employeeName,
    User: employeeName,
    Task: task,
    Description: task,
    Priority: first(row, ['Priority', 'priority'], 'Normal'),
    Status: first(row, ['Status', 'status'], 'Pending'),
    'Due Date': dueDate,
    Date: dueDate,
    TAT: first(row, ['TAT', 'tatMinutes'], '')
  };
}

async function requireAttendanceActive(employeeId) {
  const gate = await enforceAttendanceGate(employeeId);
  return gate.success ? null : gate;
}

export async function getTodos(employeeId) {
  const todos = await listRows('Todo');
  return ok({
    data: todos.filter((todo) => eq(todo['Employee ID'], employeeId)).map(asTodoRow)
  });
}

export async function addTodo(employeeId, task, priority, dueDate, tat) {
  const gate = await requireAttendanceActive(employeeId);
  if (gate) return gate;

  const id = `TODO_${Date.now()}`;
  const users = await listRows('User');
  const user = users.find((item) => eq(item['Employee ID'], employeeId));
  const row = {
    'Task ID': id,
    TodoID: id,
    'Employee ID': employeeId,
    'Employee Name': first(user, ['Employee Name', 'Name']),
    Task: task,
    Description: task,
    Priority: priority || 'Medium',
    'Due Date': dueDate,
    Date: dueDate,
    TAT: tat || '',
    Status: 'Pending',
    'Last Update Date': nowIso()
  };

  await insertRow('Todo', row);
  return ok({ item: row });
}

export async function addBulkTodos(employeeId, todosList = []) {
  const gate = await requireAttendanceActive(employeeId);
  if (gate) return gate;

  const created = [];
  for (const item of todosList) {
    const result = await addTodo(
      employeeId,
      item.task || item.Task,
      item.priority || item.Priority,
      item.dueDate || item['Due Date'],
      item.tat || item.TAT
    );
    if (!result.success) return result;
    created.push(result.item);
  }

  return ok({ message: `${created.length} to-do task(s) added.`, data: created });
}

export async function toggleTodoStatus(taskId, currentStatus, employeeId = '') {
  const todos = await listRows('Todo');
  const todo = todos.find((item) => eq(item['Task ID'] || item.TodoID, taskId));
  if (!todo) return fail('To-Do task not found.');
  if (employeeId && !eq(todo['Employee ID'], employeeId)) return fail('You can only update your own To-Do tasks.');

  const gate = await requireAttendanceActive(todo?.['Employee ID']);
  if (gate) return gate;

  const nextStatus = /approved|cancelled|completed|done|resolved|paid|closed/i.test(String(currentStatus || ''))
    ? 'Pending'
    : 'Completed';
  const row = await upsertRow('Todo', 'Task ID', taskId, {
    'Task ID': taskId,
    Status: nextStatus,
    'Last Update Date': nowIso()
  });

  return ok({ item: row });
}

export async function editTodoItem(taskId, newTask, newPriority, newDueDate, newTAT, employeeId = '') {
  const todos = await listRows('Todo');
  const todo = todos.find((item) => eq(item['Task ID'] || item.TodoID, taskId));
  if (!todo) return fail('To-Do task not found.');
  if (employeeId && !eq(todo['Employee ID'], employeeId)) return fail('You can only edit your own To-Do tasks.');

  const gate = await requireAttendanceActive(todo?.['Employee ID']);
  if (gate) return gate;

  const row = await upsertRow('Todo', 'Task ID', taskId, {
    'Task ID': taskId,
    Task: newTask,
    Description: newTask,
    Priority: newPriority,
    'Due Date': newDueDate,
    Date: newDueDate,
    TAT: newTAT,
    'Last Update Date': nowIso()
  });

  return ok({ item: row });
}

export async function deleteTodoItem(taskId, employeeId = '') {
  const todos = await listRows('Todo');
  const todo = todos.find((item) => eq(item['Task ID'] || item.TodoID, taskId));
  if (!todo) return fail('To-Do task not found.');
  if (employeeId && !eq(todo['Employee ID'], employeeId)) return fail('You can only delete your own To-Do tasks.');

  const gate = await requireAttendanceActive(todo?.['Employee ID']);
  if (gate) return gate;

  const row = await upsertRow('Todo', 'Task ID', taskId, {
    'Task ID': taskId,
    Status: 'Deleted',
    'Last Update Date': nowIso()
  });

  return ok({ item: row });
}
