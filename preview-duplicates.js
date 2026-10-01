import { connect } from 'mongoose';
import { LegacyModels } from './server/models/legacyModels.js';
import dotenv from 'dotenv';

// Explicitly load from the root folder
dotenv.config({ path: 'C:\\Users\\vikas\\OneDrive\\Desktop\\work track system kriscel\\.env' });

async function check() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGO_URI not found in .env');
    process.exit(1);
  }
  
  await connect(uri, { dbName: process.env.MONGO_DB || 'worktrack' });
  const TicketModel = LegacyModels.Ticket;
  
  const todayStr = new Date().toLocaleDateString('en-US');
  
  const query = {
    'data.Ticket ID': { $regex: /^TKT-/ },
    'data.Timestamp': todayStr,
    'data.Auto Ticket': { $nin: ['Yes', 'yes'] },
    'data.Is Auto Ticket': { $nin: ['Yes', 'yes'] }
  };
  
  const tickets = await TicketModel.find(query);
  console.log('--- FOUND', tickets.length, 'TICKETS FOR TODAY ---');
  
  // Show a summary of a few tickets
  const sample = tickets.slice(0, 5);
  sample.forEach(t => {
    console.log(`- ID: ${t.data['Ticket ID']} | Task: ${t.data['Task Description']} | Employee: ${t.data['Employee Name'] || t.data['Help Person Name']}`);
  });
  
  if (tickets.length > 5) {
    console.log(`...and ${tickets.length - 5} more similar tickets.`);
  }
  
  process.exit(0);
}
check().catch(console.error);
