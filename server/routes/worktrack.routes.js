import express from 'express';
import { getEmployeeDashboard } from '../services/report.service.js';
import { attendance, tickets, todos } from '../data/seed.js';

const router = express.Router();

router.get('/:employeeId/dashboard', (req, res) => {
  res.json(getEmployeeDashboard(req.params.employeeId));
});

router.post('/:employeeId/attendance', (req, res) => {
  const row = {
    employeeId: req.params.employeeId,
    employeeName: req.body.employeeName,
    date: new Date().toISOString().slice(0, 10),
    status: req.body.action === 'out' ? 'Completed' : 'Present',
    inTime: req.body.inTime || new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
    outTime: req.body.action === 'out' ? new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '',
    duration: req.body.duration || ''
  };
  attendance.unshift(row);
  res.status(201).json({ success: true, item: row });
});

router.post('/:employeeId/todos', (req, res) => {
  const todo = {
    todoId: `TODO_${Date.now()}`,
    employeeId: req.params.employeeId,
    employeeName: req.body.employeeName,
    task: req.body.task,
    priority: req.body.priority || 'Medium',
    dueDate: req.body.dueDate,
    status: 'Pending',
    tatMinutes: Number(req.body.tatMinutes) || 0
  };
  todos.unshift(todo);
  res.status(201).json({ success: true, item: todo });
});

router.patch('/tickets/:ticketId', (req, res) => {
  const ticket = tickets.find((item) => item.ticketId === req.params.ticketId);
  if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found.' });
  Object.assign(ticket, req.body);
  res.json({ success: true, item: ticket });
});

export default router;
