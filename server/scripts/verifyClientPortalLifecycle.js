import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDatabase } from '../config/database.js';
import { LegacyModels } from '../models/legacyModels.js';
import { insertRow, listRows } from '../services/legacyStore.service.js';
import {
  createBulkTicketsWithDetails,
  getClientInvoices,
  getClientReportData,
  getClientTickets,
  getMessagesForTask,
  getTicketDetails,
  markTicketMessagesAsRead,
  postMessage,
  submitClientResponse,
  updateTicketStatusByClient
} from '../services/clientPortal.service.js';
import {
  addClientRemarkToHistoryEntry,
  getClientSocialTasks,
  getSocialTaskDetails,
  getSocialTaskHistory,
  updateSocialPostStatusByClient
} from '../services/clientSocial.service.js';
import {
  deleteClientPortalData,
  getClientsPortalData,
  saveClientPortalData
} from '../services/clientsPortal.service.js';

const prefix = `CLIENT_PORTAL_VERIFY_${Date.now()}`;
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const first = (row, keys, fallback = '') => keys.map((key) => row?.[key]).find((value) => String(value ?? '').trim()) ?? fallback;

await connectDatabase();
let ticketIds = [];
let socialId = `${prefix}_SOCIAL`;
let historyId = `${prefix}_HISTORY`;
let clientCrudId = `${prefix}_CLIENT`;

async function cleanup() {
  await Promise.all([
    LegacyModels.Ticket.deleteMany({ 'data.Ticket ID': { $in: ticketIds } }),
    LegacyModels.Message.deleteMany({ 'data.TaskID': { $in: ticketIds } }),
    LegacyModels.SocialMedia.deleteMany({ 'data.Post ID': socialId }),
    LegacyModels.SocialHistory.deleteMany({ 'data.Post ID': socialId }),
    LegacyModels.Client.deleteMany({ $or: [{ legacyId: clientCrudId }, { 'data.Client_Id': clientCrudId }, { 'data.clientId': clientCrudId }] })
  ]);
}

try {
  const clients = await listRows('Client');
  const activeClients = clients.filter((row) => !/^inactive$/i.test(String(row.Status || 'Active')));
  const client = activeClients[0];
  const otherClient = activeClients.find((row) => String(row.Client_Id || row['Client ID']).toLowerCase() !== String(client?.Client_Id || client?.['Client ID']).toLowerCase());
  assert(client, 'No active client exists for client-portal lifecycle verification.');
  const clientId = first(client, ['Client_Id', 'Client ID', 'CustomerID', 'clientId']);
  const otherClientId = first(otherClient, ['Client_Id', 'Client ID', 'CustomerID', 'clientId'], 'NOT_A_CLIENT');
  assert(clientId, 'Active client has no canonical client ID.');
  const clientInfo = { Client_Id: clientId, 'Client ID': clientId, 'Client Name': first(client, ['Client Name', 'CustomerName', 'name'], clientId) };

  const publicClients = await getClientsPortalData();
  assert(publicClients.success && publicClients.data.every((row) => !row.Password && !row.password), 'Client list exposes a client password.');
  assert(publicClients.data.some((row) => row.Client_Id === clientId && row['Client Name']), 'Client list did not normalize legacy client fields.');

  const admins = await listRows('User');
  const superAdmin = admins.find((row) => /^super admin$/i.test(String(row.Role || row.role || '')));
  assert(superAdmin, 'No Super Admin exists for client CRUD verification.');
  const superAdminId = first(superAdmin, ['Employee ID', 'User ID', 'employeeId']);
  const added = await saveClientPortalData({ Client_Id: clientCrudId, 'Client Name': `${prefix} client`, Password: 'LifecyclePass123', Status: 'Active' }, superAdminId, 'Super Admin');
  assert(added.success && added.item?.Client_Id === clientCrudId, 'Client add CRUD failed.');
  const edited = await saveClientPortalData({ Client_Id: clientCrudId, 'Client Name': `${prefix} edited`, Status: 'Active' }, superAdminId, 'Super Admin');
  assert(edited.success && edited.item?.['Client Name'] === `${prefix} edited`, 'Client edit CRUD failed.');
  const deactivated = await deleteClientPortalData(clientCrudId, superAdminId);
  assert(deactivated.success && !(await getClientsPortalData()).data.some((row) => row.Client_Id === clientCrudId), 'Client delete CRUD failed.');

  const created = await createBulkTicketsWithDetails([
    { category: 'Verification', description: `${prefix} ticket`, priority: 'Normal', completionDate: '', attachments: [] }
  ], clientInfo);
  assert(created.success && created.data?.length === 1, 'Client ticket creation failed.');
  ticketIds = created.data.map((row) => row['Ticket ID']);
  const ticketId = ticketIds[0];

  assert((await getClientTickets(clientId)).data.some((row) => row['Ticket ID'] === ticketId), 'Created ticket is not visible to its client.');
  assert(!(await getClientTickets(otherClientId)).data.some((row) => row['Ticket ID'] === ticketId), 'Created ticket leaked to another client.');
  assert((await getTicketDetails(ticketId, clientId)).success, 'Client ticket details failed.');
  assert(!(await getTicketDetails(ticketId, otherClientId)).success, 'Client ticket details leaked across clients.');
  assert((await updateTicketStatusByClient(ticketId, 'Approved', 'Client approval', clientId)).success, 'Client ticket status update failed.');
  assert((await postMessage(ticketId, `${prefix} message`, clientInfo)).success, 'Client ticket message failed.');
  assert((await getMessagesForTask(ticketId, clientId)).messages.some((row) => row.Message === `${prefix} message`), 'Client ticket message was not persisted.');
  assert((await markTicketMessagesAsRead(ticketId, clientId)).success, 'Client message read-state update failed.');
  assert((await submitClientResponse(ticketId, `${prefix} response`, null, clientInfo)).success, 'Client ticket response failed.');
  assert((await getClientReportData(clientId)).details.some((row) => row.ID === ticketId), 'Client report does not include the ticket.');
  assert(Array.isArray((await getClientInvoices(clientId)).data), 'Client invoice contract failed.');

  await insertRow('SocialMedia', {
    'Post ID': socialId,
    Client_Id: clientId,
    'Client Name': first(client, ['Client Name', 'CustomerName', 'name'], clientId),
    Platform: 'Verification',
    Description: `${prefix} social task`,
    Status: 'Pending Approval',
    'Planned Post Date': new Date().toISOString().slice(0, 10)
  });
  await insertRow('SocialHistory', { 'History ID': historyId, 'Post ID': socialId, Remarks: 'Initial', 'Status Change': 'Pending Approval' });
  assert((await getClientSocialTasks(clientId)).data.some((row) => row['Post ID'] === socialId), 'Client social task is not visible.');
  assert((await getSocialTaskDetails(socialId, clientId)).success, 'Client social details failed.');
  assert(!(await getSocialTaskDetails(socialId, otherClientId)).success, 'Client social details leaked across clients.');
  assert((await updateSocialPostStatusByClient(socialId, 'Approved by Client', 'Looks good', clientInfo)).success, 'Client social status update failed.');
  assert((await addClientRemarkToHistoryEntry(historyId, `${prefix} remark`, clientId)).success, 'Client social remark failed.');
  assert((await getSocialTaskHistory(socialId, clientId)).history.length >= 2, 'Client social history was not persisted.');
  assert(!(await getSocialTaskHistory(socialId, otherClientId)).success, 'Client social history leaked across clients.');

  console.log(`Client portal lifecycle verification passed for ${clientId}.`);
} finally {
  await cleanup();
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
}
