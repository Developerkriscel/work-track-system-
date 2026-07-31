import express from 'express';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getR2Client, getStoredFileKey, hasCloudflareR2Config } from '../services/fileStorage.service.js';

const router = express.Router();

function streamBodyToResponse(body, res) {
  if (!body) {
    res.status(404).json({ success: false, message: 'File not found.' });
    return;
  }

  if (typeof body.pipe === 'function') {
    body.on('error', (error) => {
      if (!res.headersSent) {
        res.status(500).json({ success: false, message: `Could not stream file: ${error.message}` });
      } else {
        res.destroy(error);
      }
    });
    body.pipe(res);
    return;
  }

  if (typeof body.transformToByteArray === 'function') {
    body.transformToByteArray()
      .then((bytes) => res.end(Buffer.from(bytes)))
      .catch((error) => {
        if (!res.headersSent) {
          res.status(500).json({ success: false, message: `Could not stream file: ${error.message}` });
        } else {
          res.destroy(error);
        }
      });
    return;
  }

  res.status(500).json({ success: false, message: 'Unsupported file stream.' });
}

router.get('/preview', async (req, res) => {
  if (!hasCloudflareR2Config()) {
    res.status(503).json({ success: false, message: 'Cloudflare R2 is not configured.' });
    return;
  }

  const source = String(req.query.url || req.query.key || '').trim();
  const fileKey = getStoredFileKey(source);

  if (!fileKey) {
    res.status(400).json({ success: false, message: 'Missing file reference.' });
    return;
  }

  try {
    const result = await getR2Client().send(new GetObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: fileKey
    }));

    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', result.ContentType || 'application/octet-stream');
    if (result.ContentLength !== undefined) {
      res.setHeader('Content-Length', String(result.ContentLength));
    }
    res.setHeader('Content-Disposition', 'inline');

    streamBodyToResponse(result.Body, res);
  } catch (error) {
    const status = error?.$metadata?.httpStatusCode || 500;
    const notFound = status === 404 || error?.name === 'NoSuchKey';
    res.status(notFound ? 404 : status).json({
      success: false,
      message: notFound ? 'File not found.' : `Could not open file: ${error.message}`
    });
  }
});

export default router;
