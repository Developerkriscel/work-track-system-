import fs from 'fs';
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

async function run() {
  await connectDatabase();
  console.log('Connected to MongoDB');

  const TicketModel = mongoose.models.tickets_legacy || mongoose.model('tickets_legacy', legacyRowSchema, 'tickets_legacy');

  const raw = fs.readFileSync('raw_tickets.txt', 'utf8');
  const lines = raw.split('\n').map(l => l.trim());

  let tickets = [];
  let i = 0;

  while (i < lines.length) {
    if (!lines[i]) {
      i++;
      continue;
    }

    if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(lines[i]) && lines[i+1] && lines[i+1].startsWith('TICKET_')) {
      const timestamp = lines[i++];
      const ticketId = lines[i++];
      const clientId = lines[i++];
      const clientName = lines[i++];
      const department = lines[i++];
      
      let description = '';
      while (i < lines.length && !['Normal', 'Super Urgent', 'Urgent', 'Low', 'High'].includes(lines[i])) {
        description += lines[i] + '\n';
        i++;
      }
      description = description.trim();
      
      const priority = lines[i++];
      const planDate = lines[i++];
      
      let additionalDate = '';
      if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(lines[i])) {
        additionalDate = lines[i++];
      }

      const status = lines[i++];
      const employeeId = lines[i++];
      const employeeName = lines[i++];

      let ticket = {
        'Timestamp': timestamp,
        'Ticket ID': ticketId,
        'Client ID': clientId,
        'Client Name': clientName,
        'Department': department,
        'Task Description': description,
        'Priority': priority,
        'Plan Date': planDate,
        'Status': status,
        'Employee ID': employeeId,
        'Employee Name': employeeName,
        'Date': planDate.split(' ')[0]
      };

      if (additionalDate) {
         ticket['Additional Date'] = additionalDate;
      }

      if (status === 'Open') {
        const tat = lines[i++];
        ticket['TAT Minutes'] = tat;
      } else {
        if (/^\d{2}:\d{2}:\d{2}$/.test(lines[i]) || /^\d{2}:\d{2}$/.test(lines[i])) {
          ticket['Start Time'] = lines[i++];
          ticket['End Time'] = lines[i++];
          ticket['Actual Duration'] = lines[i++];
          ticket['TAT Minutes'] = lines[i++];
        } else if (/^\d+$/.test(lines[i])) {
           ticket['TAT Minutes'] = lines[i++];
        }

        let remarks = '';
        while (i < lines.length && !/^\d{1,2}\/\d{1,2}\/\d{4}/.test(lines[i]) && !/^\d{4}-\d{2}-\d{2}$/.test(lines[i])) {
           remarks += lines[i] + '\n';
           i++;
        }
        ticket['Remarks'] = remarks.trim();

        if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(lines[i])) {
          ticket['Action Timestamp'] = lines[i++];
        }
        if (i < lines.length && !/^\d{1,2}\/\d{1,2}\/\d{4}/.test(lines[i]) && !/^\d{4}-\d{2}-\d{2}$/.test(lines[i])) {
          i++;
        }
        if (i < lines.length && /^\d{4}-\d{2}-\d{2}$/.test(lines[i])) {
          ticket['Action Date'] = lines[i++];
        }
      }
      
      tickets.push(ticket);
    } else {
      i++;
    }
  }

  console.log(`Parsed ${tickets.length} tickets`);

  const datesToDelete = [
    '8/10/2026', '8/11/2026', '8/12/2026', '8/13/2026', '8/14/2026',
    '8/15/2026', '8/16/2026', '8/17/2026', '8/18/2026', '8/19/2026'
  ];

  console.log('Finding records to delete...');
  const allExisting = await TicketModel.find({});
  let toDeleteIds = [];
  
  for (let doc of allExisting) {
    let docDate = doc.data?.Date || doc.data?.['Plan Date'] || doc.data?.Timestamp;
    if (typeof docDate === 'string') {
      let d = docDate.split(' ')[0];
      if (datesToDelete.includes(d) || (d.startsWith('2026-08-1') && d <= '2026-08-19' && d >= '2026-08-10')) {
        toDeleteIds.push(doc._id);
      }
    }
  }

  console.log(`Found ${toDeleteIds.length} existing tickets to delete in this date range.`);
  if (toDeleteIds.length > 0) {
    await TicketModel.deleteMany({ _id: { $in: toDeleteIds } });
    console.log(`Deleted ${toDeleteIds.length} tickets.`);
  }

  console.log('Inserting new tickets...');
  const docsToInsert = tickets.map(t => ({
    legacyId: t['Ticket ID'],
    data: t
  }));

  if (docsToInsert.length > 0) {
    await TicketModel.insertMany(docsToInsert);
    console.log(`Inserted ${docsToInsert.length} tickets.`);
  }

  mongoose.connection.close();
}

run().catch(console.error);
