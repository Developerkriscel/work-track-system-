import crypto from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { WhatsAppIntegration } from '../models/whatsappIntegration.model.js';

const text = (value) => String(value ?? '').trim();
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
export async function assertPublicProvider(apiBaseUrl) {
  const host = new URL(apiBaseUrl).hostname;
  if (host === 'app.aknexus.in') return;
  let addresses;
  try { addresses = await lookup(host, { all: true }); } catch { fail('Provider domain could not be resolved. Check the API URL.'); }
  if (!addresses.length || addresses.some(({ address, family }) => {
    if (family === 6) return !/^[23]/i.test(address) || /^2001:db8:/i.test(address);
    const [a, b] = address.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && [0, 168].includes(b)) || (a === 100 && b >= 64 && b <= 127) || (a === 198 && [18, 19].includes(b));
  })) fail('Provider API must resolve to a public internet address.');
}
function key() {
  const value = process.env.WHATSAPP_CONFIG_ENCRYPTION_KEY;
  if (!/^[a-f0-9]{64}$/i.test(value || '')) fail('WhatsApp settings encryption key is not configured on the server.', 503);
  return Buffer.from(value, 'hex');
}
export function encryptToken(token) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString('base64')).join('.');
}
export function decryptToken(value) {
  const [iv, tag, encrypted] = value.split('.').map((part) => Buffer.from(part, 'base64'));
  const decipher = crypto.createDecipheriv('aes-256-gcm', key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}
export function environmentIntegration() {
  return { provider: 'aknexus', providerName: 'AKNexus', apiBaseUrl: text(process.env.AKNEXUS_API_BASE_URL) || 'https://app.aknexus.in/api', instanceId: text(process.env.AKNEXUS_INSTANCE_ID), accessToken: text(process.env.AKNEXUS_ACCESS_TOKEN || process.env.AKNEXUS_API_TOKEN), senderNumber: '', revision: 0, source: 'environment' };
}
export async function effectiveIntegration() {
  const saved = await WhatsAppIntegration.findById('active').lean();
  return saved ? { ...saved, accessToken: decryptToken(saved.encryptedToken), source: 'database' } : environmentIntegration();
}
export function publicIntegration(config) {
  return { provider: config.provider, providerName: config.providerName, apiBaseUrl: config.apiBaseUrl, instanceId: config.instanceId, senderNumber: config.senderNumber || '', revision: config.revision, source: config.source, hasToken: Boolean(config.accessToken), configured: Boolean(config.accessToken && config.instanceId), updatedAt: config.updatedAt };
}
export function normalizeIntegration(input, current) {
  const provider = text(input.provider);
  if (!['aknexus', 'compatible'].includes(provider)) fail('Choose a supported provider API format.');
  let url;
  try { url = new URL(text(input.apiBaseUrl)); } catch { fail('Enter a valid HTTPS API base URL.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || (url.port && url.port !== '443')) fail('Use an HTTPS API base URL without credentials, query parameters or custom ports.');
  if (!/^[a-z0-9.-]+$/i.test(url.hostname) || !url.hostname.includes('.') || /(^|\.)(localhost|local|internal|test|invalid)$/i.test(url.hostname) || /^[\d.]+$/.test(url.hostname)) fail('Use a public provider domain.');
  const apiBaseUrl = url.href.replace(/\/+$/, '');
  if (/\/send\/*$/i.test(url.pathname)) fail('Enter the base URL, without the /send endpoint.');
  const instanceId = text(input.instanceId);
  if (!/^[a-z0-9_-]{1,128}$/i.test(instanceId)) fail('Enter a valid provider instance ID.');
  const providerName = provider === 'aknexus' ? 'AKNexus' : text(input.providerName);
  if (!providerName || providerName.length > 80) fail('Enter a provider name up to 80 characters.');
  let senderNumber = text(input.senderNumber);
  if (senderNumber && !/^\+[1-9]\d{7,14}$/.test(senderNumber)) fail('Enter sender number with country code, for example +919876543210.');
  const changedProvider = provider !== current.provider || apiBaseUrl !== current.apiBaseUrl.replace(/\/+$/, '');
  const accessToken = text(input.accessToken) || (!changedProvider ? current.accessToken : '');
  if (!accessToken || accessToken.length > 4096 || /\s/.test(accessToken)) fail(changedProvider ? 'Enter the new provider token when changing provider or API URL.' : 'Enter a valid API token.');
  return { provider, providerName, apiBaseUrl, instanceId, senderNumber, accessToken };
}
export async function saveIntegration(input, auth, { validateHost = assertPublicProvider } = {}) {
  if (!/^super admin$/i.test(auth?.role || '')) fail('Only Super Admin can change the WhatsApp provider.', 403);
  const current = await effectiveIntegration();
  if (!Number.isInteger(input.revision) || input.revision !== current.revision) fail('Settings changed. Reload before saving.', 409);
  const { accessToken, ...next } = normalizeIntegration(input, current);
  await validateHost(next.apiBaseUrl);
  try {
    const saved = await WhatsAppIntegration.findOneAndUpdate({ _id: 'active', revision: current.revision }, { $set: { ...next, encryptedToken: encryptToken(accessToken), updatedBy: auth.sub }, $inc: { revision: 1 } }, { upsert: current.revision === 0, new: true, runValidators: true }).lean();
    if (!saved) fail('Settings changed. Reload before saving.', 409);
    return { success: true, settings: publicIntegration({ ...saved, accessToken, source: 'database' }) };
  } catch (error) {
    if (error.code === 11000) fail('Settings changed. Reload before saving.', 409);
    throw error;
  }
}
