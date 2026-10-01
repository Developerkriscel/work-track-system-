import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectDatabase } from './config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const legacyRowSchema = new mongoose.Schema(
  {
    legacyId: { type: String, index: true },
    data: { type: mongoose.Schema.Types.Mixed, default: {} }
  },
  { timestamps: true, strict: false }
);

function safe(val) {
  return val == null ? '' : String(val);
}

function first(obj, keys, defaultVal = '') {
  for (const k of keys) {
    if (obj && obj[k] !== undefined && obj[k] !== null && obj[k] !== '') {
      return obj[k];
    }
  }
  return defaultVal;
}

function isAutoTicket(ticket = {}) {
  const flag = safe(first(ticket, ['Auto Ticket', 'autoTicket', 'Is Auto Ticket', 'isAutoTicket', 'Automation', 'automation']));
  const marker = [
    flag,
    first(ticket, ['Source', 'source', 'Ticket Source', 'ticketSource']),
    first(ticket, ['Origin', 'origin']),
    first(ticket, ['Created By', 'Creator ID', 'createdBy'])
  ].join(' ').toLowerCase();
  if (['yes', 'true', '1', 'auto', 'automatic'].includes(flag.toLowerCase())) return true;
  return /\b(auto|automatic|automation|scheduler|scheduled|recurring|system)\b/.test(marker);
}

async function run() {
  await connectDatabase();
  const Ticket = mongoose.model('Ticket', legacyRowSchema, 'tickets_legacy');

  const allTickets = await Ticket.find({});
  const autoTicketIds = [];

  allTickets.forEach(t => {
    if (isAutoTicket(t.data || {})) {
      autoTicketIds.push(t._id);
    }
  });

  console.log(`Found ${autoTicketIds.length} auto tickets out of ${allTickets.length} total tickets.`);

  if (autoTicketIds.length > 0) {
    const result = await Ticket.deleteMany({ _id: { $in: autoTicketIds } });
    console.log(`Successfully deleted ${result.deletedCount} auto tickets from the database.`);
  } else {
    console.log('No auto tickets to delete.');
  }

  mongoose.connection.close();
}

run().catch(console.error);
