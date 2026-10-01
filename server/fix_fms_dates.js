import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectDatabase } from './config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const legacyRowSchema = new mongoose.Schema(
  { legacyId: { type: String, index: true }, data: { type: mongoose.Schema.Types.Mixed, default: {} } },
  { timestamps: true, strict: false }
);

async function run() {
  await connectDatabase();
  console.log('Connected to MongoDB\n');

  const FmsModel = mongoose.models.FmsTask || mongoose.model('FmsTask', legacyRowSchema, 'fms_legacy');

  // Find all FMS records where Plan Date contains 2001
  const affected = await FmsModel.find({
    $or: [
      { 'data.Plan Date': { $regex: '2001' } },
      { 'data.planDate': { $regex: '2001' } },
      { 'data.Date': { $regex: '2001' } },
      { 'data.date': { $regex: '2001' } }
    ],
    legacyId: { $ne: '__FMS_SHEET_SYNC_META__' }
  });

  console.log(`Found ${affected.length} FMS records with year 2001 in Plan Date`);

  if (affected.length === 0) {
    console.log('Nothing to update.');
    mongoose.connection.close();
    return;
  }

  // Preview first 5
  console.log('\nSample records:');
  affected.slice(0, 5).forEach(r => {
    console.log(`  legacyId: ${r.legacyId} | Plan Date: ${r.data['Plan Date'] || r.data.planDate || r.data.Date || r.data.date}`);
  });

  // Update: replace 2001 with 2026 in all date fields
  let updatedCount = 0;
  const bulkOps = affected.map(doc => {
    const update = {};
    const d = doc.data;

    if (d['Plan Date'] && String(d['Plan Date']).includes('2001'))
      update['data.Plan Date'] = String(d['Plan Date']).replace(/2001/g, '2026');
    if (d.planDate && String(d.planDate).includes('2001'))
      update['data.planDate'] = String(d.planDate).replace(/2001/g, '2026');
    if (d.Date && String(d.Date).includes('2001'))
      update['data.Date'] = String(d.Date).replace(/2001/g, '2026');
    if (d.date && String(d.date).includes('2001'))
      update['data.date'] = String(d.date).replace(/2001/g, '2026');

    if (Object.keys(update).length === 0) return null;
    updatedCount++;
    return {
      updateOne: {
        filter: { _id: doc._id },
        update: { $set: update }
      }
    };
  }).filter(Boolean);

  if (bulkOps.length > 0) {
    const result = await FmsModel.bulkWrite(bulkOps, { ordered: false });
    console.log(`\n✅ Updated ${result.modifiedCount} FMS records: 2001 → 2026`);
  } else {
    console.log('\nNo valid update operations generated.');
  }

  mongoose.connection.close();
}

run().catch(console.error);
