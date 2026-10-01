import dotenv from 'dotenv';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectDatabase } from './config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function run() {
  await connectDatabase();
  const db = mongoose.connection.useDb('worktrack');
  
  const allMyRecords = await db.collection('attendance_legacy').find({
     legacyId: { $regex: /_178/ } // my inserts will have a timestamp starting with 178
  }).toArray();
  
  console.log("Number of my records:", allMyRecords.length);
  if (allMyRecords.length > 0) {
      console.log("Sample:", JSON.stringify(allMyRecords[0], null, 2));
  }

  process.exit(0);
}

run().catch(console.error);
