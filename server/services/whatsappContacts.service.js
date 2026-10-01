import { WhatsAppContact, WHATSAPP_ALERT_TYPES } from '../models/whatsappContact.model.js';
import { WhatsAppOutboundLog } from '../models/whatsappOutboundLog.model.js';
import { LegacyModels } from '../models/legacyModels.js';
import { effectiveIntegration, publicIntegration } from './whatsappIntegration.service.js';

export const ALERT_TYPES = WHATSAPP_ALERT_TYPES;
const text = (value) => typeof value === 'string' ? value.trim() : '';
const first = (row, keys) => keys.map((key) => row?.[key]).find((value) => value !== undefined && value !== null && String(value).trim()) ?? '';
const reject = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };

export function normalizeWhatsAppPhone(value) {
  const raw = text(value);
  if (!raw || !/^\+?[\d\s().-]+$/.test(raw)) return '';
  let digits = raw.replace(/\D/g, '');
  if (digits.length === 10 && !raw.startsWith('+')) digits = `91${digits}`;
  return /^[1-9]\d{7,14}$/.test(digits) ? `+${digits}` : '';
}

export function normalizeContact(payload = {}, employees = [], clients = []) {
  const employeeId = text(payload.employeeId);
  const clientId = text(payload.clientId);
  if (employeeId && clientId) reject('Choose either an employee or a client.');
  const client = clientId ? clients.find((item) => item.id === clientId) : null;
  if (clientId && !client) reject('Select a client you have access to.');
  const employee = employeeId ? employees.find((item) => item.id === employeeId) : null;
  if (employeeId && !employee) reject('Select an employee you have access to.');
  const name = employee?.name || client?.name || text(payload.name);
  if (!name || name.length > 120) reject('Enter a contact name (up to 120 characters).');
  const phone = normalizeWhatsAppPhone(payload.phone);
  if (!phone) reject('Enter a valid WhatsApp number with country code, for example +91 98765 43210.');
  const department = employee?.department || client?.department || text(payload.department);
  if (department.length > 120 || text(payload.notes).length > 500) reject('Department or notes are too long.');
  if (typeof payload.enabled !== 'boolean') reject('Choose whether alerts are enabled.');
  if (!Array.isArray(payload.alertTypes) || payload.alertTypes.some((type) => !ALERT_TYPES.includes(type))) reject('Choose valid alert categories.');
  if (payload.enabled && !payload.alertTypes.length) reject('Select at least one alert category, or pause alerts.');
  if (payload.enabled && employee && employee.status.toLowerCase() === 'inactive') reject('Alerts cannot be enabled for an inactive employee.');
  if (payload.enabled && client && /^(inactive|disabled|terminated|deleted)$/i.test(client.status)) reject('Alerts cannot be enabled for an inactive client.');
  if (clientId && payload.alertTypes.some((type) => type !== 'ticket')) reject('Clients support ticket and ticket-chat alerts only.');
  return { employeeId, clientId, name, phone, department, enabled: payload.enabled, alertTypes: [...new Set(payload.alertTypes)], notes: text(payload.notes) };
}

export async function clientDirectory(auth) {
  if (!/^(admin|super admin)$/i.test(text(auth.role))) return [];
  const fields = ['Client_Id', 'Client ID', 'CustomerID', 'clientId', 'customerId', 'Client Name', 'ClientName', 'Name', 'WhatsApp Number', 'Whatsapp Number', 'WhatsApp', 'Mobile Number', 'Contact', 'Mobile', 'Phone', 'phone', 'mobile', 'Status', 'status'];
  const docs = await LegacyModels.Client.collection.find({}, { projection: Object.fromEntries(fields.map((key) => [`data.${key}`, 1])) }).toArray();
  return docs.map(({ data: row }) => ({
    id: String(first(row, ['Client_Id', 'Client ID', 'CustomerID', 'clientId', 'customerId'])),
    name: String(first(row, ['Client Name', 'ClientName', 'Name'])), department: 'Client',
    phone: String(first(row, ['WhatsApp Number', 'Whatsapp Number', 'WhatsApp', 'Mobile Number', 'Contact', 'Mobile', 'Phone', 'phone', 'mobile'])),
    status: String(first(row, ['Status', 'status']) || 'Active')
  })).filter((row) => row.id).sort((a, b) => a.name.localeCompare(b.name));
}

export async function directory(auth) {
  const fields = ['Employee ID', 'User ID', 'EMP Code', 'employeeId', 'Employee Name', 'Name', 'name', 'Department', 'department', 'Mobile Number', 'Mobile', 'Phone No', 'phone', 'mobile', 'Status', 'status', 'Role', 'role', 'Designation'];
  const docs = await LegacyModels.User.collection.find({}, { projection: Object.fromEntries(fields.map((key) => [`data.${key}`, 1])) }).toArray();
  const actorRole = text(auth.role).toLowerCase();
  return docs.map(({ data: row }) => ({
    id: String(first(row, ['Employee ID', 'User ID', 'EMP Code', 'employeeId'])),
    name: String(first(row, ['Employee Name', 'Name', 'name'])),
    department: String(first(row, ['Department', 'department'])),
    phone: String(first(row, ['Mobile Number', 'Mobile', 'Phone No', 'phone', 'mobile'])),
    status: String(first(row, ['Status', 'status']) || 'Active'),
    role: String(first(row, ['Role', 'role', 'Designation']) || 'User')
  }))
    .filter((item) => item.id && item.name)
    .filter((item) => !/^(tmp_|test_|verify_|debug_)/i.test(item.id) && !/^tmp\b|verification|debug admin emp/i.test(item.name))
    .filter((item) => actorRole === 'super admin'
      || (actorRole === 'admin' && !/^super admin$/i.test(item.role))
      || ((actorRole === 'hr' || actorRole === 'hr admin') && !/^(super admin|admin)$/i.test(item.role)))
    .sort((left, right) => left.name.localeCompare(right.name));
}

function contactView(row = {}) {
  return {
    id: String(row._id || row.id || ''),
    employeeId: text(row.employeeId),
    clientId: text(row.clientId),
    name: text(row.name),
    phone: text(row.phone),
    department: text(row.department),
    enabled: Boolean(row.enabled),
    alertTypes: Array.isArray(row.alertTypes) ? row.alertTypes.filter((type) => ALERT_TYPES.includes(type)) : [],
    notes: text(row.notes),
    updatedAt: row.updatedAt
  };
}

function logView(doc) {
  const row = doc?.data || {};
  return {
    id: String(doc?._id || ''),
    employeeId: String(first(row, ['Employee ID', 'employeeId', 'User ID'])),
    name: String(first(row, ['Employee Name', 'Recipient Name', 'Name'])),
    phone: String(first(row, ['Number', 'Mobile Number', 'Mobile', 'Phone', 'Phone No', 'number', 'phone'])),
    message: String(first(row, ['Message', 'message'])),
    status: String(first(row, ['Status', 'status']) || 'Unknown'),
    alertType: String(first(row, ['Alert Type', 'Type', 'eventType']) || 'Legacy alert'),
    entityId: String(first(row, ['Ticket ID', 'Task ID', 'entityId'])),
    timestamp: String(first(row, ['Timestamp', 'Date', 'timestamp']) || doc?.createdAt?.toISOString() || ''),
    error: String(first(row, ['Error', 'Error Message', 'error'])),
    source: 'Legacy import'
  };
}

function outboundLogView(row = {}) {
  return {
    id: String(row._id || ''),
    clientId: text(row.clientId),
    employeeId: text(row.employeeId),
    name: text(row.name),
    phone: text(row.phone),
    message: text(row.message),
    attachmentName: text(row.attachmentName),
    attachmentUrl: text(row.attachmentUrl),
    status: row.status === 'failed' ? 'Failed' : row.status === 'skipped' ? 'Skipped' : 'Sent',
    alertType: text(row.alertType) || 'manual',
    entityId: text(row.entityId),
    timestamp: row.sentAt?.toISOString?.() || row.createdAt?.toISOString?.() || '',
    error: row.status === 'failed' ? text(row.error || row.providerMessage) : '',
    source: text(row.provider) || 'AKNexus'
  };
}

export async function getWhatsAppWorkspace(auth, options = {}) {
  const includeLogs = options.includeLogs !== false;
  const logLimit = Math.min(1000, Math.max(0, Number(options.logLimit) || 300));
  const integration = publicIntegration(await effectiveIntegration());
  const [employees, clients] = await Promise.all([directory(auth), clientDirectory(auth)]);
  const ids = employees.map((item) => item.id);
  await WhatsAppContact.init();
  const contacts = await WhatsAppContact
    .find({ $and: [{ $or: [{ employeeId: '' }, { employeeId: { $in: ids } }] }, { $or: [{ clientId: { $exists: false } }, { clientId: '' }, { clientId: { $in: clients.map((c) => c.id) } }] }] })
    .sort({ name: 1 })
    .lean();
  const safeContacts = contacts.map(contactView);

  if (!includeLogs || !logLimit) {
    return { success: true, employees, clients, contacts: safeContacts, logs: [], logLimit: 0, providerName: integration.providerName, automaticAlertsEnabled: process.env.WHATSAPP_AUTOMATIC_ALERTS !== 'false', sendingEnabled: integration.configured };
  }

  const allowedPhones = new Set([...employees.map((e) => normalizeWhatsAppPhone(e.phone)), ...contacts.map((c) => c.phone)].filter(Boolean));
  // Historical imports only. No inferred delivery/read states and no outbound API calls.
  const [rawLogs, outboundLogs] = await Promise.all([
    LegacyModels.WhatsAppLog
    .find({})
    .sort({ createdAt: -1 })
    .limit(logLimit)
    .select({ data: 1, createdAt: 1 })
    .lean()
    .catch((error) => {
      console.warn(`WhatsApp legacy history skipped: ${error.message}`);
      return [];
    }),
    WhatsAppOutboundLog
    .find({ $and: [{ $or: [{ employeeId: '' }, { employeeId: { $in: ids } }, { phone: { $in: [...allowedPhones] } }] }, { $or: [{ clientId: { $exists: false } }, { clientId: '' }, { clientId: { $in: clients.map((c) => c.id) } }] }] })
    .sort({ sentAt: -1, createdAt: -1 })
    .limit(logLimit)
    .lean()
  ]);
  const legacyLogs = rawLogs
    .map(logView)
    .filter((log) => log.employeeId ? ids.includes(log.employeeId) : allowedPhones.has(normalizeWhatsAppPhone(log.phone)));

  const logs = [...outboundLogs.map(outboundLogView), ...legacyLogs]
    .sort((a, b) => (Date.parse(b.timestamp) || 0) - (Date.parse(a.timestamp) || 0))
    .slice(0, logLimit);
  return { success: true, employees, clients, contacts: safeContacts, logs, logLimit, providerName: integration.providerName, automaticAlertsEnabled: process.env.WHATSAPP_AUTOMATIC_ALERTS !== 'false', sendingEnabled: integration.configured };
}

export async function saveWhatsAppContact(payload, auth) {
  const [employees, clients] = await Promise.all([directory(auth), clientDirectory(auth)]);
  const input = normalizeContact(payload, employees, clients);
  const id = text(payload.id);
  if (id && !/^[a-f\d]{24}$/i.test(id)) reject('Invalid contact.');
  if (id) {
    const existing = await WhatsAppContact.findById(id).lean();
    if (!existing) reject('Contact not found.', 404);
    if (existing.employeeId && !employees.some((e) => e.id === existing.employeeId)) reject('You cannot edit this contact.', 403);
    if (existing.clientId && !clients.some((c) => c.id === existing.clientId)) reject('You cannot edit this client contact.', 403);
  }
  try {
    // Wait for the unique indexes before accepting contact writes.
    await WhatsAppContact.init();
    const record = id
      ? await WhatsAppContact.findByIdAndUpdate(id, { $set: { ...input, updatedBy: auth.sub } }, { new: true, runValidators: true }).lean()
      : (await WhatsAppContact.create({ ...input, updatedBy: auth.sub })).toObject();
    if (!record) reject('Contact not found.', 404);
    return { success: true, contact: contactView(record) };
  } catch (error) {
    if (error.code === 11000) reject('This WhatsApp number, employee or client already has a saved contact. Edit the existing contact.');
    throw error;
  }
}
