import express from 'express';
import {
  addClientRemarkToHistoryEntry,
  getClientSocialTasks,
  getSocialTaskDetails,
  getSocialTaskHistory,
  updateSocialPostStatusByClient
} from '../services/clientSocial.service.js';

const router = express.Router();

router.post('/tasks', async (req, res) => {
  try {
    const { startDate, endDate } = req.body;
    res.json(await getClientSocialTasks(req.auth.sub, startDate, endDate));
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/details', async (req, res) => {
  try {
    const result = await getSocialTaskDetails(req.body.postId, req.auth.sub);
    if (!result.success) return res.status(404).json(result);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/history', async (req, res) => {
  try {
    const result = await getSocialTaskHistory(req.body.postId, req.auth.sub);
    if (!result.success) return res.status(404).json(result);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/update-status', async (req, res) => {
  try {
    const { postId, newStatus, remarks, client } = req.body;
    const result = await updateSocialPostStatusByClient(postId, newStatus, remarks, {
      ...(client && typeof client === 'object' ? client : {}),
      Client_Id: req.auth.sub,
      'Client ID': req.auth.sub
    });
    if (!result.success) return res.status(400).json(result);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/history/remark', async (req, res) => {
  try {
    const result = await addClientRemarkToHistoryEntry(req.body.historyId, req.body.clientRemark, req.auth.sub);
    if (!result.success) return res.status(400).json(result);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
