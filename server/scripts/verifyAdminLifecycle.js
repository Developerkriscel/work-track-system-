import 'dotenv/config';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { connectDatabase } from '../config/database.js';
import { createAccessToken } from '../middleware/auth.middleware.js';
import { LegacyModels } from '../models/legacyModels.js';
import { listRows } from '../services/legacyStore.service.js';

const baseUrl = process.env.PARITY_URL || `http://localhost:${process.env.PORT || 5000}`;
const failures = [];
const cleanupUserIds = new Set();
const cleanupEmpCodes = new Set();

const assert = (condition, message) => {
  if (!condition) failures.push(message);
};

const safe = (value = '') => String(value ?? '').trim();
const first = (row = {}, keys = [], fallback = '') => keys.map((key) => row?.[key]).find((value) => safe(value)) ?? fallback;

function tempId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`.toUpperCase();
}

async function post(path, headers, body = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  let payload;
  try {
    payload = await response.json();
  } catch {
    payload = { success: false, message: `Non-JSON response from ${path}` };
  }
  return { response, payload };
}

await connectDatabase();

const seedUsers = await listRows('User');
const seedAdmin = seedUsers.find((row) => /^(hr|super admin)$/i.test(first(row, ['Role', 'role'])) && /active/i.test(first(row, ['Status', 'status'], 'Active')));
assert(!!seedAdmin, 'No active HR or Super Admin user is available for admin verification.');

const adminId = first(seedAdmin, ['Employee ID', 'User ID', 'employeeId', 'userId']);
const adminRole = first(seedAdmin, ['Role', 'role']);
const token = createAccessToken({ kind: 'employee', id: adminId, role: adminRole });
const headers = { Authorization: `Bearer ${token}` };

try {
  const usersResult = await post('/api/admin/users', headers, { adminId });
  assert(usersResult.response.ok && usersResult.payload?.success, `Admin users list failed: ${usersResult.payload?.message || usersResult.response.status}`);
  assert(Array.isArray(usersResult.payload.data), 'Admin users payload is missing data array.');
  assert(usersResult.payload.data.every((row) => !('Password' in row) && !('password' in row)), 'Admin users list should not expose passwords.');

  const managersResult = await post('/api/admin/managers', headers, {});
  assert(managersResult.response.ok, `Managers list failed: ${managersResult.payload?.message || managersResult.response.status}`);
  assert(Array.isArray(managersResult.payload), 'Managers response should be an array.');
  assert(
    managersResult.payload.some((row) => /^(hr|super admin)$/i.test(String(row.role || row.Role || ''))),
    'Managers list should include elevated roles.'
  );

  const nextCodeResult = await post('/api/admin/next-code', headers, { category: 'EMP' });
  assert(nextCodeResult.response.ok && nextCodeResult.payload?.success, 'Next code endpoint failed.');
  const nextCode = String(nextCodeResult.payload.code || nextCodeResult.payload.nextCode || '').trim();
  assert(/^KRIS_\d{3}$/.test(nextCode), 'Next code endpoint did not return a legacy-compatible code.');

  const tempAdminId = tempId('ADM_USER');
  cleanupUserIds.add(tempAdminId);
  const plainPassword = `Verify@${Date.now()}`;
  const saveUserResult = await post('/api/admin/save-user', headers, {
    userData: {
      'Employee ID': tempAdminId,
      'Employee Name': 'Admin Verification User',
      Role: 'Manager',
      Department: 'Operations',
      Status: 'Active',
      'Manager ID': adminId,
      'Task Approver': adminId,
      'Mobile Number': '9000000002',
      Email: `${tempAdminId.toLowerCase()}@example.test`,
      Password: plainPassword
    }
  });
  assert(saveUserResult.response.ok && saveUserResult.payload?.success, `save-user failed: ${saveUserResult.payload?.message || saveUserResult.response.status}`);

  const userDoc = await LegacyModels.User.findOne({ $or: [{ 'data.Employee ID': tempAdminId }, { legacyId: tempAdminId }] }).lean();
  assert(!!userDoc, 'Saved admin user was not persisted in MongoDB.');
  assert(userDoc?.data?.Role === 'Manager', 'Saved admin user role did not persist.');
  assert(await bcrypt.compare(plainPassword, String(userDoc?.data?.Password || '')), 'Saved admin user password was not hashed.');

  const tempEmpCode = nextCode;
  cleanupEmpCodes.add(tempEmpCode);
  const portalPassword = `Portal@${Date.now()}`;
  const empMasterResult = await post('/api/admin/save-emp-master', headers, {
    category: 'EMP',
    formData: {
      Category: 'EMP',
      'EMP Code': tempEmpCode,
      'User ID': tempEmpCode,
      Name: 'Admin EMP Verification',
      Department: 'Quality',
      Designation: 'Verifier',
      Status: 'Active',
      'Phone No': '9000000003',
      'Official mail id if any': `${tempEmpCode.toLowerCase()}@example.test`,
      Password: portalPassword
    },
    filePayloads: {}
  });
  assert(empMasterResult.response.ok && empMasterResult.payload?.success, `save-emp-master failed: ${empMasterResult.payload?.message || empMasterResult.response.status}`);

  const empDoc = await LegacyModels.EmpMaster.findOne({ $or: [{ 'data.EMP Code': tempEmpCode }, { legacyId: tempEmpCode }] }).lean();
  const syncUserDoc = await LegacyModels.User.findOne({ $or: [{ 'data.Employee ID': tempEmpCode }, { legacyId: tempEmpCode }] }).lean();
  assert(!!empDoc, 'Saved EMP Master record was not persisted in MongoDB.');
  assert(!!syncUserDoc, 'EMP Master save did not sync a login user.');
  assert(syncUserDoc?.data?.Role === 'User', 'EMP Master sync should preserve the login user role as User.');
  assert(await bcrypt.compare(portalPassword, String(syncUserDoc?.data?.Password || '')), 'EMP Master sync password was not hashed.');

  const empDataResult = await post('/api/admin/emp-master', headers, { category: 'Master' });
  assert(empDataResult.response.ok && empDataResult.payload?.success, 'EMP Master list endpoint failed.');
  assert(Array.isArray(empDataResult.payload.data), 'EMP Master data payload is missing data array.');
  assert(
    empDataResult.payload.data.some((row) => String(first(row, ['EMP Code', 'Employee ID', 'User ID'])) === tempEmpCode),
    'EMP Master list did not include the saved record.'
  );

  console.log('Admin user and EMP Master lifecycle verification passed.');
} catch (error) {
  failures.push(`Admin verification failed: ${error.message}`);
} finally {
  if (cleanupUserIds.size) {
    await LegacyModels.User.deleteMany({
      $or: [...cleanupUserIds].map((employeeId) => ({
        $or: [{ legacyId: employeeId }, { 'data.Employee ID': employeeId }, { 'data.User ID': employeeId }]
      }))
    });
  }

  if (cleanupEmpCodes.size) {
    await LegacyModels.EmpMaster.deleteMany({
      $or: [...cleanupEmpCodes].map((empCode) => ({
        $or: [{ legacyId: empCode }, { 'data.EMP Code': empCode }, { 'data.Employee ID': empCode }, { 'data.User ID': empCode }]
      }))
    });
  }

  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}

if (failures.length) {
  console.error(failures.join('\n---\n'));
  process.exit(1);
}
