import express from 'express';
import {
  adminTicketAction,
  getPendingApprovals,
  getTaskApproversList,
  processApprovalAction,
  transferTicketApproval
} from '../services/approvals.service.js';

const router = express.Router();

router.post('/queue', async (req, res) => {
  try {
    res.json(await getPendingApprovals(req.auth.sub));
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/action', async (req, res) => {
  try {
    const result = await processApprovalAction({ ...(req.body.payload || {}), adminId: req.auth.sub, AdminID: req.auth.sub, 'Admin ID': req.auth.sub });
    if (!result.success) return res.status(400).json(result);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/ticket-action', async (req, res) => {
  try {
    const result = await adminTicketAction(req.body.ticketId, req.auth.sub, req.body.action, req.body.remarks);
    if (!result.success) return res.status(400).json(result);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/approvers', async (_req, res) => {
  try {
    res.json(await getTaskApproversList());
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/transfer', async (req, res) => {
  try {
    const result = await transferTicketApproval(req.body.ticketId, req.body.targetManagerId, req.auth.sub, req.body.remarks);
    if (!result.success) return res.status(400).json(result);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
