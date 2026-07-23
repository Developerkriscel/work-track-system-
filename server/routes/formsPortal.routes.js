import express from 'express';
import {
  addForm,
  deleteForm,
  getFormsAssignableUsers,
  getFormsForEmployee,
  saveForm
} from '../services/formsPortal.service.js';

const router = express.Router();

router.post('/list', async (req, res) => {
  try {
    res.json(await getFormsForEmployee(req.auth.sub));
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/assignable-users', async (req, res) => {
  try {
    const result = await getFormsAssignableUsers(req.auth.sub);
    if (!result.success) return res.status(403).json(result);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/save', async (req, res) => {
  try {
    const result = await saveForm(req.body.formData, req.auth.sub);
    if (!result.success) return res.status(403).json(result);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/add', async (req, res) => {
  try {
    const result = await addForm(req.body.formData, req.auth.sub);
    if (!result.success) return res.status(403).json(result);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/delete', async (req, res) => {
  try {
    const result = await deleteForm(req.body.sheetName, req.auth.sub);
    if (!result.success) return res.status(403).json(result);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
