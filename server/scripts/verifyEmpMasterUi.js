import 'dotenv/config';
import fs from 'fs';
import mongoose from 'mongoose';
import { chromium } from 'playwright-core';
import { connectDatabase } from '../config/database.js';
import { LegacyModels } from '../models/legacyModels.js';
import { employeeToken, normalizeEmployee } from '../services/auth.service.js';
import { listRows } from '../services/legacyStore.service.js';

const baseUrl = process.env.PARITY_URL || `http://localhost:${process.env.PORT || 5000}`;
const failures = [];
let createdEmployeeCode = '';
const assert = (condition, message) => { if (!condition) failures.push(message); };

await connectDatabase();
const users = await listRows('User');
const rawUser = users.find((row) => /^(hr|super admin)$/i.test(String(row.Role || '').trim()) && /^active$/i.test(String(row.Status || 'Active')));
assert(Boolean(rawUser), 'No active HR or Super Admin user is available for EMP Master UI verification.');

if (rawUser) {
  const user = normalizeEmployee(rawUser);
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const context = await browser.newContext({ viewport: { width: 1500, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  try {
    await page.addInitScript((session) => localStorage.setItem('worktrack.mern.employeeSession', JSON.stringify(session)), { user, token: employeeToken(user) });
    await page.goto(`${baseUrl}/emp-master`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.getByRole('heading', { name: 'Employee Master Data', exact: true }).waitFor({ state: 'visible', timeout: 10000 });
    for (const label of ['Add Employee', 'Add Intern', 'Add Freelancer', 'Master Data', 'Employees', 'Freelancers', 'Interns', 'Inactive Users']) {
      assert(await page.getByRole('button', { name: label, exact: true }).count() === 1, `EMP Master button/tab is missing: ${label}.`);
    }
    const firstEmployeeId = await page.locator('.emp-master-table tbody tr td').first().innerText();
    assert(Boolean(firstEmployeeId.trim()) && firstEmployeeId.trim() !== '-', 'EMP Master table did not render Mongo employee IDs.');
    await page.getByRole('button', { name: 'Add Employee', exact: true }).click();
    await page.getByRole('heading', { name: 'Add Employee', exact: true }).waitFor({ state: 'visible' });
    assert(await page.getByLabel('Full Name *').count() === 1, 'Add Employee full-name field is missing.');
    assert(await page.getByLabel('Portal Password *').count() === 1, 'Add Employee portal-password field is missing.');
    assert(await page.getByRole('button', { name: 'Save Data', exact: true }).count() === 1, 'Add Employee save button is missing.');
    const modalPosition = await page.locator('.app-modal-backdrop').evaluate((node) => getComputedStyle(node).position);
    assert(modalPosition === 'fixed', 'Add Employee editor is not rendered as a fixed modal.');
    const empCodeInput = page.getByLabel('EMP Code *');
    await empCodeInput.waitFor({ state: 'visible' });
    await page.waitForFunction(() => {
      const label = [...document.querySelectorAll('label')].find((node) => node.querySelector('span')?.textContent?.includes('EMP Code'));
      return Boolean(label?.querySelector('input')?.value);
    }, null, { timeout: 10000 });
    createdEmployeeCode = await empCodeInput.inputValue();
    assert(Boolean(createdEmployeeCode), 'Add Employee did not generate an EMP Code.');
    await page.getByLabel('Full Name *').fill('Browser EMP Verification');
    await page.getByLabel('Department').fill('Quality');
    await page.getByLabel('Designation').fill('UI Verification');
    await page.getByLabel('Phone No').fill('9000000001');
    await page.getByLabel('Official Email').fill(`${createdEmployeeCode.toLowerCase()}@example.test`);
    await page.getByLabel('Portal Password *').fill(`Verify@${Date.now()}`);
    await page.getByRole('button', { name: 'Save Data', exact: true }).click();
    await page.getByText(/saved successfully/i).waitFor({ state: 'visible', timeout: 15000 });
    await page.getByRole('button', { name: 'Employees', exact: true }).click();
    await page.getByText('Browser EMP Verification', { exact: true }).waitFor({ state: 'visible', timeout: 15000 });
    assert(await page.getByText('Browser EMP Verification', { exact: true }).count() === 1, 'Saved employee did not appear in the Employees tab.');
    await page.getByRole('button', { name: 'Interns', exact: true }).click();
    assert(await page.getByRole('heading', { name: 'Interns', exact: true }).count() === 1, 'Intern category did not render.');
    assert(await page.locator('.emp-master-table').count() === 1, 'EMP Master table is missing.');
  } catch (error) {
    failures.push(`EMP Master UI check failed: ${error.message}`);
  } finally {
    if (errors.length) failures.push(`Browser errors: ${[...new Set(errors)].join(' | ')}`);
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
for (const path of independentSources) {
  const source = fs.readFileSync(path, 'utf8');
  assert(!/google\.script\.run|mernApi|appscript/i.test(source), `Apps Script bridge dependency found in ${path}.`);
}

if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
if (failures.length) {
  console.error(failures.join('\n---\n'));
  process.exit(1);
}
console.log('EMP Master UI and independence verification passed.');
