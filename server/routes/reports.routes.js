import express from 'express';
import { exportReportForWeb, getFmsReportData, getTicketReportData } from '../services/reports.service.js';

const router = express.Router();

router.post('/tickets', async (req, res) => {
  try {
    res.json(await getTicketReportData(req.auth.sub, req.auth.role, req.body.startDate, req.body.endDate));
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/fms', async (req, res) => {
  try {
    res.json(await getFmsReportData(req.auth.sub, req.auth.role, req.body.startDate, req.body.endDate));
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/export', async (req, res) => {
  try {
    res.json(await exportReportForWeb(
      req.body.format,
      req.body.sheetName,
      req.auth.sub,
      req.auth.role,
      req.body.startDate,
      req.body.endDate
    ));
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
