import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectDatabase } from './config/database.js';
import { syncFmsFromGoogleSheet } from './services/fms.service.js';

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

  // Count current FMS records in DB
  const FmsModel = mongoose.models.FmsTask || mongoose.model('FmsTask', legacyRowSchema, 'fms_legacy');
  const totalInDB = await FmsModel.countDocuments({ legacyId: { $ne: '__FMS_SHEET_SYNC_META__' } });
  const sheetRows = await FmsModel.countDocuments({ legacyId: /^FMS_SHEET_/ });
  const manualRows = totalInDB - sheetRows;
  
  console.log(`DB Stats BEFORE force-sync:`);
  console.log(`  Total FMS rows (excl meta): ${totalInDB}`);
  console.log(`  Sheet-sourced rows:         ${sheetRows}`);
  console.log(`  Manually added rows:        ${manualRows}`);
  
  // STEP 1: Clear the sync meta so it does a FULL compare (not skip based on old hash)
  console.log('\n→ Clearing sync meta to force full re-comparison...');
  await FmsModel.deleteOne({ legacyId: '__FMS_SHEET_SYNC_META__' });
  console.log('  Sync meta cleared.\n');

  // STEP 2: Run full sync - will now compare every row from scratch
  console.log('→ Running full FMS sync from Google Sheet...');
  const result = await syncFmsFromGoogleSheet();
  
  console.log('\n✅ Sync Complete!');
  console.log(`  Rows from Google Sheet: ${result.count}`);
  console.log(`  Rows updated/added:     ${result.changed}`);
  
  // STEP 3: Verify DB after sync
  const totalAfter = await FmsModel.countDocuments({ legacyId: { $ne: '__FMS_SHEET_SYNC_META__' } });
  const sheetAfter = await FmsModel.countDocuments({ legacyId: /^FMS_SHEET_/ });
  const manualAfter = totalAfter - sheetAfter;
  
  console.log(`\nDB Stats AFTER force-sync:`);
  console.log(`  Total FMS rows (excl meta): ${totalAfter}`);
  console.log(`  Sheet-sourced rows:         ${sheetAfter}`);
  console.log(`  Manually added rows:        ${manualAfter}`);
  console.log(`\n  Manual data preserved:      ${manualAfter === manualRows ? '✅ YES (safe)' : `⚠️ Changed (was ${manualRows}, now ${manualAfter})`}`);

  mongoose.connection.close();
}

run().catch(console.error);
