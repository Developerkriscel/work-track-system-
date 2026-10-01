import express from 'express';
import { listHolidays, removeHoliday, saveHoliday } from '../services/holiday.service.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = express.Router();
const holidayAdmin = requireAuth({ kind: 'employee', roles: ['Admin', 'Company Admin', 'Super Admin'] });
router.get('/holidays', async (req, res) => {
  try {
    res.json(await listHolidays({ startDate: req.query.startDate, endDate: req.query.endDate }));
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/holidays', holidayAdmin, async (req, res) => {
  try {
    const result = await saveHoliday(req.body?.payload || req.body || {}, req.auth);
    if (!result.success) return res.status(400).json(result);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/holidays/:id', holidayAdmin, async (req, res) => {
  try {
    const result = await removeHoliday(req.params.id);
    if (!result.success) return res.status(404).json(result);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;

