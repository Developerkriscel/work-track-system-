import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import XLSX from 'xlsx';
import mongoose from 'mongoose';
import { connectDatabase } from '../config/database.js';
import { LegacyModels } from '../models/legacyModels.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
  await connectDatabase();
  console.log('Connected to database.');

  const filePath = "C:\\Users\\vikas\\.gemini\\antigravity-ide\\brain\\29387e74-b29c-403e-a046-27429f2aab31\\scratch\\auto_tickets.csv";
  
  if (!fs.existsSync(filePath)) {
    console.error('CSV file not found at:', filePath);
    process.exit(1);
  }

  const workbook = XLSX.readFile(filePath, { cellDates: true });
  const sheetName = workbook.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });

  console.log(`Found ${rows.length} rows to import.`);

  const TicketModel = LegacyModels.Ticket;

  let insertedCount = 0;
  for (const row of rows) {
    // Force the Auto Ticket flag so it shows up in the Auto Ticket tab
    row['Auto Ticket'] = 'Yes';
    row['Is Auto Ticket'] = 'Yes';
    
    // Also ensuring 'Client Name' is present if 'Name' is used
    if (row['Name'] && !row['Client Name']) {
      row['Client Name'] = row['Name'];
    }

    if (!row['Ticket ID']) {
      row['Ticket ID'] = `AUTO-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    }
    
    // Status should be set to some default if missing, but we keep structure exact
    // except fields required by the app to identify it

    const legacyId = row['Ticket ID'];

    await TicketModel.create({
      legacyId,
      data: row
    });
    insertedCount++;
  }

  console.log(`Successfully imported ${insertedCount} auto tickets.`);
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
