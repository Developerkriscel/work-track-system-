import express from 'express';
import { getEmpMasterData, getNextEmpCode, saveEmpMasterData } from '../services/empMaster.service.js';

const router = express.Router();

router.post('/data', async (req, res) => {
  try {
    res.json(await getEmpMasterData(req.body.category || 'Master'));
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/next-code', async (req, res) => {
  try {
    const result = await getNextEmpCode(req.body.category || 'EMP');
    if (!result.success) return res.status(400).json(result);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/save', async (req, res) => {
  try {
    const result = await saveEmpMasterData(req.body.category, req.body.formData || {}, req.body.filePayloads || {}, req.auth.sub);
    if (!result.success) return res.status(400).json(result);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
