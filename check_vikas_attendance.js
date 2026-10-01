import * as dotenv from 'dotenv';
import { LegacyModels } from './server/models/legacyModels.js';
import { connectDatabase } from './server/config/database.js';

dotenv.config();

async function checkEdits() {
  try {
    await connectDatabase();
    
    console.log('Connected to DB');
    
    const allLogs = await LegacyModels.Attendance.find({
      $or: [
        { 'data.Employee Name': { $regex: /vikas/i } },
        { 'data.Name': { $regex: /vikas/i } },
        { 'data.Employee ID': { $regex: /vk/i } }
      ]
    }).lean();
    
    console.log(`Found ${allLogs.length} total logs for Vikas Kushwah`);
    
    const septLogs = allLogs.filter(log => {
      const logData = log.data || {};
      const dateStr = String(logData.Date || logData._rawDate || logData.date || '');
      // match any format for September 2026
      return (dateStr.includes('-09-') || dateStr.includes('/09/') || dateStr.match(/^0?9\//) || dateStr.includes('Sep')) && (dateStr.includes('2026') || dateStr.includes('26'));
    });
    
    console.log(`Found ${septLogs.length} logs in September`);
    
    let editedCount = 0;
    
    for (const log of septLogs) {
      const logData = log.data || {};
      const k = Object.keys(logData).join(' ');
      if (k.toLowerCase().includes('edit') || k.toLowerCase().includes('update') || k.toLowerCase().includes('isedited') || log.updatedAt || logData.EditedBy) {
        // filter out just "updatedAt" if it's identical to createdAt, which happens automatically
        if (log.updatedAt && log.createdAt && new Date(log.updatedAt).getTime() - new Date(log.createdAt).getTime() < 1000 && !logData.EditedBy && !k.toLowerCase().includes('edit')) {
           continue; // likely not manually edited
        }
        
        console.log('--- Edited Log Found ---');
        console.log(`Date: ${logData.Date}`);
        console.log(`Action: ${logData.Action || logData.Status}`);
        console.log(`Data: ${JSON.stringify(logData, null, 2)}`);
        editedCount++;
      }
    }
    
    if (editedCount === 0 && septLogs.length > 0) {
      console.log('No edited logs found.');
    }
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkEdits();
