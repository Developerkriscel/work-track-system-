import express from 'express';
import { getExpensesForUser, recordExpense } from '../services/expenses.service.js';

const router = express.Router();

router.post('/list', async (req, res) => {
  try {
    res.json(await getExpensesForUser(req.auth.sub));
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/record', async (req, res) => {
  try {
    const result = await recordExpense({ ...(req.body.payload || {}), 'Employee ID': req.auth.sub, EmpID: req.auth.sub });
    if (!result.success) return res.status(400).json(result);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
