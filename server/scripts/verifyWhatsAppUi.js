// Isolated UI fixture: serves the built frontend with in-memory fake API data.
// Never starts server.js, opens MongoDB, or calls AKNexus.
import express from 'express';
import path from 'node:path';
import fs from 'node:fs/promises';
import { once } from 'node:events';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const root = path.resolve(import.meta.dirname, '../..');
const employees = Array.from({ length: 18 }, (_, i) => ({ id: `UI_${i + 1}`, name: ['Aarav Sharma', 'Priya Mehta', 'Rohan Kapoor', 'Neha Singh'][i % 4] + (i >= 4 ? ` ${i + 1}` : ''), department: ['Operations', 'Design', 'Accounts'][i % 3], phone: `987650${String(i).padStart(4, '0')}`, status: 'Active' }));
let contacts = [{ id: '111111111111111111111111', employeeId: 'UI_1', name: 'Aarav Sharma', phone: '+919876500000', department: 'Operations', enabled: true, alertTypes: ['ticket', 'approval', 'reminder'], notes: '' }];
const logs = [
  { id: 'L1', employeeId: 'UI_1', name: 'Aarav Sharma', phone: '+919876500000', alertType: 'Ticket assigned', entityId: 'TKT-1042', timestamp: '2026-09-09T05:30:00Z', status: 'Sent', message: 'Hello Aarav,\nA new ticket has been assigned to you.\nTicket: TKT-1042\nPlease review it in your work portal.', source: 'Legacy import' },
  { id: 'L2', employeeId: 'UI_2', name: 'Priya Mehta', phone: '+919876500001', alertType: 'Approval pending', entityId: 'TKT-1041', timestamp: '2026-09-09T04:00:00Z', status: 'Failed', message: 'A ticket is awaiting your approval.', error: 'Test failure: recipient unavailable', source: 'Legacy import' }
];
const app = express();
app.use(express.json());
app.post('/api/auth/employee/:action', (_req, res) => res.json({ success: true, token: 'isolated-ui-test', user: { 'Employee ID': 'UI_ADMIN', 'Employee Name': 'Preview Admin', Role: 'Super Admin', access: { canManageUsers: true } } }));
app.get('/api/whatsapp/workspace', (_req, res) => res.json({ success: true, employees, clients: [{ id: 'CLIENT_1', name: 'Fixture Client', phone: '9876543219', department: 'Client', status: 'Active' }], contacts, logs, logLimit: 1000, sendingEnabled: false }));
let settings = { provider: 'aknexus', providerName: 'AKNexus', apiBaseUrl: 'https://app.aknexus.in/api', instanceId: 'ORIGINAL', senderNumber: '', revision: 0, source: 'environment', hasToken: true, configured: true };
app.get('/api/whatsapp/integration', (_req, res) => res.json({ success: true, settings }));
app.put('/api/whatsapp/integration', (req, res) => { const { accessToken, ...next } = req.body; settings = { ...next, revision: settings.revision + 1, source: 'database' }; res.json({ success: true, settings }); });
let integrationTests = 0;
app.post('/api/whatsapp/test-message', (req, res) => { assert(contacts.some((c) => c.id === req.body.contactId && c.enabled)); integrationTests++; res.json({ success: true, message: 'Fixture provider accepted test message.' }); });
app.post('/api/whatsapp/contacts', (req, res) => {
  const contact = { ...req.body, id: req.body.id || String(contacts.length + 1).repeat(24) };
  if (contact.phone.includes('invalid')) return res.status(400).json({ success: false, message: 'Enter a valid WhatsApp number with country code.' });
  if (contacts.some((c) => c.id !== contact.id && c.phone === contact.phone)) return res.status(400).json({ success: false, message: 'This WhatsApp number already has a saved contact.' });
  contacts = [...contacts.filter((c) => c.id !== contact.id), contact];
  return res.json({ success: true, contact });
});
app.use('/api', (_req, res) => res.json({ success: true, data: [], notifications: [], count: 0, serverTime: Date.now() }));
app.use(express.static(path.join(root, 'client/dist')));
app.use(express.static(path.join(root, 'public')));
app.get('*', (_req, res) => res.sendFile(path.join(root, 'client/dist/index.html')));
const server = app.listen(0, '127.0.0.1');
await once(server, 'listening');
let browser;
try {
  browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.setDefaultTimeout(12000);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  await page.route('**/*', (route) => route.request().url().startsWith(baseUrl) || route.request().url().startsWith('data:') ? route.continue() : route.abort());
  await page.goto(`${baseUrl}/whatsapp`);
  await page.getByLabel('Employee ID', { exact: true }).fill('UI_ADMIN');
  await page.getByLabel('Password', { exact: true }).fill('local-fixture-only');
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await page.getByRole('heading', { name: /WhatsApp Center/ }).waitFor();
  await page.locator('.wa-chat-shell').waitFor();
  await page.locator('.wa-chat-contact').filter({ hasText: 'Aarav Sharma' }).first().waitFor();
  await page.locator('.wa-chat-topbar').filter({ hasText: 'Aarav Sharma' }).waitFor();
  assert.match(await page.locator('.wa-chat-bubble').first().innerText(), /TKT-1042/);
  const chatMetrics = await page.evaluate(() => {
    const shell = document.querySelector('.wa-chat-shell').getBoundingClientRect();
    const list = document.querySelector('.wa-chat-list');
    const body = document.querySelector('.wa-chat-body');
    return {
      shellHeight: shell.height,
      listScrolls: list.scrollHeight > list.clientHeight,
      bodyCanScroll: getComputedStyle(body).overflowY === 'auto',
      bodyHeight: body.getBoundingClientRect().height
    };
  });
  assert.ok(chatMetrics.shellHeight >= 500 && chatMetrics.shellHeight <= 800, 'Chat shell should be large enough without stretching past the page.');
  assert.equal(chatMetrics.listScrolls, true, 'Recipient list should scroll inside the left sidebar.');
  assert.equal(chatMetrics.bodyCanScroll, true, 'Message body should own its vertical scroll.');
  assert.ok(chatMetrics.bodyHeight >= 390 && chatMetrics.bodyHeight <= 680, 'Message section should be comfortably sized.');
  await fs.mkdir(path.join(root, 'artifacts/whatsapp'), { recursive: true });
  await page.screenshot({ path: path.join(root, 'artifacts/whatsapp/desktop-history.png'), fullPage: true });
  await page.getByRole('searchbox').fill('Priya Mehta');
  assert.equal(await page.locator('.wa-chat-contact').count(), 5);
  await page.locator('.wa-chat-contact').filter({ hasText: 'Priya Mehta' }).first().click();
  await page.locator('.wa-chat-bubble--failed').waitFor();
  await page.getByRole('button', { name: 'Open details' }).click();
  await page.getByRole('dialog').waitFor();
  assert.match(await page.getByRole('dialog').innerText(), /recipient unavailable/);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Failed' }).click();
  assert.equal(await page.locator('.wa-chat-contact').count(), 1);
  await page.getByRole('button', { name: 'Clear' }).click();
  assert.equal(await page.locator('.wa-chat-contact').count(), 18);
  await page.getByRole('tab', { name: /WhatsApp contacts/ }).click();
  await page.getByRole('button', { name: '+ Add contact', exact: true }).click();
  await page.getByLabel('Link to employee or client').selectOption('employee:UI_2');
  assert.equal(await page.getByLabel('Contact name *', { exact: true }).inputValue(), 'Priya Mehta');
  await page.getByLabel(/^WhatsApp number/).fill('invalid');
  await page.getByRole('button', { name: 'Save contact', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'valid WhatsApp number' }).waitFor();
  await page.getByLabel(/^WhatsApp number/).fill('+919876500001');
  await page.getByLabel('Enable alerts for this contact').uncheck();
  await page.getByRole('button', { name: 'Save contact', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'contact saved' }).waitFor();
  assert.equal(contacts.length, 2);
  assert.equal(contacts[1].enabled, false);
  await page.reload();
  await page.getByRole('tab', { name: /WhatsApp contacts/ }).click();
  await page.getByText('Priya Mehta', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Edit Priya Mehta', exact: true }).click();
  await page.getByLabel('Enable alerts for this contact').check();
  await page.getByLabel('Notes', { exact: false }).fill('Use for work updates');
  await page.screenshot({ path: path.join(root, 'artifacts/whatsapp/desktop-contact-form.png'), fullPage: true });
  await page.getByRole('button', { name: 'Save contact', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'contact saved' }).waitFor();
  assert.equal(contacts.find((c) => c.employeeId === 'UI_2').enabled, true);
  await page.screenshot({ path: path.join(root, 'artifacts/whatsapp/desktop-contacts.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  // The existing app shell animates its sidebar when crossing this breakpoint.
  await page.waitForFunction(() => document.querySelector('.sidebar').getBoundingClientRect().right <= 1);
  await page.screenshot({ path: path.join(root, 'artifacts/whatsapp/mobile-contacts.png'), fullPage: true });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'Mobile page must not overflow horizontally');
  await page.getByRole('button', { name: '+ Add contact', exact: true }).click();
  await page.screenshot({ path: path.join(root, 'artifacts/whatsapp/mobile-contact-form.png'), fullPage: true });
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('tab', { name: /Alert history/ }).click();
  await page.locator('.wa-chat-shell').waitFor();
  await page.screenshot({ path: path.join(root, 'artifacts/whatsapp/mobile-history.png'), fullPage: true });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'History page must not overflow horizontally');
  assert.equal(await page.locator('.wa-chat-panel').isVisible(), false);
  await page.locator('.wa-chat-contact').first().click();
  assert.equal(await page.locator('.wa-chat-sidebar').isVisible(), false);
  assert.equal(await page.locator('.wa-chat-panel').isVisible(), true);
  await page.locator('.wa-chat-bubble, .wa-chat-empty').first().scrollIntoViewIfNeeded();
  const mobileChatWidth = await page.locator('.wa-chat-panel').evaluate((el) => el.getBoundingClientRect().width);
  assert.ok(mobileChatWidth > 320, 'Mobile chat must use available width');
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await page.screenshot({ path: path.join(root, 'artifacts/whatsapp/mobile-table.png'), fullPage: true });
  await page.getByRole('button', { name: 'Back to contacts', exact: true }).click();
  assert.equal(await page.locator('.wa-chat-sidebar').isVisible(), true);
  for (const width of [320, 768]) {
    await page.setViewportSize({ width, height: 844 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `No overflow at ${width}px`);
    await page.locator('.wa-chat-contact').first().click();
    assert.equal(await page.locator('.wa-chat-sidebar').isVisible(), false);
    await page.getByRole('button', { name: 'Back to contacts', exact: true }).click();
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('tab', { name: 'WhatsApp Integration', exact: true }).click();
  await page.getByLabel(/^API Base URL/).waitFor();
  assert.equal(await page.getByLabel(/^API Token/).inputValue(), '');
  await page.getByLabel('Instance ID', { exact: true }).fill('NEW_INSTANCE');
  await page.getByRole('button', { name: 'Save & activate', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'Provider settings saved' }).waitFor();
  assert.equal(settings.instanceId, 'NEW_INSTANCE');
  await page.getByLabel(/^Test recipient/).selectOption(contacts[0].id);
  await page.getByLabel('Instance ID', { exact: true }).fill('UNSAVED');
  assert.equal(await page.getByRole('button', { name: 'Send test message', exact: true }).isDisabled(), true);
  await page.getByRole('button', { name: 'Discard changes', exact: true }).click();
  await page.getByRole('button', { name: 'Send test message', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'Fixture provider accepted' }).waitFor();
  assert.equal(integrationTests, 1);
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await page.waitForFunction(() => document.querySelector('.sidebar').getBoundingClientRect().right <= 1);
  assert.ok(await page.locator('.wa-integration input').evaluateAll((inputs) => inputs.every((input) => input.getBoundingClientRect().right <= innerWidth + 1)), 'Integration inputs must not be clipped on mobile');
  await page.screenshot({ path: path.join(root, 'artifacts/whatsapp/mobile-integration.png'), fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('tab', { name: /Alert history/ }).click();
  await page.getByRole('button', { name: '+ Add contact', exact: true }).click();
  assert.equal(await page.locator('optgroup[label="Employees"]').count(), 1);
  assert.equal(await page.locator('optgroup[label="Clients"]').count(), 1);
  await page.getByLabel('Link to employee or client').selectOption('client:CLIENT_1');
  assert.equal(await page.getByLabel('Contact name *', { exact: true }).inputValue(), 'Fixture Client');
  assert.equal(await page.getByLabel(/^WhatsApp number/).inputValue(), '9876543219');
  assert.equal(await page.locator('.wa-category-grid input').count(), 1);
  await page.getByRole('button', { name: 'Save contact', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'contact saved' }).waitFor();
  assert.equal(contacts.find((c) => c.clientId === 'CLIENT_1').employeeId, '');
  await page.getByRole('button', { name: 'Edit Fixture Client', exact: true }).click();
  assert.equal(await page.getByLabel('Link to employee or client').inputValue(), 'client:CLIENT_1');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.route('**/api/whatsapp/workspace', (route) => route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ success: false, message: 'Fixture load failure' }) }));
  await page.locator('.wa-page').getByRole('button', { name: 'Refresh', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'Fixture load failure' }).waitFor();
  assert.equal(await page.getByRole('button', { name: '+ Add contact', exact: true }).isDisabled(), true);
  await page.unroute('**/api/whatsapp/workspace');
  await page.route('**/api/whatsapp/workspace', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, employees: [], contacts: [], logs: [] }) }));
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await page.getByRole('tab', { name: /WhatsApp contacts/ }).click();
  await page.getByRole('heading', { name: 'Start with your first contact' }).waitFor();
  assert.deepEqual(errors, [], 'No runtime errors');
  console.log('WhatsApp UI passed: chat history, contact search, failed filter, message details, add, edit, reload, mobile overflow, modal, load-error and empty-state checks. Fixtures only.');
} finally {
  await browser?.close();
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
}
