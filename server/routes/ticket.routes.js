import express from 'express';
import {
  createTicket,
  createBulkTickets,
  adminTicketAction,
  getTaskMessages,
  getTicketSystemData,
  markTicketMessagesAsRead,
  postTaskMessage,
  processClientResponse,
  reassignTicket,
  updateTicket,
  updateTicketSchedule,
  transferTicketApproval
} from '../services/ticket.service.js';

const router = express.Router();

router.post('/workspace', async (req, res) => {
  try {
    res.json(await getTicketSystemData(req.auth.sub, req.auth.role));
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/create', async (req, res) => {
  try {
    const payload = req.body.ticketPayload || {};
    const elevated = ['super admin', 'admin', 'manager', 'hr'].includes(String(req.auth.role || '').toLowerCase());
    const assignee = elevated ? (payload['Employee ID'] || req.auth.sub) : req.auth.sub;
    const result = await createTicket({ ...payload, 'Creator ID': req.auth.sub, 'Created By': req.auth.sub, 'Employee ID': assignee, employeeId: assignee });
    if (!result.success) return res.status(400).json(result);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/create-bulk', async (req, res) => {
  try {
    const tickets = Array.isArray(req.body.tickets) ? req.body.tickets : [];
    const elevated = ['super admin', 'admin', 'manager', 'hr'].includes(String(req.auth.role || '').toLowerCase());
    const result = await createBulkTickets(tickets.map((ticket) => ({ ...ticket, 'Creator ID': req.auth.sub, 'Created By': req.auth.sub, 'Employee ID': elevated ? (ticket['Employee ID'] || req.auth.sub) : req.auth.sub })));
    if (!result.success) return res.status(400).json(result);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/update', async (req, res) => {
  try {
    const result = await updateTicket(req.body.ticketId, { ...(req.body.updatePayload || {}), 'Updated By': req.auth.sub, updatedBy: req.auth.sub, role: req.auth.role });
    if (!result.success) return res.status(400).json(result);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/schedule', async (req, res) => {
  try {
    const result = await updateTicketSchedule(
      req.body.ticketId,
      req.body.newTAT,
      req.body.newPlanDate,
      req.body.reason,
      req.auth.sub,
      req.auth.role
    );
    if (!result.success) return res.status(400).json(result);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/reassign', async (req, res) => {
  try {
    const result = await reassignTicket(req.body.ticketId, req.body.reassignToId, req.auth.sub, req.body.remarks, req.auth.role);
    if (!result.success) return res.status(400).json(result);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/approval-action', async (req, res) => {
  try {
    const result = await adminTicketAction(req.body.ticketId, req.body.action, req.body.remarks, req.auth.sub, req.auth.role);
    if (!result.success) return res.status(400).json(result);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/approval-transfer', async (req, res) => {
  try {
    const result = await transferTicketApproval(req.body.ticketId, req.body.targetManagerId, req.body.remarks, req.auth.sub, req.auth.role);
    if (!result.success) return res.status(400).json(result);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/client-response', async (req, res) => {
  try {
    const result = await processClientResponse(req.body.ticketId, req.body.clientResponse, req.body.newPlanDate, req.body.attachment, req.auth.sub, req.auth.role);
    if (!result.success) return res.status(400).json(result);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/messages', async (req, res) => {
  try {
    res.json(await getTaskMessages(req.body.ticketId, req.auth.sub, req.auth.role));
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/messages/post', async (req, res) => {
  try {
    const result = await postTaskMessage(req.body.ticketId, req.body.messageText, req.auth.sub, req.auth.role);
    if (!result.success) return res.status(400).json(result);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/messages/read', async (req, res) => {
  try {
    res.json(await markTicketMessagesAsRead(req.body.ticketId, '', req.auth.sub, req.auth.role));
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
