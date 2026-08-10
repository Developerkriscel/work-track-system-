import 'dotenv/config';
import { connectDatabase } from './server/config/database.js';
import { listRows } from './server/legacyStore.service.js'; // Actually, let's just use native mongoose model if possible. Wait, legacyStore is easier.

import mongoose from 'mongoose';

async function verify() {
  await connectDatabase();
  const db = mongoose.connection.useDb('test'); // Or whatever the DB name is
  const collection = db.collection('legacy_store'); // Assuming legacyStore uses legacy_store collection.
  
  const tickets = await collection.find({ sheetId: 'Ticket' }).toArray();
  const kris009Tickets = tickets.filter(t => {
    const data = t.data || {};
    const empId = (data['Employee ID'] || data['User ID'] || data['EMP Code'] || data['employeeId'] || data['EmpID'] || '').trim().toLowerCase();
    return empId === 'kris_009';
  });

  console.log('Total tickets for KRIS_009:', kris009Tickets.length);
  if (kris009Tickets.length > 0) {
    console.log(kris009Tickets.map(t => t.data));
  }
  process.exit(0);
}
verify().catch(console.error);
