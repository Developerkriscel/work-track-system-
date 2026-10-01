import mongoose from 'mongoose';
import { connectDatabase } from './config/database.js';

const legacyRowSchema = new mongoose.Schema(
  {
    legacyId: { type: String, index: true },
    data: { type: mongoose.Schema.Types.Mixed, default: {} }
  },
  { timestamps: true, strict: false }
);

async function run() {
  await connectDatabase();
  const Ticket = mongoose.model('Ticket', legacyRowSchema, 'Ticket');

  const allTickets = await Ticket.find({});
  let autoTickets = [];
  let otherTickets = [];

  allTickets.forEach(t => {
    if (t.data && (t.data['Auto Ticket'] || t.data['Is Auto Ticket'] || t.data.Frequency || t.data.Frequence)) {
      autoTickets.push(t);
    } else {
      otherTickets.push(t);
    }
  });

  console.log(`Found ${autoTickets.length} Auto Tickets out of ${allTickets.length} total tickets.`);
  if (autoTickets.length > 0) {
    console.log('Sample Auto Ticket data keys:');
    console.log(Object.keys(autoTickets[0].data));
    console.log('Sample Auto Ticket Frequency:');
    console.log(autoTickets[0].data.Frequency, autoTickets[0].data.Frequence, autoTickets[0].data['Auto Ticket']);
  }

  mongoose.connection.close();
}

run().catch(console.error);
