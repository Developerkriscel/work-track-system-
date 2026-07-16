import express from 'express';
import { getClientDashboard } from '../services/report.service.js';
import { insertRow, listRows, sheetMessage, sheetTicket, upsertRow } from '../services/legacyStore.service.js';

const router = express.Router();

router.get('/:clientId/dashboard', async (req, res) => {
  res.json(await getClientDashboard(req.params.clientId));
});

router.post('/:clientId/tickets', async (req, res) => {
  const ticket = sheetTicket({
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
  });
  await insertRow('Ticket', ticket);
  res.status(201).json({ success: true, item: ticket });
});

router.patch('/:clientId/tickets/:ticketId/status', async (req, res) => {
  const tickets = await listRows('Ticket');
  const ticket = tickets.find((item) => String(item.Client_Id || item['Client ID'] || item.clientId) === String(req.params.clientId) && String(item['Ticket ID'] || item.ticketId) === String(req.params.ticketId));
  if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found.' });
  const updated = {
    ...ticket,
    Status: req.body.status,
    Remarks: `${ticket.Remarks || ''}\n[[${req.body.status} by Client]] ${req.body.remarks || ''}`.trim()
  };
  await upsertRow('Ticket', 'Ticket ID', updated['Ticket ID'] || updated.ticketId, updated);
  res.json({ success: true, item: updated });
});

router.get('/tasks/:taskId/messages', async (req, res) => {
  const messages = await listRows('Message');
  res.json({ success: true, data: messages.filter((message) => String(message.TaskID || message.taskId) === String(req.params.taskId)) });
});

router.post('/tasks/:taskId/messages', async (req, res) => {
  const message = sheetMessage({
    messageId: `MSG_${Date.now()}`,
    taskId: req.params.taskId,
    sender: req.body.sender || 'Client',
    message: req.body.message,
    timestamp: new Date().toISOString()
  });
  await insertRow('Message', message);
  res.status(201).json({ success: true, item: message });
});

export default router;
