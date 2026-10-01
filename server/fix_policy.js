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
  const PolicyModel = mongoose.models.AttendancePolicy || mongoose.model('AttendancePolicy', legacyRowSchema, 'attendance_policy_legacy');

  const newLocations = [
    {
      officeName: "Velto Office",
      latitude: "28.5473096", // Updated to Vikas's actual location
      longitude: "77.0479741", // Updated to Vikas's actual location
      radiusMeters: "200"
    }
  ];

  await PolicyModel.updateOne(
    { legacyId: 'ATTENDANCE_LOCATION_POLICY' }, // Adjust if legacyId differs
    { 
      $set: { 
        'data.Locations': JSON.stringify(newLocations),
        'data.locations': JSON.stringify(newLocations),
        'data.Latitude': '28.5473096',
        'data.Lattitude': '28.5473096',
        'data.latitude': '28.5473096',
        'data.Longitude': '77.0479741',
        'data.longitude': '77.0479741'
      } 
    },
    { upsert: true }
  );
  
  // also update by ID if needed
  await PolicyModel.updateOne(
    { 'data.PolicyID': 'ATTENDANCE_LOCATION_POLICY' },
    { 
      $set: { 
        'data.Locations': JSON.stringify(newLocations),
        'data.locations': JSON.stringify(newLocations),
        'data.Latitude': '28.5473096',
        'data.Lattitude': '28.5473096',
        'data.latitude': '28.5473096',
        'data.Longitude': '77.0479741',
        'data.longitude': '77.0479741'
      } 
    }
  );

  console.log("Updated policy location to match Vikas's GPS location");
  mongoose.connection.close();
}
run().catch(console.error);
