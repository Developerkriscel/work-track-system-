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

  const AttendanceModel = mongoose.models.attendance_legacy || mongoose.model('attendance_legacy', legacyRowSchema, 'attendance_legacy');

  const recordsToUpdate = await AttendanceModel.find({ 'data.Date': /^\d{1,2}\/\d{1,2}\/\d{4}$/ });
  let updatedCount = 0;

  for (let doc of recordsToUpdate) {
    let newData = { ...doc.data };

    const parts = newData.Date.split('/');
    const month = String(parts[0]).padStart(2, '0');
    const day = String(parts[1]).padStart(2, '0');
    const year = parts[2];
    
    const newDateStr = `${year}-${month}-${day}`;
    newData.Date = newDateStr;
    
    await AttendanceModel.updateOne({ _id: doc._id }, { $set: { data: newData } });
    updatedCount++;
  }

  console.log(`Updated ${updatedCount} attendance records to standard Date format.`);
  
  // Clear the cache by touching server.js
  import('fs').then(fs => {
    const serverJsPath = path.join(__dirname, 'server.js');
    const now = new Date();
    if (fs.existsSync(serverJsPath)) {
        fs.utimesSync(serverJsPath, now, now);
        console.log('Touched server.js to clear cache.');
    } else {
        const rootServerJsPath = path.join(__dirname, '../server.js');
        if (fs.existsSync(rootServerJsPath)) {
            fs.utimesSync(rootServerJsPath, now, now);
            console.log('Touched root server.js to clear cache.');
        }
    }
  });

  mongoose.connection.close();
}

run().catch(console.error);
