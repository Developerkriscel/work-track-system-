import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { listMongoRows, upsertRow } from './legacyStore.service.js';
import { createAccessToken } from '../middleware/auth.middleware.js';
import { saveBase64File } from './fileStorage.service.js';

const safe = (value) => String(value ?? '').trim();
const eq = (left, right) => safe(left).toLowerCase() === safe(right).toLowerCase();
const first = (row, keys, fallback = '') => keys.map((key) => row?.[key]).find((value) => safe(value)) ?? fallback;

function assertMongoReady() {
  if (mongoose.connection.readyState !== 1) {
    throw new Error('MongoDB is not connected. Login requires live MongoDB data.');
  }
}

function isActive(row = {}) {
  return eq(first(row, ['Status', 'status'], 'Active'), 'Active');
}

async function passwordMatches(inputPassword, storedPassword) {
  const input = safe(inputPassword);
  const stored = safe(storedPassword);
  if (!input || !stored) return false;
  if (/^\$2[aby]\$\d{2}\$/.test(stored)) {
    return bcrypt.compare(input, stored);
  }
  return input === stored;
}

async function hashPassword(value) {
  return bcrypt.hash(safe(value), 10);
}

function hashedCredentialRow(row, hashedPassword) {
  const next = { ...row, Password: hashedPassword };
  delete next.password;
  return next;
}

function isHashedPassword(value) {
  return /^\$2[aby]\$\d{2}\$/.test(safe(value));
}

function accessProfileForRole(roleValue) {
  const role = safe(roleValue) || 'User';
  const elevatedRoles = ['Admin', 'Super Admin', 'HR', 'Manager'];
  return {
    role,
    canApprove: elevatedRoles.includes(role),
    canViewReports: elevatedRoles.includes(role),
    canManageClients: elevatedRoles.includes(role),
    canManageUsers: ['HR', 'Super Admin'].includes(role),
    canManageEmployeeMaster: ['HR', 'Super Admin'].includes(role),
    canManageForms: role !== 'User'
  };
}

export function normalizeEmployee(row = {}) {
  const employeeId = first(row, ['Employee ID', 'User ID', 'EMP Code', 'employeeId', 'EmpID']);
  const employeeName = first(row, ['Employee Name', 'Name', 'Full Name', 'name', 'employeeName'], employeeId);
  const role = first(row, ['Role', 'role', 'Designation'], 'User');
  const status = first(row, ['Status', 'status'], 'Active');
  const managerId = first(row, ['Manager ID', 'Manager', 'managerId', 'Reporting Manager'], '');
  const normalized = {
    ...row,
    'Employee ID': employeeId,
    'User ID': first(row, ['User ID', 'Employee ID', 'EMP Code', 'employeeId'], employeeId),
    'Employee Name': employeeName,
    Name: first(row, ['Name', 'Employee Name', 'Full Name', 'employeeName'], employeeName),
    Role: role,
    Status: status,
    'Manager ID': managerId,
    Manager: first(row, ['Manager', 'Manager ID', 'managerId', 'Reporting Manager'], managerId),
    Department: first(row, ['Department', 'department'], ''),
    Email: first(row, ['Email', 'email', 'Email ID', 'emailId'], ''),
    'Phone No': first(row, ['Mobile Number', 'Mobile No', 'Phone No', 'phone', 'contact'], ''),
    Avatar: first(row, ['Avatar', 'Photo', 'photo', 'avatar'], '')
  };
  delete normalized.Password;
  delete normalized.password;
  normalized.access = accessProfileForRole(role);
  return normalized;
}

export function normalizeClient(row = {}) {
  const clientId = first(row, ['Client_Id', 'Client ID', 'CustomerID', 'clientId']);
  const clientName = first(row, ['Client Name', 'CustomerName', 'Name', 'clientName', 'name'], clientId);
  const status = first(row, ['Status', 'status'], 'Active');
  const normalized = {
    ...row,
    Client_Id: clientId,
    'Client ID': first(row, ['Client ID', 'Client_Id', 'CustomerID', 'clientId'], clientId),
    CustomerID: first(row, ['CustomerID', 'Client_Id', 'Client ID', 'clientId'], clientId),
    'Client Name': clientName,
    CustomerName: first(row, ['CustomerName', 'Client Name', 'Name', 'clientName'], clientName),
    Status: status
  };
  delete normalized.Password;
  delete normalized.password;
  normalized.access = {
    role: 'Client',
    canOpenClientPortal: true
  };
  return normalized;
}

export async function authenticateEmployeeFromMongo(employeeId, password) {
  assertMongoReady();
  const users = await listMongoRows('User');
  const user = users.find((item) => {
    const candidateId = first(item, ['Employee ID', 'User ID', 'EMP Code', 'employeeId', 'EmpID']);
    return eq(candidateId, employeeId);
  });
  if (!user || !isActive(user)) return null;
  const storedPassword = first(user, ['Password', 'password']);
  if (!(await passwordMatches(password, storedPassword))) return null;
  if (!isHashedPassword(storedPassword)) {
    await upsertRow('User', 'Employee ID', employeeId, hashedCredentialRow(user, await hashPassword(password)));
  }
  return normalizeEmployee(user);
}

export async function getEmployeeSessionFromMongo(employeeId) {
  assertMongoReady();
  const users = await listMongoRows('User');
  const user = users.find((item) => {
    const candidateId = first(item, ['Employee ID', 'User ID', 'EMP Code', 'employeeId', 'EmpID']);
    return eq(candidateId, employeeId);
  });
  if (!user || !isActive(user)) return null;
  return normalizeEmployee(user);
}

export async function authenticateClientFromMongo(clientId, password) {
  assertMongoReady();
  const clients = await listMongoRows('Client');
  const client = clients.find((item) => {
    const candidateId = first(item, ['Client_Id', 'Client ID', 'CustomerID', 'clientId']);
    return eq(candidateId, clientId);
  });
  if (!client || !isActive(client)) return null;
  const storedPassword = first(client, ['Password', 'password']);
  if (!(await passwordMatches(password, storedPassword))) return null;
  if (!isHashedPassword(storedPassword)) {
    await upsertRow('Client', 'Client_Id', clientId, hashedCredentialRow(client, await hashPassword(password)));
  }
  return normalizeClient(client);
}

export async function getClientSessionFromMongo(clientId) {
  assertMongoReady();
  const clients = await listMongoRows('Client');
  const client = clients.find((item) => {
    const candidateId = first(item, ['Client_Id', 'Client ID', 'CustomerID', 'clientId']);
    return eq(candidateId, clientId);
  });
  if (!client || !isActive(client)) return null;
  return normalizeClient(client);
}

export async function changeEmployeePasswordFromMongo(employeeId, currentPassword, nextPassword) {
  assertMongoReady();
  const users = await listMongoRows('User');
  const user = users.find((item) => {
    const candidateId = first(item, ['Employee ID', 'User ID', 'EMP Code', 'employeeId', 'EmpID']);
    return eq(candidateId, employeeId);
  });
  if (!user || !isActive(user)) return null;

  const storedPassword = first(user, ['Password', 'password']);
  if (!(await passwordMatches(currentPassword, storedPassword))) return null;

  const hashedPassword = await hashPassword(nextPassword);
  const updated = await upsertRow('User', 'Employee ID', employeeId, hashedCredentialRow(user, hashedPassword));
  return normalizeEmployee(updated);
}

export function employeeToken(user) {
  return createAccessToken({
    kind: 'employee',
    id: user?.['Employee ID'] || user?.employeeId,
    role: user?.Role || user?.role
  });
}

export function clientToken(client) {
  return createAccessToken({ kind: 'client', id: client?.Client_Id || client?.clientId, role: 'Client' });
}

export async function updateEmployeeProfileFromMongo(employeeId, { avatarBase64, email, phone }) {
  assertMongoReady();
  const users = await listMongoRows('User');
  const user = users.find((item) => {
    const candidateId = first(item, ['Employee ID', 'User ID', 'EMP Code', 'employeeId', 'EmpID']);
    return eq(candidateId, employeeId);
  });
  if (!user || !isActive(user)) return null;

  const updateData = {};
  if (avatarBase64) {
    updateData.Avatar = await saveBase64File(
      { base64: avatarBase64, fileName: `${employeeId}_avatar.jpg` },
      'user_avatars'
    );
  }
  if (email !== undefined) {
    updateData.Email = email;
  }
  if (phone !== undefined) {
    updateData['Phone No'] = phone;
    updateData['Mobile Number'] = phone; // Ensure legacy keys are updated
  }

  const updated = await upsertRow('User', 'Employee ID', employeeId, { ...user, ...updateData });
  return normalizeEmployee(updated);
}
