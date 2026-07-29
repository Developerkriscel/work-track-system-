import 'dotenv/config';
import fs from 'fs';
import { chromium } from 'playwright-core';
import { connectDatabase } from '../config/database.js';
import { LegacyModels } from '../models/legacyModels.js';
import { employeeToken, normalizeEmployee } from '../services/auth.service.js';
import { listRows } from '../services/legacyStore.service.js';

const baseUrl = process.env.PARITY_URL || `http://localhost:${process.env.PORT || 5000}`;
const failures = [];
let createdEmployeeCode = '';
let createdEmployeePassword = '';

const safe = (value = '') => String(value ?? '').trim();
const first = (row, keys, fallback = '') => {
  for (const key of keys) {
    const value = row?.[key];
    if (safe(value)) return value;
  }
  return fallback;
};
const assert = (condition, message) => { if (!condition) failures.push(message); };

async function verifyEmployeeLogin(baseUrl, employeeId, password) {
  const response = await fetch(`${baseUrl}/api/auth/employee/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ employeeId, password })
  });
  const payload = await response.json().catch(() => ({}));
  return { ok: response.ok, payload };
}

await connectDatabase();
const users = await listRows('User');
const rawUser = users.find((row) => /^(hr|super admin)$/i.test(String(row.Role || '').trim()) && /^active$/i.test(String(row.Status || 'Active')));
assert(Boolean(rawUser), 'No active HR or Super Admin user is available for EMP Master UI verification.');

if (rawUser) {
  const user = normalizeEmployee(rawUser);
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'
  });
  const context = await browser.newContext({ viewport: { width: 1500, height: 980 } });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('pageerror', (error) => consoleErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  try {
    await page.addInitScript(
      (session) => localStorage.setItem('worktrack.mern.employeeSession', JSON.stringify(session)),
      { user, token: employeeToken(user) }
    );
    await page.goto(`${baseUrl}/emp-master`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.getByRole('heading', { name: 'Employee Master Data', exact: true }).waitFor({ state: 'visible', timeout: 15000 });

    for (const label of ['Add Employee', 'Add Intern', 'Add Freelancer', 'Master Data', 'Employees', 'Freelancers', 'Interns', 'Inactive Users']) {
      assert(await page.getByRole('button', { name: label, exact: true }).count() === 1, `EMP Master button/tab is missing: ${label}.`);
    }
    for (const stat of ['Total Users', 'Active Users', 'Managers / Admins', 'Departments']) {
      assert(await page.getByText(stat, { exact: true }).count() >= 1, `Summary card is missing: ${stat}.`);
    }

    const search = page.getByPlaceholder('Search employee, ID, role, department, manager, status...');
    await search.fill('KRIS_001');
    await page.waitForTimeout(400);
    const filteredRows = await page.locator('.emp-master-table tbody tr').count();
    assert(filteredRows >= 1, 'EMP Master search did not keep a matching record visible.');
    await search.fill('');

    for (const tab of ['Employees', 'Freelancers', 'Interns', 'Inactive Users', 'Master Data']) {
      await page.getByRole('button', { name: tab, exact: true }).click();
      await page.waitForTimeout(300);
      assert(await page.locator('.emp-master-table').count() === 1, `EMP Master table disappeared after switching to ${tab}.`);
    }

    await page.getByRole('button', { name: 'Add Employee', exact: true }).click();
    await page.getByRole('heading', { name: 'Add Employee', exact: true }).waitFor({ state: 'visible', timeout: 10000 });
    const modalPosition = await page.locator('.app-modal-backdrop').evaluate((node) => getComputedStyle(node).position);
    assert(modalPosition === 'fixed', 'Add Employee editor is not rendered as a fixed modal.');

    const empCodeInput = page.getByLabel('EMP Code *');
    await empCodeInput.waitFor({ state: 'visible' });
    await page.waitForFunction(() => {
      const labels = [...document.querySelectorAll('label')];
      return labels.some((node) => node.querySelector('span')?.textContent?.includes('EMP Code') && node.querySelector('input')?.value);
    }, null, { timeout: 10000 });
    createdEmployeeCode = await empCodeInput.inputValue();
    createdEmployeePassword = `Verify@${Date.now()}`;

    assert(Boolean(createdEmployeeCode), 'Add Employee did not generate an EMP Code.');
    await page.getByLabel('Full Name *').fill('Browser EMP Verification');
    await page.getByLabel('Role').selectOption('User');
    await page.getByLabel('Department').fill('Quality');
    await page.getByLabel('Designation').fill('UI Verification');
    await page.getByLabel('Mobile Number').fill('9000000001');
    await page.getByLabel('Official Email').fill(`${createdEmployeeCode.toLowerCase()}@example.test`);
    await page.getByLabel('Portal Password *').fill(createdEmployeePassword);
    await page.getByRole('button', { name: 'Save Data', exact: true }).click();
    await page.getByText(/saved successfully/i).waitFor({ state: 'visible', timeout: 15000 });

    await page.getByRole('button', { name: 'Employees', exact: true }).click();
    await page.getByText('Browser EMP Verification', { exact: true }).waitFor({ state: 'visible', timeout: 15000 });
    assert(await page.getByText('Browser EMP Verification', { exact: true }).count() === 1, 'Saved employee did not appear in the Employees tab.');

    const loginCheck = await verifyEmployeeLogin(baseUrl, createdEmployeeCode, createdEmployeePassword);
    assert(loginCheck.ok && loginCheck.payload?.success, 'Created employee could not log in with the saved portal password.');

    const targetRow = page.locator('.emp-master-table tbody tr', { hasText: 'Browser EMP Verification' }).first();
    await targetRow.getByRole('button', { name: 'View', exact: true }).click();
    await page.getByRole('heading', { name: 'People Details', exact: true }).waitFor({ state: 'visible', timeout: 10000 });
    assert(await page.getByRole('button', { name: 'Save Data', exact: true }).count() === 0, 'View mode should not show the save button.');
    await page.locator('.emp-editor-modal').getByLabel('Close').click();

    await targetRow.getByRole('button', { name: 'Edit', exact: true }).click();
    await page.locator('.confirm-dialog').getByRole('button', { name: 'Open Edit', exact: true }).click();
    await page.getByRole('heading', { name: 'Edit Employee', exact: true }).waitFor({ state: 'visible', timeout: 10000 });
    const designationField = page.getByLabel('Designation');
    await designationField.fill('UI Verification Updated');
    await page.getByRole('button', { name: 'Save Data', exact: true }).click();
    await page.getByText(/saved successfully/i).waitFor({ state: 'visible', timeout: 15000 });

    await page.reload({ waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.getByRole('button', { name: 'Employees', exact: true }).click();
    await page.getByText('Browser EMP Verification', { exact: true }).waitFor({ state: 'visible', timeout: 15000 });
    const persistedRows = await listRows('EmpMaster');
    const persistedRecord = persistedRows.find((row) => safe(first(row, ['EMP Code', 'Employee ID'])).toLowerCase() === createdEmployeeCode.toLowerCase());
    assert(
      safe(first(persistedRecord, ['Designation'])).toLowerCase() === 'ui verification updated',
      'Edited employee details did not persist to MongoDB.'
    );

    const updatedRow = page.locator('.emp-master-table tbody tr', { hasText: 'Browser EMP Verification' }).first();
    await updatedRow.getByRole('button', { name: 'Delete', exact: true }).click();
    await page.locator('.confirm-dialog').getByRole('button', { name: 'Delete', exact: true }).click();
    await page.waitForTimeout(1200);
    assert(await page.getByText('Browser EMP Verification', { exact: true }).count() === 0, 'Deleted employee still appears in the table.');

    const deletedLogin = await verifyEmployeeLogin(baseUrl, createdEmployeeCode, createdEmployeePassword);
    assert(!(deletedLogin.ok && deletedLogin.payload?.success), 'Deleted employee can still log in.');
    createdEmployeeCode = '';
    createdEmployeePassword = '';
  } catch (error) {
    failures.push(`EMP Master UI check failed: ${error.message}`);
  } finally {
    if (consoleErrors.length) failures.push(`Browser errors: ${[...new Set(consoleErrors)].join(' | ')}`);
    await context.close();
    await browser.close();
    if (createdEmployeeCode) {
      const identityQuery = {
        $or: [
          { legacyId: createdEmployeeCode },
          { 'data.EMP Code': createdEmployeeCode },
          { 'data.Employee ID': createdEmployeeCode },
          { 'data.User ID': createdEmployeeCode },
          { 'data.employeeId': createdEmployeeCode }
        ]
      };
      await Promise.all([
        LegacyModels.EmpMaster.deleteMany(identityQuery),
        LegacyModels.User.deleteMany(identityQuery)
      ]);
    }
  }
}

const independentSources = [
  'client/src/features/emp-master/EmpMasterPage.jsx',
  'client/src/features/emp-master/api.js',
  'server/services/empMaster.service.js',
  'server/routes/empMaster.routes.js'
];
for (const sourcePath of independentSources) {
  const source = fs.readFileSync(sourcePath, 'utf8');
  assert(!/google\.script\.run|mernApi|appscript/i.test(source), `Apps Script bridge dependency found in ${sourcePath}.`);
}

if (failures.length) {
  console.error(failures.join('\n---\n'));
  process.exit(1);
}

console.log('EMP Master UI and merged workflow verification passed.');
