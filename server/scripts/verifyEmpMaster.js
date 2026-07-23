import 'dotenv/config';
import { connectDatabase } from '../config/database.js';
import { createAccessToken } from '../middleware/auth.middleware.js';
import { listRows } from '../services/legacyStore.service.js';

const safe = (value = '') => String(value ?? '').trim();
const first = (row, keys) => keys.map((key) => row?.[key]).find((value) => safe(value)) || '';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

await connectDatabase();
const users = await listRows('User');
const admin = users.find((user) => /^(hr|super admin)$/i.test(first(user, ['Role'])) && /^active$/i.test(first(user, ['Status']) || 'Active'));
assert(admin, 'No active HR or Super Admin user is available for EMP Master verification.');

const employeeId = first(admin, ['Employee ID', 'User ID']);
const token = createAccessToken({ kind: 'employee', id: employeeId, role: first(admin, ['Role']) });
const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
const dataResponse = await fetch('http://localhost:5000/api/emp-master/data', {
  method: 'POST', headers, body: JSON.stringify({ category: 'Master' })
});
const dataPayload = await dataResponse.json();
assert(dataResponse.ok && dataPayload.success && Array.isArray(dataPayload.data), 'EMP Master data endpoint did not return a valid Mongo payload.');
assert(dataPayload.data.length > 0, 'EMP Master returned no live Mongo employee records.');
assert(dataPayload.data.every((row) => first(row, ['EMP Code', 'Employee ID', 'User ID'])), 'EMP Master returned records without employee IDs.');
assert(dataPayload.data.every((row) => first(row, ['Name', 'Employee Name'])), 'EMP Master returned records without employee names.');

const codeResponse = await fetch('http://localhost:5000/api/emp-master/next-code', {
  method: 'POST', headers, body: JSON.stringify({ category: 'Intern' })
});
const codePayload = await codeResponse.json();
assert(codeResponse.ok && codePayload.success && /^KRIS_\d{3}$/.test(codePayload.code), 'EMP Master code endpoint did not return a legacy-compatible code.');

const unprivileged = users.find((user) => !/^(hr|super admin)$/i.test(first(user, ['Role'])) && /^active$/i.test(first(user, ['Status']) || 'Active'));
if (unprivileged) {
  const blockedToken = createAccessToken({
    kind: 'employee',
    id: first(unprivileged, ['Employee ID', 'User ID']),
    role: first(unprivileged, ['Role'])
  });
  const blockedResponse = await fetch('http://localhost:5000/api/emp-master/data', {
    method: 'POST',
    headers: { Authorization: `Bearer ${blockedToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ category: 'Master' })
  });
  assert([401, 403].includes(blockedResponse.status), `Non-HR EMP Master request returned ${blockedResponse.status}, expected access denial.`);
}

console.log(`EMP Master API verification passed for ${employeeId}: ${dataPayload.data.length} Master records, next Intern code ${codePayload.code}.`);
process.exit(0);
