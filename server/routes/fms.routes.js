import express from 'express';
import { createFmsTask, getFmsAssignableUsers, getFmsTasks, markFmsTaskDone, syncFmsFromGoogleSheet } from '../services/fms.service.js';

const router = express.Router();

router.post('/tasks', async (req, res) => {
  try {
    const result = await getFmsTasks(req.auth.sub, req.body || {});
    if (!result.success) return res.status(400).json(result);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/sync', async (req, res) => {
  try {
    const result = await syncFmsFromGoogleSheet();
    res.json({ success: true, ...result });
  } catch (error) {
    import('fs').then(fs => fs.writeFileSync('sync_error.log', error.stack || error.message));
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/sync', async (req, res) => {
  try {
    const result = await syncFmsFromGoogleSheet();
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/assignable-users', async (req, res) => {
  try {
    const result = await getFmsAssignableUsers(req.auth.sub);
    if (!result.success) return res.status(400).json(result);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/create', async (req, res) => {
  try {
    const result = await createFmsTask(req.body.payload || {}, req.auth.sub);
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
