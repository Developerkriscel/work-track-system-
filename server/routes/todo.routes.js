import express from 'express';
import {
  addBulkTodos,
  addTodo,
  deleteTodoItem,
  editTodoItem,
  getTodos,
  toggleTodoStatus
} from '../services/todo.service.js';

const router = express.Router();

router.post('/list', async (req, res) => {
  try {
    res.json(await getTodos(req.auth.sub));
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/create', async (req, res) => {
  try {
    const { task, priority, dueDate, tat } = req.body;
    const result = await addTodo(req.auth.sub, task, priority, dueDate, tat);
    if (!result.success) return res.status(400).json(result);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/create-bulk', async (req, res) => {
  try {
    const { todosList } = req.body;
    const result = await addBulkTodos(req.auth.sub, todosList);
    if (!result.success) return res.status(400).json(result);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/toggle', async (req, res) => {
  try {
    const { taskId, currentStatus } = req.body;
    const result = await toggleTodoStatus(taskId, currentStatus, req.auth.sub);
    if (!result.success) return res.status(400).json(result);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/update', async (req, res) => {
  try {
    const { taskId, task, priority, dueDate, tat } = req.body;
    const result = await editTodoItem(taskId, task, priority, dueDate, tat, req.auth.sub);
    if (!result.success) return res.status(400).json(result);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/delete', async (req, res) => {
  try {
    const result = await deleteTodoItem(req.body.taskId, req.auth.sub);
    if (!result.success) return res.status(400).json(result);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
