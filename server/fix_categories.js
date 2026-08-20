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

  const TicketModel = mongoose.models.tickets_legacy || mongoose.model('tickets_legacy', legacyRowSchema, 'tickets_legacy');

  // Use aggregation pipeline to update efficiently in one database command
  const updateResult = await TicketModel.updateMany(
    { 
      'data.Department': { $exists: true }, 
      'data.Task Category': { $exists: false } 
    },
    [
      {
        $set: {
          'data.Task Category': '$data.Department',
          'data.Category': '$data.Department'
        }
      }
    ]
  );

  console.log(`Updated ${updateResult.modifiedCount} tickets to include Task Category and Category.`);
  
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
