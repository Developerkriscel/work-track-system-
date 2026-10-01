import 'dotenv/config';
import mongoose from 'mongoose';
import assert from 'node:assert/strict';
import express from 'express';
import { once } from 'node:events';
import routes from '../routes/whatsappContacts.routes.js';
import { createAccessToken, requireAuth } from '../middleware/auth.middleware.js';
import { connectDatabase } from '../config/database.js';
import { WhatsAppIntegration } from '../models/whatsappIntegration.model.js';
import { decryptToken, effectiveIntegration } from '../services/whatsappIntegration.service.js';
const id = `verify-${Date.now()}`;
await connectDatabase();
// Redirect the service's singleton lookup only in this test process. The live
// active document and every other process remain untouched.
const find = WhatsAppIntegration.findById.bind(WhatsAppIntegration);
const update = WhatsAppIntegration.findOneAndUpdate.bind(WhatsAppIntegration);
const activeBefore = JSON.stringify(await find('active').lean());
WhatsAppIntegration.findById = (key) => find(key === 'active' ? id : key);
WhatsAppIntegration.findOneAndUpdate = (query, data, options) => update({ ...query, _id: id }, data, options);
const app = express();
app.use(express.json());
app.use('/api/whatsapp', requireAuth({ kind: 'employee', roles: ['Super Admin', 'Admin', 'HR'] }), routes);
const server = app.listen(0, '127.0.0.1');
await once(server, 'listening');
const url = `http://127.0.0.1:${server.address().port}/api/whatsapp/integration`;
const headers = (role = 'Super Admin', kind = 'employee') => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${createAccessToken({ role, kind, id: 'WA_VERIFY' })}` });
const save = (body) => fetch(url, { method: 'PUT', headers: headers(), body: JSON.stringify(body) });
try {
  assert.equal((await fetch(url)).status, 401);
  for (const role of ['HR', 'Admin', 'Manager']) {
    assert.equal((await fetch(url, { headers: headers(role) })).status, 403);
    assert.equal((await fetch(url, { method: 'PUT', headers: headers(role), body: '{}' })).status, 403);
  }
  assert.equal((await fetch(url, { headers: headers('Super Admin', 'client') })).status, 403);
  const initial = await (await fetch(url, { headers: headers() })).json();
  assert.equal(initial.settings.source, 'environment');
  assert(!('accessToken' in initial.settings));
  const input = { ...initial.settings, provider: 'aknexus', apiBaseUrl: 'https://app.aknexus.in/api', instanceId: 'VERIFY_FIRST', accessToken: 'verification-only' };
  const created = await save(input);
  assert.equal(created.status, 200);
  const first = await created.json();
  assert.equal(first.settings.revision, 1);
  const saved = await find(id).lean();
  assert.equal(decryptToken(saved.encryptedToken), 'verification-only');
  assert(!saved.encryptedToken.includes('verification-only'));
  const concurrent = await Promise.all([save({ ...first.settings, accessToken: '', instanceId: 'VERIFY_A' }), save({ ...first.settings, accessToken: '', instanceId: 'VERIFY_B' })]);
  assert.deepEqual(concurrent.map((r) => r.status).sort(), [200, 409]);
  const reloaded = await (await fetch(url, { headers: headers() })).json();
  assert.equal(reloaded.settings.revision, 2);
  assert.equal((await effectiveIntegration()).accessToken, 'verification-only');
  assert.equal((await save({ ...reloaded.settings, apiBaseUrl: 'http://localhost/api' })).status, 400);
  assert.equal((await find(id).lean()).revision, 2);
  assert.equal(JSON.stringify(await find('active').lean()), activeBefore);
  console.log('Integration HTTP + MongoDB passed: real save/reload, blank-token retention, encryption, concurrent saves (200/409), invalid URL rejection, masked reads and role/account authorization. Live settings unchanged; no messages sent.');
} finally {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  await WhatsAppIntegration.deleteOne({ _id: id });
  await mongoose.disconnect();
}
