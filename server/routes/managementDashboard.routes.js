import express from 'express';
import { createManagementBatch, getManagementDashboardData } from '../services/managementDashboard.service.js';

const router = express.Router();

router.post('/data', async (req, res) => {
  try {
    const result = await getManagementDashboardData(req.body.startDate, req.body.endDate);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

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
