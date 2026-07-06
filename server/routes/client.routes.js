import express from 'express';
import { getClientDashboard } from '../services/report.service.js';
import { messages, tickets } from '../data/seed.js';

const router = express.Router();

router.get('/:clientId/dashboard', (req, res) => {
  res.json(getClientDashboard(req.params.clientId));
});

router.post('/:clientId/tickets', (req, res) => {
  const ticket = {
    ticketId: `TICKET_${Date.now()}`,
    clientId: req.params.clientId,
    clientName: req.body.clientName || 'Client',
    employeeId: '',
    employeeName: 'Unassigned',
    category: req.body.category,
    priority: req.body.priority || 'Medium',
    description: req.body.description,
    status: 'Open',
    timestamp: new Date().toISOString().slice(0, 10),
    planDate: req.body.planDate || '',
    tatMinutes: 0,
    remarks: 'Created from MERN client portal.'
  };
  tickets.unshift(ticket);
  res.status(201).json({ success: true, item: ticket });
});

router.patch('/:clientId/tickets/:ticketId/status', (req, res) => {
  const ticket = tickets.find((item) => item.clientId === req.params.clientId && item.ticketId === req.params.ticketId);
  if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found.' });
  ticket.status = req.body.status;
  ticket.remarks = `${ticket.remarks || ''}\n[[${req.body.status} by Client]] ${req.body.remarks || ''}`.trim();
  res.json({ success: true, item: ticket });
});

router.get('/tasks/:taskId/messages', (req, res) => {
  res.json({ success: true, data: messages.filter((message) => message.taskId === req.params.taskId) });
});

router.post('/tasks/:taskId/messages', (req, res) => {
  const message = { messageId: `MSG_${Date.now()}`, taskId: req.params.taskId, sender: req.body.sender || 'Client', message: req.body.message, timestamp: new Date().toISOString() };
  messages.push(message);
  res.status(201).json({ success: true, item: message });
});

export default router;
