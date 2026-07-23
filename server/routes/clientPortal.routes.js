import express from 'express';
import {
  createBulkTicketsWithDetails,
  getClientDashboardData,
  getClientInvoices,
  getClientReportData,
  getClientTickets,
  getMessagesForTask,
  getTicketDetails,
  markTicketMessagesAsRead,
  postMessage,
  submitClientResponse,
  updateTicketStatusByClient
} from '../services/clientPortal.service.js';

const router = express.Router();

router.post('/dashboard', async (req, res) => {
  try {
    res.json(await getClientDashboardData(req.auth.sub));
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/tickets', async (req, res) => {
  try {
    const { startDate, endDate, statusFilter } = req.body;
    res.json(await getClientTickets(req.auth.sub, startDate, endDate, statusFilter));
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/tickets/create-bulk', async (req, res) => {
  try {
    const result = await createBulkTicketsWithDetails(req.body.ticketList || [], { ...(req.body.clientInfo || {}), Client_Id: req.auth.sub, 'Client ID': req.auth.sub });
    if (!result.success) return res.status(400).json(result);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/tickets/update-status', async (req, res) => {
  try {
    const { ticketId, newStatus, remarks } = req.body;
    const result = await updateTicketStatusByClient(ticketId, newStatus, remarks, req.auth.sub);
    if (!result.success) return res.status(400).json(result);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/tickets/response', async (req, res) => {
  try {
    const { ticketId, remarks, attachment, clientInfo } = req.body;
    const result = await submitClientResponse(ticketId, remarks, attachment, { ...(clientInfo || {}), Client_Id: req.auth.sub, 'Client ID': req.auth.sub });
    if (!result.success) return res.status(400).json(result);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/tickets/details', async (req, res) => {
  try {
    const result = await getTicketDetails(req.body.ticketId, req.auth.sub);
    if (!result.success) return res.status(404).json(result);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/tickets/messages', async (req, res) => {
  try {
    res.json(await getMessagesForTask(req.body.ticketId, req.auth.sub));
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/tickets/messages/post', async (req, res) => {
  try {
    const result = await postMessage(req.body.ticketId, req.body.messageText, { ...(req.body.clientInfo || {}), Client_Id: req.auth.sub, 'Client ID': req.auth.sub });
    if (!result.success) return res.status(400).json(result);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/tickets/messages/read', async (req, res) => {
  try {
    const result = await markTicketMessagesAsRead(req.body.ticketId, req.auth.sub);
    if (!result.success) return res.status(400).json(result);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/invoices', async (req, res) => {
  try {
    res.json(await getClientInvoices(req.auth.sub));
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/reports', async (req, res) => {
  try {
    const { startDate, endDate } = req.body;
    res.json(await getClientReportData(req.auth.sub, startDate, endDate));
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
