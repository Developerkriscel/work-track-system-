import express from 'express';
import {
  getAllManagersList,
  getAllUsersForAdmin,
  getEmpMasterData,
  getNextEmpCode,
  saveEmpMasterData,
  saveOrUpdateUser
} from '../services/admin.service.js';

const router = express.Router();

router.post('/users', async (req, res) => {
  try {
    res.json(await getAllUsersForAdmin(req.auth.sub));
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/managers', async (_req, res) => {
  try {
    res.json(await getAllManagersList());
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/emp-master', async (req, res) => {
  try {
    res.json(await getEmpMasterData(req.body.category || 'Master'));
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/next-code', async (req, res) => {
  try {
    res.json(await getNextEmpCode(req.body.category || 'Master'));
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/save-user', async (req, res) => {
  try {
    const result = await saveOrUpdateUser(req.body.userData || {}, req.auth.sub);
    if (!result.success) return res.status(400).json(result);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/save-emp-master', async (req, res) => {
  try {
    const result = await saveEmpMasterData(req.body.category, req.body.formData || {}, req.auth.sub);
    if (!result.success) return res.status(400).json(result);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
