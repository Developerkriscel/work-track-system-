import express from 'express';
import { getDashboardData } from '../services/dashboard.service.js';

const router = express.Router();

router.post('/data', async (req, res) => {
  try {
    res.json(await getDashboardData(req.auth.sub, req.body.filterRange));
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
