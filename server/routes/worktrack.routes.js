import express from 'express';
import { getEmployeeDashboard } from '../services/report.service.js';
import { insertRow, listRows, sheetTodo, upsertRow } from '../services/legacyStore.service.js';
import { recordAttendance } from '../services/attendance.service.js';

const router = express.Router();

router.get('/:employeeId/dashboard', async (req, res) => {
  res.json(await getEmployeeDashboard(req.auth.sub));
});

router.post('/:employeeId/attendance', async (req, res) => {
  const result = await recordAttendance({
    ...req.body,
    'Employee ID': req.auth.sub,
    'Employee Name': req.body.employeeName,
    Action: req.body.action === 'out' ? 'Punch Out' : 'Punch In',
    Photo: req.body.Photo || req.body.photo,
    Lattitude: req.body.Lattitude ?? req.body.Latitude ?? req.body.latitude,
    Longitude: req.body.Longitude ?? req.body.longitude
  });
  if (!result.success) return res.status(400).json(result);
  res.status(201).json(result);
});

router.post('/:employeeId/todos', async (req, res) => {
  const todo = sheetTodo({
    taskId: `TODO_${Date.now()}`,
    employeeId: req.auth.sub,
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
