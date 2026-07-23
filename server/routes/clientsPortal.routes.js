import express from 'express';
import {
  deleteClientPortalData,
  getClientsPortalData,
  saveClientPortalData
} from '../services/clientsPortal.service.js';

const router = express.Router();

router.post('/list', async (_req, res) => {
  try {
    res.json(await getClientsPortalData());
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/save', async (req, res) => {
  try {
    const result = await saveClientPortalData(req.body.clientData || {}, req.auth.sub, req.auth.role);
    if (!result.success) return res.status(403).json(result);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/delete', async (req, res) => {
  try {
    const result = await deleteClientPortalData(req.body.clientId, req.auth.sub);
    if (!result.success) return res.status(403).json(result);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
