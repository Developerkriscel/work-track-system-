import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDatabase } from '../config/database.js';
import { createAccessToken } from '../middleware/auth.middleware.js';
import { WhatsAppContact } from '../models/whatsappContact.model.js';
import { listRows } from '../services/legacyStore.service.js';
import { getWhatsAppWorkspace, saveWhatsAppContact } from '../services/whatsappContacts.service.js';

const baseUrl = process.env.PARITY_URL || `http://localhost:${process.env.PORT || 5000}`;
const safe = (value = '') => String(value ?? '').trim();
const first = (row = {}, keys = [], fallback = '') => keys.map((key) => row?.[key]).find((value) => safe(value)) ?? fallback;
const expect = (condition, message) => {
  if (!condition) throw new Error(message);
};

const runId = Date.now();
const directPhone = `+91987${String(runId).slice(-7)}`;
const routePhone = `+91988${String(runId).slice(-7)}`;
const cleanupPhones = [directPhone, routePhone];

async function cleanup() {
  await WhatsAppContact.deleteMany({ phone: { $in: cleanupPhones } });
}

async function post(path, token, body = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000)
  });
  const payload = await response.json().catch(() => ({ success: false, message: `Non-JSON response from ${path}` }));
  expect(response.ok && payload.success, `${path} failed: ${payload.message || response.status}`);
  return payload;
}

async function get(path, token) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15000)
  });
  const payload = await response.json().catch(() => ({ success: false, message: `Non-JSON response from ${path}` }));
  expect(response.ok && payload.success, `${path} failed: ${payload.message || response.status}`);
  return payload;
}

await connectDatabase();
try {
  await cleanup();
  const users = await listRows('User');
  const admin = users.find((row) => /^(hr|super admin|admin)$/i.test(first(row, ['Role', 'role'])) && /^active$/i.test(first(row, ['Status', 'status'], 'Active')));
  expect(admin, 'No active Admin, HR, or Super Admin user is available for WhatsApp verification.');

  const auth = {
    sub: first(admin, ['Employee ID', 'User ID', 'employeeId', 'userId']),
    kind: 'employee',
    role: first(admin, ['Role', 'role'])
  };
  const token = createAccessToken({ kind: auth.kind, id: auth.sub, role: auth.role });

  const workspace = await getWhatsAppWorkspace(auth);
  expect(Array.isArray(workspace.employees), 'Workspace employees should be an array.');
  expect(Array.isArray(workspace.contacts), 'Workspace contacts should be an array.');
  expect(Array.isArray(workspace.logs), 'Workspace logs should be an array.');

  const created = await saveWhatsAppContact({
    employeeId: '',
    name: `WhatsApp Verify Direct ${runId}`,
    phone: directPhone,
    department: 'Verification',
    enabled: true,
    alertTypes: ['ticket', 'approval'],
    notes: 'Temporary direct persistence check'
  }, auth);
  expect(created.contact.phone === directPhone, 'Direct service did not normalize/persist the expected phone.');

  const edited = await saveWhatsAppContact({
    ...created.contact,
    enabled: false,
    alertTypes: [],
    notes: 'Temporary direct persistence edit'
  }, auth);
  expect(edited.contact.enabled === false && edited.contact.alertTypes.length === 0, 'Direct service edit did not persist paused preference.');

  await saveWhatsAppContact({
    employeeId: '',
    name: `WhatsApp Duplicate ${runId}`,
    phone: directPhone,
    department: 'Verification',
    enabled: true,
    alertTypes: ['ticket'],
    notes: ''
  }, auth).then(
    () => { throw new Error('Duplicate phone should be rejected.'); },
    (error) => expect(/already has a saved contact/.test(error.message), `Duplicate error message was unexpected: ${error.message}`)
  );

  const routeCreated = await post('/api/whatsapp/contacts', token, {
    employeeId: '',
    name: `WhatsApp Verify Route ${runId}`,
    phone: routePhone,
    department: 'Verification',
    enabled: true,
    alertTypes: ['ticket'],
    notes: 'Temporary route persistence check'
  });
  expect(routeCreated.contact.phone === routePhone, 'Route contact save did not return the expected phone.');

  const routeWorkspace = await get('/api/whatsapp/workspace', token);
  expect(routeWorkspace.contacts.some((contact) => contact.phone === directPhone), 'Workspace did not return the direct saved contact.');
  expect(routeWorkspace.contacts.some((contact) => contact.phone === routePhone), 'Workspace did not return the route saved contact.');

  console.log(`WhatsApp live persistence passed for role ${auth.role}: workspace load, contact create, edit, duplicate validation, route save and route read-back.`);
} finally {
  if (mongoose.connection.readyState === 1) {
    await cleanup();
  }
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}
