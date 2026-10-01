// Isolated HTTP/provider checks. No real database writes or WhatsApp messages.
import assert from 'node:assert/strict';
import { WhatsAppIntegration } from '../models/whatsappIntegration.model.js';
WhatsAppIntegration.findById = () => ({ lean: async () => null });
import express from 'express';
import { once } from 'node:events';
import routes from '../routes/whatsappContacts.routes.js';
import { WhatsAppContact } from '../models/whatsappContact.model.js';
import { WhatsAppOutboundLog } from '../models/whatsappOutboundLog.model.js';
import { createAccessToken, requireAuth } from '../middleware/auth.middleware.js';

process.env.AKNEXUS_INSTANCE_ID = 'test-instance';
process.env.AKNEXUS_ACCESS_TOKEN = 'test-token';
const contact = { _id: 'aaaaaaaaaaaaaaaaaaaaaaaa', phone: '+919876543210', name: 'Test', enabled: true, employeeId: '', alertTypes: ['ticket'] };
WhatsAppContact.findById = () => ({ lean: async () => contact });
const logs = [];
WhatsAppOutboundLog.create = async (row) => { logs.push(row); return { toObject: () => row }; };
const realFetch = globalThis.fetch;
let providerCalls = 0;
let reply = () => Response.json({ status: 'success' });
globalThis.fetch = async (url, options) => {
  if (!String(url).startsWith('https://app.aknexus.in/')) return realFetch(url, options);
  providerCalls++;
  const body = JSON.parse(options.body);
  assert.equal(body.number, '919876543210');
  assert.equal(body.type, 'text');
  return reply();
};
const app = express();
app.use(express.json());
app.use('/api/whatsapp', requireAuth({ kind: 'employee', roles: ['Super Admin', 'Admin', 'HR'] }), routes);
const server = app.listen(0, '127.0.0.1');
await once(server, 'listening');
const url = `http://127.0.0.1:${server.address().port}/api/whatsapp/test-message`;
const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${createAccessToken({ kind: 'employee', id: 'TEST', role: 'Super Admin' })}` };
const post = (body) => realFetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
try {
  assert.equal((await post({})).status, 400);
  assert.equal((await post({ contactId: 'invalid' })).status, 400);
  assert.equal(providerCalls, 0);
  contact.enabled = false;
  assert.equal((await post({ contactId: contact._id })).status, 400);
  assert.equal(providerCalls, 0);
  contact.enabled = true;
  assert.equal((await post({ contactId: contact._id, pdfAttachment: { base64: 'abc', fileName: 'not-image.png', contentType: 'image/png' } })).status, 400);
  assert.equal(providerCalls, 0);
  assert.equal((await post({ contactId: contact._id })).status, 200);
  assert.equal(logs.at(-1).status, 'sent');
  for (const response of [() => Response.json({ success: false }), () => Response.json({ status: 'success', sent: false }), () => Response.json({ status: 'error', message: 'Disconnected' }), () => new Response('<html>Unavailable</html>'), () => { throw new Error('network'); }]) {
    reply = response;
    const before = logs.length;
    assert.equal((await post({ contactId: contact._id })).status, 502);
    assert.equal(logs.length, before + 1);
    assert.equal(logs.at(-1).status, 'failed');
  }
  console.log('WhatsApp send route passed: validation, disabled contacts, provider acceptance, rejection, malformed response, network failure and single logging. No real messages sent.');
} finally {
  globalThis.fetch = realFetch;
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
}
