import express from 'express';
import { getMyApprovalStatus } from '../services/myApprovalStatus.service.js';

const router = express.Router();

router.post('/list', async (req, res) => {
  try {
    const result = await getMyApprovalStatus(req.auth.sub);
    if (!result.success) {
      return res.status(400).json(result);
    }
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
