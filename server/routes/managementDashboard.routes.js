import express from 'express';
import { createManagementBatch, getManagementDashboardData } from '../services/managementDashboard.service.js';

const router = express.Router();

const handleData = async (req, res) => {
  try {
    const startDate = req.body?.startDate || req.query?.startDate;
    const endDate = req.body?.endDate || req.query?.endDate;
    const scope = req.body?.scope || req.query?.scope;
    const options = { ...req.query, ...(req.body || {}) };
    const result = await getManagementDashboardData(startDate, endDate, scope, options);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

router.get('/', handleData);
router.post('/', handleData);
router.get('/data', handleData);
router.post('/data', handleData);

router.post('/batch', async (req, res) => {
  try {
    const result = await createManagementBatch(
      req.auth.sub,
      req.body.type,
      req.body.employeeId,
      req.body.tasks
    );
    if (!result.success) return res.status(400).json(result);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
