import express from 'express';
import { analyzeCandidateWithAi } from '../services/candidateAi.service.js';

const router = express.Router();

router.post('/analyze', async (req, res) => {
  try {
    const result = await analyzeCandidateWithAi(req.body || {});
    if (!result.success) return res.status(result.setupRequired ? 503 : 400).json(result);
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Candidate AI analysis failed.' });
  }
});

export default router;
