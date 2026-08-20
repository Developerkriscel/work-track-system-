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

  const FmsModel = mongoose.models.fms_legacy || mongoose.model('fms_legacy', legacyRowSchema, 'fms_legacy');

  const records = await FmsModel.find({}).limit(1);
  for (let r of records) {
     console.log(JSON.stringify(r.data, null, 2));
  }
  
  mongoose.connection.close();
}

run().catch(console.error);
