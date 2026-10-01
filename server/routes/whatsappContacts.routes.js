import express from 'express';
import { getWhatsAppWorkspace, saveWhatsAppContact } from '../services/whatsappContacts.service.js';
import { getAknexusStatus, sendWhatsAppTest } from '../services/aknexusWhatsApp.service.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { effectiveIntegration, publicIntegration, saveIntegration } from '../services/whatsappIntegration.service.js';

const router = express.Router();
router.get('/workspace', async (req, res) => {
  try {
    const includeLogs = !/^(0|false|no)$/i.test(String(req.query.includeLogs ?? 'true'));
    const logLimit = Number(req.query.historyLimit || req.query.logLimit || 300);
    res.json(await getWhatsAppWorkspace(req.auth, { includeLogs, logLimit }));
  }
  catch (error) { res.status(error.status || 500).json({ success: false, message: error.status ? error.message : 'Could not load WhatsApp contacts and history. Please try again.' }); }
});
router.get('/status', async (req, res) => {
  try { res.json({ success: true, ...await getAknexusStatus() }); }
  catch (error) { res.status(500).json({ success: false, message: 'Could not read WhatsApp connection status.' }); }
});
router.post('/contacts', async (req, res) => {
  try { res.json(await saveWhatsAppContact(req.body || {}, req.auth)); }
  catch (error) { res.status(error.status || 500).json({ success: false, message: error.status ? error.message : 'Could not save the contact. Please try again.' }); }
});
router.post('/test-message', async (req, res) => {
  try { res.json(await sendWhatsAppTest(req.body?.contactId, req.auth, { message: req.body?.message, pdfAttachment: req.body?.pdfAttachment })); }
  catch (error) { res.status(error.status || 500).json({ success: false, message: error.status ? error.message : 'Could not send WhatsApp test message.' }); }
});
const integrationAdmin = requireAuth({ kind: 'employee', roles: ['Super Admin'] });
router.get('/integration', integrationAdmin, async (_req, res) => {
  try { res.json({ success: true, settings: publicIntegration(await effectiveIntegration()) }); }
  catch { res.status(500).json({ success: false, message: 'Could not load provider settings.' }); }
});
router.put('/integration', integrationAdmin, async (req, res) => {
  try { res.json(await saveIntegration(req.body || {}, req.auth)); }
  catch (error) { res.status(error.status || 500).json({ success: false, message: error.status ? error.message : 'Could not save provider settings. Existing settings are unchanged.' }); }
});
export default router;
