import express from 'express';
import { getEmployeeDashboard } from '../services/report.service.js';
import { insertRow, listRows, sheetAttendance, sheetTodo, upsertRow } from '../services/legacyStore.service.js';

const router = express.Router();

router.get('/:employeeId/dashboard', async (req, res) => {
  res.json(await getEmployeeDashboard(req.params.employeeId));
});

router.post('/:employeeId/attendance', async (req, res) => {
  const row = sheetAttendance({
    employeeId: req.params.employeeId,
    employeeName: req.body.employeeName,
    date: new Date().toISOString().slice(0, 10),
    action: req.body.action === 'out' ? 'Punch Out' : 'Punch In',
    status: req.body.action === 'out' ? 'Completed' : 'Present',
    inTime: req.body.inTime || new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
    outTime: req.body.action === 'out' ? new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '',
    duration: req.body.duration || ''
  });
  await insertRow('Attendance', row);
  res.status(201).json({ success: true, item: row });
});

router.post('/:employeeId/todos', async (req, res) => {
  const todo = sheetTodo({
    taskId: `TODO_${Date.now()}`,
    employeeId: req.params.employeeId,
    employeeName: req.body.employeeName,
    task: req.body.task,
    priority: req.body.priority || 'Medium',
    dueDate: req.body.dueDate,
    status: 'Pending',
    tatMinutes: Number(req.body.tatMinutes) || 0
  });
  await insertRow('Todo', todo);
  res.status(201).json({ success: true, item: todo });
});

router.patch('/tickets/:ticketId', async (req, res) => {
  const tickets = await listRows('Ticket');
  const ticket = tickets.find((item) => String(item['Ticket ID'] || item.ticketId) === req.params.ticketId);
  if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found.' });
  const updated = { ...ticket, ...req.body, 'Ticket ID': req.params.ticketId };
  await upsertRow('Ticket', 'Ticket ID', req.params.ticketId, updated);
  res.json({ success: true, item: updated });
});

export default router;
