import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { connectDatabase } from '../config/database.js';
import { LegacyModels } from '../models/legacyModels.js';
import {
  authenticateClientFromMongo,
  authenticateEmployeeFromMongo,
  changeEmployeePasswordFromMongo,
  clientToken,
  employeeToken,
  getClientSessionFromMongo,
  getEmployeeSessionFromMongo,
  normalizeClient,
  normalizeEmployee,
  updateEmployeeProfileFromMongo
} from '../services/auth.service.js';
import { verifyAccessToken } from '../middleware/auth.middleware.js';
import { upsertRow } from '../services/legacyStore.service.js';

const failures = [];
const cleanupUsers = new Set();
const cleanupClients = new Set();
const cleanupFiles = new Set();

const assert = (condition, message) => {
  if (!condition) failures.push(message);
};

function tempId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`.toUpperCase();
}

async function seedEmployee(employeeId, name, password) {
  cleanupUsers.add(employeeId);
  await upsertRow('User', 'Employee ID', employeeId, {
    'Employee ID': employeeId,
    'User ID': employeeId,
    'Employee Name': name,
    Name: name,
    Role: 'User',
    Status: 'Active',
    Department: 'Operations',
    Password: password
  });
}

async function seedClient(clientId, name, password) {
  cleanupClients.add(clientId);
  await upsertRow('Client', 'Client_Id', clientId, {
    Client_Id: clientId,
    'Client ID': clientId,
    'Client Name': name,
    CustomerName: name,
    Status: 'Active',
    Password: password
  });
}

await connectDatabase();

const employeeId = tempId('AUTH_EMP');
const clientId = tempId('AUTH_CLIENT');
const employeeName = 'Auth Verifier';
const clientName = 'Client Auth Verifier';
const initialEmployeePassword = 'OldPass@123';
const nextEmployeePassword = 'NewPass@456';
const initialClientPassword = 'ClientOld@123';

try {
  await seedEmployee(employeeId, employeeName, initialEmployeePassword);
  await seedClient(clientId, clientName, initialClientPassword);

  const employeeLogin = await authenticateEmployeeFromMongo(employeeId, initialEmployeePassword);
  assert(!!employeeLogin, 'Employee login should succeed with a valid password.');
  assert(employeeLogin?.['Employee ID'] === employeeId, 'Employee login lost the employee ID.');
  assert(normalizeEmployee(employeeLogin).access?.role === 'User', 'Employee normalization should include role access metadata.');

  const employeeTokenValue = employeeToken(employeeLogin);
  const employeeClaims = verifyAccessToken(employeeTokenValue);
  assert(employeeClaims?.kind === 'employee', 'Employee token should be issued with employee kind.');
  assert(employeeClaims?.sub === employeeId, 'Employee token should contain the employee ID.');

  const employeeSession = await getEmployeeSessionFromMongo(employeeId);
  assert(employeeSession?.['Employee Name'] === employeeName, 'Employee session should return the normalized profile.');
  assert(employeeSession?.access?.role === 'User', 'Employee session should preserve access metadata.');

  const passwordChanged = await changeEmployeePasswordFromMongo(employeeId, initialEmployeePassword, nextEmployeePassword);
  assert(!!passwordChanged, 'Employee password change should succeed.');

  const oldLogin = await authenticateEmployeeFromMongo(employeeId, initialEmployeePassword);
  assert(!oldLogin, 'Old employee password should stop working after a password change.');

  const newLogin = await authenticateEmployeeFromMongo(employeeId, nextEmployeePassword);
  assert(!!newLogin, 'New employee password should work after a password change.');

  const updatedProfile = await updateEmployeeProfileFromMongo(employeeId, {
    avatarBase64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    email: 'auth.verifier@kriscel.test',
    phone: '9999999999'
  });
  assert(!!updatedProfile, 'Employee profile update should succeed.');
  assert(String(updatedProfile.Avatar || '').startsWith('/uploads/user_avatars/'), 'Profile avatar should persist to uploads.');
  assert(updatedProfile.Email === 'auth.verifier@kriscel.test', 'Profile email should persist.');
  assert(updatedProfile['Phone No'] === '9999999999', 'Profile phone should persist.');

  const avatarPath = String(updatedProfile.Avatar || '').replace(/^\//, '');
  if (avatarPath) cleanupFiles.add(path.join(process.cwd(), avatarPath.replace(/\//g, path.sep)));

  const profileSession = await getEmployeeSessionFromMongo(employeeId);
  assert(profileSession?.Email === 'auth.verifier@kriscel.test', 'Updated employee email should be visible in session data.');
  assert(profileSession?.['Phone No'] === '9999999999', 'Updated employee phone should be visible in session data.');

  const clientLogin = await authenticateClientFromMongo(clientId, initialClientPassword);
  assert(!!clientLogin, 'Client login should succeed with a valid password.');
  assert(clientLogin?.Client_Id === clientId, 'Client login should retain the client ID.');

  const clientTokenValue = clientToken(clientLogin);
  const clientClaims = verifyAccessToken(clientTokenValue);
  assert(clientClaims?.kind === 'client', 'Client token should be issued with client kind.');
  assert(clientClaims?.sub === clientId, 'Client token should contain the client ID.');

  const clientSession = await getClientSessionFromMongo(clientId);
  assert(clientSession?.['Client Name'] === clientName, 'Client session should return the normalized client profile.');
  assert(normalizeClient(clientSession).access?.canOpenClientPortal === true, 'Client normalization should preserve portal access metadata.');
} catch (error) {
  failures.push(`Auth/settings verification failed: ${error.message}`);
} finally {
  if (cleanupUsers.size) {
    await LegacyModels.User.deleteMany({
      $or: [...cleanupUsers].map((employeeIdValue) => ({
        $or: [{ legacyId: employeeIdValue }, { 'data.Employee ID': employeeIdValue }, { 'data.User ID': employeeIdValue }]
      }))
    });
  }

  if (cleanupClients.size) {
    await LegacyModels.Client.deleteMany({
      $or: [...cleanupClients].map((clientIdValue) => ({
        $or: [{ legacyId: clientIdValue }, { 'data.Client_Id': clientIdValue }, { 'data.Client ID': clientIdValue }]
      }))
    });
  }

  cleanupFiles.forEach((filePath) => {
    try {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch {
      // Best-effort cleanup only.
    }
  });

  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}

if (failures.length) {
  console.error(failures.join('\n---\n'));
  process.exit(1);
}

console.log('Auth and settings verification passed.');
