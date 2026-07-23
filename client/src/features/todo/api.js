import { httpClient } from '@/lib/api/httpClient';

export async function fetchTodos(employeeId) {
  return httpClient('/api/todo/list', {
    method: 'POST',
    body: JSON.stringify({
      employeeId
    })
  });
}

export async function createTodo(employeeId, task, priority, dueDate, tat) {
  return httpClient('/api/todo/create', {
    method: 'POST',
    body: JSON.stringify({
      employeeId,
      task,
      priority,
      dueDate,
      tat
    })
  });
}

export async function createBulkTodos(employeeId, todosList) {
  return httpClient('/api/todo/create-bulk', {
    method: 'POST',
    body: JSON.stringify({
      employeeId,
      todosList
    })
  });
}

export async function toggleTodo(taskId, currentStatus) {
  return httpClient('/api/todo/toggle', {
    method: 'POST',
    body: JSON.stringify({
      taskId,
      currentStatus
    })
  });
}

export async function updateTodo(taskId, task, priority, dueDate, tat) {
  return httpClient('/api/todo/update', {
    method: 'POST',
    body: JSON.stringify({
      taskId,
      task,
      priority,
      dueDate,
      tat
    })
  });
}

export async function removeTodo(taskId) {
  return httpClient('/api/todo/delete', {
    method: 'POST',
    body: JSON.stringify({
      taskId
    })
  });
}
