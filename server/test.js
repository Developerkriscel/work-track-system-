import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectDatabase } from './config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function run() {
  await connectDatabase();
  console.log('Connected to MongoDB');
  const Ticket = mongoose.connection.collection('tickets_legacy');
  const doc = await Ticket.findOne({ 'data.Auto Ticket': 'Yes' });
  console.log(JSON.stringify(doc.data, null, 2));
  mongoose.connection.close();
}

run().catch(console.error);
