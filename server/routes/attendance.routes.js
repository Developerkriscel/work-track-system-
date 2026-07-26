import express from 'express';
import {
  checkUserAttendanceActive,
  enforceAttendanceGate,
  getAttendanceForUser,
  recordAttendance,
  getTeamAttendanceForReviewer,
  submitIntimation,
  submitLeaveRequest,
  updateTeamAttendanceEntry
} from '../services/attendance.service.js';

const router = express.Router();

router.post('/list', async (req, res) => {
  try {
    res.json(await getAttendanceForUser(req.auth.sub, req.body.startDate, req.body.endDate));
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/record', async (req, res) => {
  try {
    res.json(await recordAttendance({ ...(req.body.payload || {}), 'Employee ID': req.auth.sub, EmpID: req.auth.sub }));
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/team/list', async (req, res) => {
  try {
    const result = await getTeamAttendanceForReviewer(req.auth.sub, req.body.startDate, req.body.endDate);
    if (!result.success) return res.status(403).json(result);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/team/update', async (req, res) => {
  try {
    const result = await updateTeamAttendanceEntry(req.auth.sub, req.body.payload || {});
    if (!result.success && /only admin|you cannot edit|not found/i.test(result.message || '')) {
      return res.status(403).json(result);
    }
    if (!result.success) return res.status(400).json(result);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/leave', async (req, res) => {
  try {
    res.json(await submitLeaveRequest({ ...(req.body.payload || {}), 'Employee ID': req.auth.sub, EmpID: req.auth.sub }));
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/intimation', async (req, res) => {
  try {
    res.json(await submitIntimation({ ...(req.body.payload || {}), 'Employee ID': req.auth.sub, EmpID: req.auth.sub }));
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/active-status', async (req, res) => {
  try {
    res.json(await checkUserAttendanceActive(req.auth.sub));
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/gate', async (req, res) => {
  try {
    const result = await enforceAttendanceGate(req.auth.sub);
    if (!result.success) return res.status(403).json(result);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
