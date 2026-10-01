import fs from 'fs';
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

  const Ticket = mongoose.model('Ticket', legacyRowSchema, 'tickets_legacy');

  const raw = fs.readFileSync('raw_auto_tickets.txt', 'utf8');
  const lines = raw.split('\n').map(l => l.trim()).filter(l => l);
  
  // The first line is the header
  const headers = lines[0].split('\t').map(h => h.trim());
  console.log('Found Headers:', headers);

  const docs = [];
  
  for (let i = 1; i < lines.length; i++) {
    const columns = lines[i].split('\t');
    
    // Safety check - we know we have 12 columns based on the header
    if (columns.length !== headers.length) {
      console.warn(`Line ${i+1} has ${columns.length} columns instead of ${headers.length}. Fixing by treating missing columns as empty strings.`);
      while (columns.length < headers.length) columns.push('');
    }
    
    const dataObj = {};
    for (let j = 0; j < headers.length; j++) {
      dataObj[headers[j]] = columns[j].trim();
    }

    // Required flags to make it an auto ticket for the legacy system
    dataObj['Auto Ticket'] = 'Yes';
    dataObj['Is Auto Ticket'] = 'Yes';
    dataObj['Status'] = 'Open'; // Default status for imported templates, though normally auto tickets might not even show up as active tasks unless generated.
    // Also generate a Ticket ID as some features expect it.
    const uniqueId = `TKT_AUTO_${Date.now()}_${i}`;
    dataObj['Ticket ID'] = uniqueId;

    docs.push({
      legacyId: uniqueId,
      data: dataObj
    });
  }

  console.log(`Prepared ${docs.length} auto ticket templates for insertion.`);

  if (docs.length > 0) {
    const result = await Ticket.insertMany(docs);
    console.log(`Successfully inserted ${result.length} auto tickets.`);
  }

  mongoose.connection.close();
}

run().catch(console.error);
