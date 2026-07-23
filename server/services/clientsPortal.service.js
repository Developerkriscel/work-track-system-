import { listRows, upsertRow } from './legacyStore.service.js';
import { LegacyModels } from '../models/legacyModels.js';

const safe = (value) => String(value ?? '').trim();
const eq = (left, right) => safe(left).toLowerCase() === safe(right).toLowerCase();
const first = (row, keys, fallback = '') => keys.map((key) => row?.[key]).find((value) => safe(value)) ?? fallback;
const ok = (payload = {}) => ({ success: true, ...payload });
const fail = (message) => ({ success: false, message });

function publicClientRow(row = {}) {
  const { Password, password, ...publicRow } = row;
  return publicRow;
}

function clientIdFromRow(row = {}) {
  return first(row, ['Client_Id', 'Client ID', 'CustomerID', 'clientId', 'customerId']);
}

function normalizeClientPortalPayload(clientData = {}, resolvedId = '') {
  return {
    ...clientData,
    Client_Id: resolvedId || first(clientData, ['Client_Id', 'Client ID', 'CustomerID'], ''),
    'Client ID': resolvedId || first(clientData, ['Client ID', 'Client_Id', 'CustomerID'], ''),
    'Client Name': first(clientData, ['Client Name', 'CustomerName', 'clientName', 'name'], ''),
    'Mobile Number': first(clientData, ['Mobile Number', 'Contact', 'mobile'], ''),
    'Client Email ID': first(clientData, ['Client Email ID', 'Email', 'email'], ''),
    Address: first(clientData, ['Address', 'address'], ''),
    Status: first(clientData, ['Status', 'status'], 'Active'),
    Password: first(clientData, ['Password', 'password'], ''),
    'Detail Shared': first(clientData, ['Detail Shared', 'detailShared'], ''),
    Services: first(clientData, ['Services', 'services'], '')
  };
}

function nextClientPortalId(clients = []) {
  const max = clients.reduce((highest, client) => {
    const raw = first(client, ['Client_Id', 'Client ID', 'CustomerID'], '');
    const match = String(raw).match(/(\d+)$/);
    return match ? Math.max(highest, Number(match[1])) : highest;
  }, 100);
  return `CLIENT${max + 1}`;
}

async function canManageClientsPortal(adminId = '') {
  const cleanId = safe(adminId).toUpperCase();
  if (!cleanId) return false;
  const users = await listRows('User');
  const user = users.find((item) => eq(first(item, ['Employee ID', 'User ID', 'employeeId']), cleanId));
  const role = safe(first(user, ['Role', 'role']));
  return /^(admin|super admin)$/i.test(role);
}

export async function getClientsPortalData() {
  const clients = await listRows('Client');
  return ok({
    data: clients.map((client) => publicClientRow(normalizeClientPortalPayload(client, clientIdFromRow(client))))
  });
}

export async function saveClientPortalData(clientData = {}, adminId = '', role = '') {
  const id = first(clientData, ['Client_Id', 'Client ID', 'CustomerID'], '');
  if (!safe(id) && !/super admin/i.test(safe(role))) {
    return fail('Access Denied: Only Super Admin can add new clients.');
  }

  if (!(await canManageClientsPortal(adminId))) {
    return fail('Access Denied: Only authorized admin users can update clients.');
  }

  const clients = await listRows('Client');
  const resolvedId = safe(id) || nextClientPortalId(clients);
  const normalized = normalizeClientPortalPayload(clientData, resolvedId);
  if (!safe(normalized['Client Name'])) return fail('Client Name is required.');
  if (!safe(id) && !safe(normalized.Password)) return fail('Password is required when adding a client.');
  if (safe(normalized['Client Email ID']) && !/^\S+@\S+\.\S+$/.test(normalized['Client Email ID'])) {
    return fail('Please enter a valid client email address.');
  }
  const row = await upsertRow('Client', 'Client_Id', resolvedId, normalized);
  return ok({ message: 'Client saved.', item: publicClientRow(row) });
}

export async function deleteClientPortalData(clientId, adminId = '') {
  if (!(await canManageClientsPortal(adminId))) {
    return fail('Access Denied: Only authorized admin users can delete clients.');
  }

  const clients = await listRows('Client');
  const existing = clients.find((client) => eq(clientIdFromRow(client), clientId));
  if (!existing) return fail('Client not found.');
  const resolvedId = clientIdFromRow(existing);
  const row = publicClientRow(normalizeClientPortalPayload(existing, resolvedId));
  const filter = existing._legacyId
    ? { legacyId: existing._legacyId }
    : { $or: [{ 'data.Client_Id': resolvedId }, { 'data.Client ID': resolvedId }, { 'data.clientId': resolvedId }] };
  await LegacyModels.Client.deleteMany(filter);
  return ok({ message: 'Client deleted permanently.', item: row });
}
