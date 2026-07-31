import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDatabase } from '../config/database.js';
import { createAccessToken } from '../middleware/auth.middleware.js';
import { LegacyModels } from '../models/legacyModels.js';
import { listRows } from '../services/legacyStore.service.js';

const baseUrl = process.env.PARITY_URL || `http://localhost:${process.env.PORT || 5000}`;
const safe = (value = '') => String(value ?? '').trim();
const first = (row, keys, fallback = '') => keys.map((key) => row?.[key]).find((value) => safe(value)) ?? fallback;
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const isExpectedR2Url = (url, folderName) => {
  const value = String(url || '');
  if (!value) return false;
  const escapedFolder = folderName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`/([^/]+/)?${escapedFolder}/`, 'i').test(value);
};

await connectDatabase();
const users = await listRows('User');
const admin = users.find((user) => /^(hr|super admin)$/i.test(first(user, ['Role', 'role'])) && /^active$/i.test(first(user, ['Status', 'status'], 'Active')));
assert(admin, 'No active HR or Super Admin user is available for EMP Master lifecycle verification.');

const adminId = first(admin, ['Employee ID', 'User ID', 'employeeId', 'userId']);
const role = first(admin, ['Role', 'role']);
const token = createAccessToken({ kind: 'employee', id: adminId, role });
const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
const code = `VERIFY_EMP_${Date.now()}`;
const password = `Verify@${Date.now()}`;

async function post(path, body) {
  const response = await fetch(`${baseUrl}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
  const payload = await response.json();
  assert(response.ok && payload.success, `${path} failed: ${payload.message || response.status}`);
  return payload;
}

try {
  const createPayload = await post('/api/emp-master/save', {
    category: 'EMP',
    formData: {
      Category: 'EMP',
      'EMP Code': code,
      'User ID': code,
      Name: 'EMP Verification Record',
      Password: password,
      Department: 'Quality',
      Designation: 'Verification',
      Status: 'Active',
      'Phone No': '9000000000',
      'Official mail id if any': `${code.toLowerCase()}@example.test`
    },
    filePayloads: {
      offer: {
        base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
        mimeType: 'image/png',
        fileName: `${code}_offer.png`
      }
    }
  });
  const offerLink = first(createPayload.item, ['OFFER LETTER LINK']);
  assert(
    isExpectedR2Url(offerLink, 'emp_documents'),
    'Employee document upload should persist to the configured R2 emp_documents path.'
  );

  let empRows = await listRows('EmpMaster');
  let userRows = await listRows('User');
  const createdEmp = empRows.find((row) => first(row, ['EMP Code', 'Employee ID']) === code);
  const createdUser = userRows.find((row) => first(row, ['Employee ID', 'User ID', 'employeeId']) === code);
  assert(createdEmp, 'Saved employee was not persisted in emp_master_legacy.');
  assert(createdUser, 'Saved employee login was not synchronized to users_legacy.');
  assert(!createdEmp.Password && !createdEmp.password, 'Plain-text portal password leaked into EMP Master data.');
  assert(/^\$2[aby]\$/.test(first(createdUser, ['Password', 'password'])), 'Employee login password was not hashed.');

  await post('/api/emp-master/save', {
    category: 'EMP',
    formData: {
      Category: 'EMP',
      'EMP Code': code,
      'User ID': code,
      Name: 'EMP Verification Record',
      Department: 'Quality Updated',
      Designation: 'Verification',
      Status: 'Active',
      'Phone No': ''
    },
    filePayloads: {}
  });

  empRows = await listRows('EmpMaster');
  const updatedEmp = empRows.find((row) => first(row, ['EMP Code', 'Employee ID']) === code);
  assert(updatedEmp?.Department === 'Quality Updated', 'EMP Master edit did not persist to MongoDB.');
  assert(updatedEmp?.['Phone No'] === '9000000000', 'Blank edit unexpectedly erased an existing EMP Master value.');

  const listPayload = await post('/api/emp-master/data', { category: 'EMP' });
  assert(listPayload.data.some((row) => first(row, ['EMP Code', 'Employee ID']) === code), 'Saved employee was not returned by the EMP tab API.');
  console.log(`EMP Master Mongo lifecycle verification passed for temporary record ${code}.`);
} finally {
  const identityQuery = {
    $or: [
      { legacyId: code },
      { 'data.EMP Code': code },
      { 'data.Employee ID': code },
      { 'data.User ID': code },
      { 'data.employeeId': code }
    ]
  };
  await Promise.all([
    LegacyModels.EmpMaster.deleteMany(identityQuery),
    LegacyModels.User.deleteMany(identityQuery)
  ]);
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
}
