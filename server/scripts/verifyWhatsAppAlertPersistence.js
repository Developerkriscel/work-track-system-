import 'dotenv/config';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { connectDatabase } from '../config/database.js';
import { WhatsAppAlertJob } from '../models/whatsappAlertJob.model.js';
import { LegacyModels } from '../models/legacyModels.js';
import { insertRow, upsertRow } from '../services/legacyStore.service.js';
import { onRowSaved } from '../services/rowEvents.service.js';
const id = `WA_VERIFY_${Date.now()}`;
await connectDatabase();
const changes = [];
const unsubscribe = onRowSaved((event) => { if (event.after?.['Ticket ID'] === id) changes.push(event); });
try {
  await WhatsAppAlertJob.init();
  await insertRow('Ticket', { 'Ticket ID': id, 'Employee ID': id, Status: 'Open' });
  await upsertRow('Ticket', 'Ticket ID', id, { Status: 'Pending Approval' });
  assert.equal(changes.length, 2);
  assert.equal(changes[0].before, null);
  assert.equal(changes[1].before.Status, 'Open');
  assert.equal(changes[1].after.Status, 'Pending Approval');
  const row = { key: id, employeeId: id, contactId: new mongoose.Types.ObjectId(), alertType: 'attendance', event: 'attendance-summary:2026-09-11', message: 'Persistence verification only', state: 'skipped' };
  await WhatsAppAlertJob.create(row);
  await assert.rejects(WhatsAppAlertJob.create(row), (error) => error.code === 11000);
  assert.equal(await WhatsAppAlertJob.countDocuments({ key: id }), 1);
  assert.equal((await WhatsAppAlertJob.findOne({ key: id }).lean()).event, row.event);
  console.log('MongoDB alert persistence passed: source create/update events, before/after snapshots, durable queue and unique deduplication index. No worker started or messages sent.');
} finally {
  unsubscribe();
  await LegacyModels.Ticket.deleteMany({ 'data.Ticket ID': id });
  await WhatsAppAlertJob.deleteMany({ key: id });
  await mongoose.disconnect();
}
