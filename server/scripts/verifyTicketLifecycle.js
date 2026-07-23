import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDatabase } from '../config/database.js';
import { LegacyModels } from '../models/legacyModels.js';
import { insertRow, listRows } from '../services/legacyStore.service.js';
import {
  createTicket,
  getTaskMessages,
  markTicketMessagesAsRead,
  postTaskMessage,
  processClientResponse,
  reassignTicket,
  updateTicket,
  updateTicketSchedule
} from '../services/ticket.service.js';

const prefix = `TICKET_VERIFY_${Date.now()}`;
const today = new Date().toISOString().slice(0, 10);
const assert = (condition, message) => { if (!condition) throw new Error(message); };

await connectDatabase();
let actorId = '';
let ticketId = '';

async function cleanup() {
  const [tickets, history, messages, attendance] = await Promise.all([
    LegacyModels.Ticket.deleteMany({ 'data.Ticket ID': ticketId || /^TICKET_VERIFY_/ }),
    LegacyModels.TicketHistory.deleteMany({ 'data.Ticket ID': ticketId || /^TICKET_VERIFY_/ }),
    LegacyModels.Message.deleteMany({ 'data.TaskID': ticketId || /^TICKET_VERIFY_/ }),
    LegacyModels.Attendance.deleteMany({ 'data.AttendanceID': new RegExp(`^${prefix}`) })
  ]);
  return tickets.deletedCount + history.deletedCount + messages.deletedCount + attendance.deletedCount;
}

try {
  const users = await listRows('User');
  const actor = users.find((row) => String(row['Employee ID'] || row.employeeId).toUpperCase() === 'NL106')
    || users.find((row) => String(row.Status || row.status || 'Active').toLowerCase() === 'active');
  assert(actor, 'No active employee found for ticket lifecycle verification.');
  actorId = actor['Employee ID'] || actor.employeeId;
  const target = users.find((row) => String(row['Employee ID'] || row.employeeId).toUpperCase() === 'AS101')
    || users.find((row) => String(row['Employee ID'] || row.employeeId).toUpperCase() !== String(actorId).toUpperCase());
  assert(target, 'No active reassignment target found.');
  const targetId = target['Employee ID'] || target.employeeId;

  await insertRow('Attendance', {
    AttendanceID: `${prefix}_ATT`,
    'Employee ID': actorId,
    EmpID: actorId,
    'Employee Name': actor['Employee Name'] || actor.name || actorId,
    Date: today,
    Action: 'Punch In',
    Time: '09:00:00',
    'Punch In': '09:00:00',
    Status: 'Present',
    Photo: 'test-verification-photo',
    Latitude: '28.6139',
    Longitude: '77.2090'
  });

  ticketId = `${prefix}_TICKET`;
  const created = await createTicket({
    'Ticket ID': ticketId,
    'Creator ID': actorId,
    'Employee ID': actorId,
    Client_Id: 'CL000',
    'Task Category': 'Verification',
    'Task Description': 'Ticket lifecycle verification',
    Priority: 'Normal',
    TAT: 30,
    'Plan Date': today,
    Source: 'App'
  });
  assert(created.success && created.item?.Status === 'Open', 'Ticket create lifecycle failed.');

  const started = await updateTicket(ticketId, { newStatus: 'In Progress', updatedBy: actorId, role: actor.Role || actor.role });
  assert(started.success && started.finalStatus === 'In Progress', 'Ticket start lifecycle failed.');
  const paused = await updateTicket(ticketId, { newStatus: 'Paused', updatedBy: actorId, role: actor.Role || actor.role });
  assert(paused.success && paused.finalStatus === 'Paused', 'Ticket pause lifecycle failed.');

  const scheduled = await updateTicketSchedule(ticketId, 45, today, 'Lifecycle verification', actorId, actor.Role || actor.role);
  assert(scheduled.success && String(scheduled.item?.TAT) === '45', 'Ticket schedule lifecycle failed.');

  const invalidReassign = await reassignTicket(ticketId, 'NOT_A_REAL_USER', actorId, 'Should be rejected', actor.Role || actor.role);
  assert(!invalidReassign.success && /not found|inactive/i.test(invalidReassign.message || ''), 'Invalid ticket reassignment was accepted.');
  const reassigned = await reassignTicket(ticketId, targetId, actorId, 'Lifecycle verification', actor.Role || actor.role);
  assert(reassigned.success && String(reassigned.item?.['Employee ID']).toUpperCase() === String(targetId).toUpperCase(), 'Ticket reassign lifecycle failed.');

  const posted = await postTaskMessage(ticketId, 'Lifecycle verification message', actorId, actor.Role || actor.role);
  assert(posted.success, 'Ticket message post lifecycle failed.');
  const messages = await getTaskMessages(ticketId, actorId, actor.Role || actor.role);
  assert(messages.success && messages.messages.some((item) => item.Message === 'Lifecycle verification message'), 'Ticket message read lifecycle failed.');
  const read = await markTicketMessagesAsRead(ticketId, '', actorId, actor.Role || actor.role);
  assert(read.success, 'Ticket message read-state lifecycle failed.');

  const response = await processClientResponse(ticketId, 'Lifecycle client response', today, null, actorId, actor.Role || actor.role);
  assert(response.success && response.item?.Status === 'Client Responded', 'Client response lifecycle failed.');
  assert(String(response.item?.['Employee ID']).toUpperCase() === String(actorId).toUpperCase(), 'Client response did not return the ticket to its original assignee.');
  assert(await LegacyModels.TicketHistory.countDocuments({ 'data.Ticket ID': ticketId }) >= 2, 'Ticket history was not persisted for lifecycle actions.');
  console.log(`Ticket lifecycle verification passed for ${ticketId}.`);
} finally {
  await cleanup();
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
}
