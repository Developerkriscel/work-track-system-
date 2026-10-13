import express from 'express';
import {
  getAssetsOverview,
  createAsset,
  updateAsset,
  assignAsset,
  returnAsset,
  submitAssetRequest,
  processAssetRequestApproval
} from '../services/assets.service.js';

const router = express.Router();

router.post('/overview', async (req, res) => {
  try {
    const result = await getAssetsOverview(req.auth);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/create', async (req, res) => {
  try {
    const result = await createAsset(req.body, req.auth);
    if (!result.success) return res.status(400).json(result);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/update', async (req, res) => {
  try {
    const assetId = req.body.assetId || req.body.AssetID || req.body['Asset ID'];
    const result = await updateAsset(assetId, req.body, req.auth);
    if (!result.success) return res.status(400).json(result);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/assign', async (req, res) => {
  try {
    const result = await assignAsset(req.body, req.auth);
    if (!result.success) return res.status(400).json(result);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/return', async (req, res) => {
  try {
    const result = await returnAsset(req.body, req.auth);
    if (!result.success) return res.status(400).json(result);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/request', async (req, res) => {
  try {
    const result = await submitAssetRequest(req.body, req.auth);
    if (!result.success) return res.status(400).json(result);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/approve', async (req, res) => {
  try {
    const requestId = req.body.requestId || req.body.RequestID || req.body['Request ID'];
    const action = req.body.action || 'Approved';
    const remarks = req.body.remarks || '';
    const result = await processAssetRequestApproval(requestId, action, remarks, req.auth);
    if (!result.success) return res.status(400).json(result);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
