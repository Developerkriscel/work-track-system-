// Offline checks: no database connection and no WhatsApp provider requests.
import assert from 'node:assert/strict';
import express from 'express';
import { once } from 'node:events';
import { normalizeContact, normalizeWhatsAppPhone } from '../services/whatsappContacts.service.js';
import whatsappRoutes from '../routes/whatsappContacts.routes.js';
import { createAccessToken, requireAuth } from '../middleware/auth.middleware.js';

const employees = [{ id: 'EMP_UI_1', name: 'Test Employee', department: 'Operations', status: 'Active' }];
const base = { employeeId: 'EMP_UI_1', name: 'Untrusted name', phone: '98765 43210', enabled: true, alertTypes: ['ticket'], notes: '' };
assert.equal(normalizeWhatsAppPhone('98765 43210'), '+919876543210');
assert.equal(normalizeWhatsAppPhone('+44 7700 900123'), '+447700900123');
for (const invalid of ['abc9876543210', '123', '+00012345678', '1234567890123456', '+91 9876543210 ext 4']) assert.equal(normalizeWhatsAppPhone(invalid), '');
const normalized = normalizeContact(base, employees);
assert.equal(normalized.name, 'Test Employee');
assert.equal(normalized.department, 'Operations');
assert.equal(normalized.phone, '+919876543210');
assert.throws(() => normalizeContact({ ...base, employeeId: 'NOT_VISIBLE' }, employees), /access/);
assert.throws(() => normalizeContact({ ...base, alertTypes: ['unknown'] }, employees), /valid alert/);
assert.throws(() => normalizeContact({ ...base, alertTypes: [] }, employees), /at least one/);
assert.throws(() => normalizeContact(base, [{ ...employees[0], status: 'Inactive' }]), /inactive/);
assert.equal(normalizeContact({ ...base, enabled: false, alertTypes: [] }, employees).enabled, false);
assert.equal(normalizeContact({ ...base, employeeId: '', name: 'External Client' }, employees).name, 'External Client');
assert.throws(() => normalizeContact({ ...base, enabled: 'true' }, employees), /enabled/);
assert.throws(() => normalizeContact({ ...base, notes: 'x'.repeat(501) }, employees), /too long/);

const app = express();
const clients = [{ id: 'C1', name: 'Client One', department: 'Client', status: 'Active' }];
const clientInput = { ...base, employeeId: '', clientId: 'C1', alertTypes: ['ticket'] };
assert.equal(normalizeContact(clientInput, employees, clients).name, 'Client One');
assert.throws(() => normalizeContact({ ...clientInput, employeeId: employees[0].id }, employees, clients), /either/);
assert.throws(() => normalizeContact(clientInput, employees, []), /access/);
assert.throws(() => normalizeContact({ ...clientInput, alertTypes: ['attendance'] }, employees, clients), /ticket/);
app.use(express.json());
app.use('/api/whatsapp', requireAuth({ kind: 'employee', roles: ['Admin', 'HR', 'Super Admin'] }), whatsappRoutes);
const server = app.listen(0, '127.0.0.1');
await once(server, 'listening');
try {
  const url = `http://127.0.0.1:${server.address().port}/api/whatsapp`;
  for (const [claims, expected] of [[null, 401], [{ kind: 'employee', id: 'E1', role: 'User' }, 403], [{ kind: 'employee', id: 'E2', role: 'Manager' }, 403], [{ kind: 'client', id: 'C1', role: 'Super Admin' }, 403]]) {
    const headers = claims ? { Authorization: `Bearer ${createAccessToken(claims)}` } : {};
    assert.equal((await fetch(`${url}/workspace`, { headers, signal: AbortSignal.timeout(5000) })).status, expected);
    assert.equal((await fetch(`${url}/contacts`, { method: 'POST', headers, signal: AbortSignal.timeout(5000) })).status, expected);
  }
} finally { await new Promise((resolve) => server.close(resolve)); }
console.log('WhatsApp contacts: phone validation, recipient scope, preferences and 8 API authorization checks passed. No database/provider access.');
