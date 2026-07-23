import express from 'express';
import { getClientNotifications, getEmployeeNotifications } from '../services/notifications.service.js';

const router = express.Router();

router.post('/employee', async (req, res) => {
  try {
    res.json(await getEmployeeNotifications(req.auth.sub, req.body.lastCheckTimestamp));
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/client', async (req, res) => {
  try {
    res.json(await getClientNotifications(req.auth.sub, req.body.lastCheckTimestamp));
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
