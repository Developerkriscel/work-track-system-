import { connect } from 'mongoose';
import { LegacyModels } from './server/models/legacyModels.js';
import dotenv from 'dotenv';

// Explicitly load from the root folder
dotenv.config({ path: 'C:\\Users\\vikas\\OneDrive\\Desktop\\work track system kriscel\\.env' });

async function cleanup() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGO_URI not found in .env');
    process.exit(1);
  }
  
  console.log('Connecting to Atlas...');
  await connect(uri, { dbName: process.env.MONGO_DB || 'worktrack' });
  console.log('Connected to MongoDB');
  const TicketModel = LegacyModels.Ticket;
  
  const todayStr = new Date().toLocaleDateString('en-US');
  
  const query = {
    'data.Ticket ID': { $regex: /^TKT-/ },
    'data.Timestamp': todayStr,
    // Exclude actual templates which have Auto Ticket flag
    'data.Auto Ticket': { $nin: ['Yes', 'yes'] },
    'data.Is Auto Ticket': { $nin: ['Yes', 'yes'] }
  };
  
  const count = await TicketModel.countDocuments(query);
  console.log('Tickets to delete:', count);
  
  if (count > 0) {
    const result = await TicketModel.deleteMany(query);
    console.log('Deleted:', result.deletedCount);
  } else {
    console.log('No duplicate auto-generated tickets found for today.');
  }
  
  process.exit(0);
}
cleanup().catch(console.error);
