import { WhatsAppContact } from '../models/whatsappContact.model.js';
import { WhatsAppOutboundLog } from '../models/whatsappOutboundLog.model.js';
import { normalizeWhatsAppPhone, directory, clientDirectory } from './whatsappContacts.service.js';
import { effectiveIntegration, assertPublicProvider } from './whatsappIntegration.service.js';
import { getPresignedFileUrl, saveBase64File } from './fileStorage.service.js';

const text = (value) => String(value ?? '').trim();
const reject = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const PDF_MAX_BYTES = Number(process.env.WHATSAPP_PDF_MAX_BYTES || 8 * 1024 * 1024);

export async function getAknexusStatus() {
  const config = await effectiveIntegration();
  const hasAccessToken = Boolean(config.accessToken);
  const hasInstanceId = Boolean(config.instanceId);
  return {
    connected: hasAccessToken && hasInstanceId,
    provider: config.providerName,
    hasAccessToken,
    hasInstanceId,
    instanceId: config.instanceId
  };
}

function providerNumber(value) {
  const normalized = normalizeWhatsAppPhone(value);
  return normalized ? normalized.replace(/\D/g, '') : '';
}

function providerStatus(payload = {}) {
  return text(payload.status || payload.Status || payload.success || payload.message || '');
}

function base64Bytes(value = '') {
  const clean = text(value).replace(/^data:[^;]+;base64,/, '');
  return Math.floor((clean.length * 3) / 4);
}

function normalizePdfAttachment(input = null) {
  if (!input) return null;
  const base64 = text(input.base64 || input.data || input.content);
  const fileName = text(input.fileName || input.name || 'whatsapp-document.pdf');
  const contentType = text(input.contentType || input.mimeType || input.type || 'application/pdf').toLowerCase();
  if (!base64) reject('PDF file is missing.');
  if (contentType !== 'application/pdf' && !fileName.toLowerCase().endsWith('.pdf')) reject('Only PDF files can be sent from WhatsApp Center.');
  if (base64Bytes(base64) > PDF_MAX_BYTES) reject(`PDF must be ${Math.floor(PDF_MAX_BYTES / (1024 * 1024))} MB or smaller.`);
  return { base64, fileName: fileName.toLowerCase().endsWith('.pdf') ? fileName : `${fileName}.pdf`, contentType: 'application/pdf' };
}

async function writeLog({ contact, message, attachment, alertType, entityId, status, providerResponse, error, auth, config }) {
  const provider = providerResponse && typeof providerResponse === 'object' ? providerResponse : {};
  const record = await WhatsAppOutboundLog.create({
    contactId: contact?._id || contact?.id || undefined,
    employeeId: text(contact?.employeeId),
    clientId: text(contact?.clientId),
    name: text(contact?.name) || 'WhatsApp recipient',
    phone: text(contact?.phone),
    alertType: text(alertType) || 'manual',
    entityId: text(entityId),
    message,
    attachmentType: text(attachment?.contentType),
    attachmentName: text(attachment?.fileName),
    attachmentUrl: text(attachment?.url),
    provider: config.providerName,
    status,
    providerStatus: providerStatus(provider),
    providerMessage: text(provider.message || provider.Message),
    providerResponse: providerResponse || null,
    error: text(error),
    createdBy: text(auth?.sub || auth?.id),
    sentAt: new Date()
  });
  return record.toObject();
}

export async function sendWhatsAppText({ contactId, phone, name, clientId, message, pdfAttachment = null, alertType = 'manual', entityId = '', auth } = {}) {
  let content = text(message);
  const normalizedPdf = normalizePdfAttachment(pdfAttachment);
  if (normalizedPdf && !content) content = `Document: ${normalizedPdf.fileName}`;
  if (!content || content.length > 4000) reject('Enter a WhatsApp message up to 4000 characters.');
  const config = await effectiveIntegration();
  if (!config.accessToken || !config.instanceId) reject('Provider access token and instance ID are required before sending WhatsApp messages.', 503);

  let contact = null;
  if (contactId) {
    if (!/^[a-f\d]{24}$/i.test(String(contactId))) reject('Invalid WhatsApp contact.');
    contact = await WhatsAppContact.findById(contactId).lean();
    if (!contact) reject('WhatsApp contact not found.', 404);
    if (auth && contact.clientId) {
      const clients = await clientDirectory(auth);
      const client = clients.find((row) => row.id === contact.clientId);
      if (!client) reject('You cannot send messages to this client.', 403);
      if (/^(inactive|disabled|terminated|deleted)$/i.test(client.status)) reject('Alerts cannot be sent to an inactive client.');
    }
    if (auth && contact.employeeId) {
      const employees = await directory(auth);
      const employee = employees.find((item) => item.id === contact.employeeId);
      if (!employee) reject('You cannot send messages to this contact.', 403);
      if (employee.status.toLowerCase() === 'inactive') reject('Alerts cannot be sent to an inactive employee.');
    }
    if (!contact.enabled) reject('WhatsApp alerts are disabled for this contact.');
    if (alertType !== 'manual' && !contact.alertTypes?.includes(alertType)) reject('This alert category is disabled for this contact.');
  } else {
    const normalized = normalizeWhatsAppPhone(phone);
    if (!normalized) reject('Enter a valid WhatsApp number with country code.');
    contact = { name: text(name) || normalized, phone: normalized, employeeId: '', clientId: text(clientId) };
  }

  const number = providerNumber(contact.phone);
  if (!number) reject('Saved WhatsApp number is invalid.');

  const attachment = normalizedPdf
    ? (() => {
      const url = null;
      return { ...normalizedPdf, url };
    })()
    : null;
  if (attachment) {
    attachment.url = await saveBase64File(normalizedPdf, 'whatsapp_documents');
    attachment.sendUrl = getPresignedFileUrl(attachment.url, Number(process.env.WHATSAPP_PDF_SIGNED_URL_SECONDS || 600));
  }
  const body = {
    number,
    type: attachment ? 'document' : 'text',
    message: content,
    instance_id: config.instanceId,
    access_token: config.accessToken
  };
  if (attachment) {
    body.caption = content;
    body.media_url = attachment.sendUrl || attachment.url;
    body.url = attachment.sendUrl || attachment.url;
    body.file_url = attachment.sendUrl || attachment.url;
    body.filename = attachment.fileName;
    body.fileName = attachment.fileName;
    body.mimetype = attachment.contentType;
  }

  let payload = null;
  let sent = false;
  let failure = '';
  try {
    await assertPublicProvider(config.apiBaseUrl);
    const response = await fetch(`${config.apiBaseUrl.replace(/\/+$/, '')}/send`, {
      method: 'POST',
      redirect: 'error',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(Number(process.env.AKNEXUS_TIMEOUT_MS || 20000))
    });
    payload = await response.json();
    sent = response.ok && payload?.success !== false && payload?.sent !== false && !/fail|error|invalid/i.test(text(payload?.status))
      && (text(payload?.status).toLowerCase() === 'success' || payload?.success === true || payload?.sent === true);
    if (!sent) failure = text(payload?.message) || `${config.providerName} did not confirm acceptance of the message.`;
  } catch (error) {
    failure = error.name === 'TimeoutError' ? 'Provider timed out. Delivery is unconfirmed; check WhatsApp before retrying.' : 'Could not confirm the WhatsApp send result. Check WhatsApp before retrying.';
  }
  // Persist once, outside the provider catch: a database error must not trigger a second send/log.
  const redact = (value) => String(value || '').split(config.accessToken).join('[redacted]');
  failure = redact(failure);
  // Provider responses are untrusted and can echo request credentials.
  payload = payload ? { status: redact(payload.status), message: redact(payload.message) } : null;
  const log = await writeLog({ contact, message: content, attachment, alertType, entityId, status: sent ? 'sent' : 'failed', providerResponse: payload, error: failure, auth, config });
  if (!sent) reject(failure, 502);
  return { success: true, message: `WhatsApp ${attachment ? 'PDF' : 'message'} accepted by ${config.providerName}.`, log };
}

export async function sendWhatsAppTest(contactId, auth, options = {}) {
  if (!contactId || !/^[a-f\d]{24}$/i.test(String(contactId))) reject('Select a saved WhatsApp contact.');
  const now = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });
  return sendWhatsAppText({
    contactId,
    alertType: 'manual',
    entityId: 'TEST',
    message: text(options.message) || `WhatsApp test from WorkTrack. Time: ${now}`,
    pdfAttachment: options.pdfAttachment,
    auth
  });
}
