import express from 'express';
import { getFmsTasks, markFmsTaskDone } from '../services/fms.service.js';

const router = express.Router();

router.post('/tasks', async (req, res) => {
  try {
    const result = await getFmsTasks(req.auth.sub);
    if (!result.success) return res.status(400).json(result);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/complete', async (req, res) => {
  try {
    const result = await markFmsTaskDone(req.body.rowId, req.body.remarks, req.auth.sub);
    if (!result.success) return res.status(400).json(result);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
