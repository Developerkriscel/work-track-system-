import express from 'express';
import { getExpenseApprovalQueue, getExpensesForUser, processExpenseApprovalFromMongo, recordExpense } from '../services/expenses.service.js';

const router = express.Router();

router.post('/list', async (req, res) => {
  try {
    res.json(await getExpensesForUser(req.auth.sub));
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/queue', async (req, res) => {
  try {
    const result = await getExpenseApprovalQueue(req.auth.sub);
    if (!result.success) return res.status(400).json(result);
    res.json(result);
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

router.post('/approve', async (req, res) => {
  try {
    const result = await processExpenseApprovalFromMongo(
      req.body.expenseId || req.body.ExpenseID || req.body['Expense ID'],
      req.body.status || req.body.Status || 'Approved',
      req.body.remarks || req.body.Remarks || '',
      req.auth.sub
    );
    if (!result.success) return res.status(400).json(result);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
