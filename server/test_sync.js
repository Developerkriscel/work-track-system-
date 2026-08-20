import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectDatabase } from './config/database.js';
import { syncFmsFromGoogleSheet } from './services/fms.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function run() {
  await connectDatabase();
  console.log('Connected to MongoDB');
  try {
     const res = await syncFmsFromGoogleSheet();
     console.log('Result:', res);
  } catch (err) {
     console.error('Error:', err);
  }
  mongoose.connection.close();
}

run().catch(console.error);
