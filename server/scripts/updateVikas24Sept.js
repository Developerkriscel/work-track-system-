import { Client } from 'ssh2';

const conn = new Client();
conn.on('ready', () => {
  console.log('SSH Ready.');
  const script = `
cd /opt/kriscel.online
node -e '
import { connectDatabase } from "./server/config/database.js";
import { LegacyModels } from "./server/models/legacyModels.js";
import dotenv from "dotenv";
dotenv.config();

async function run() {
  await connectDatabase();
  const Attendance = LegacyModels.Attendance;
  
  // 1. Update Punch In record
  const punchInDoc = await Attendance.findOne({
    "legacyId": "ATT_1790225271533"
  });
  
  if (punchInDoc) {
    console.log("Found Punch In doc. Updating...");
    punchInDoc.data["Punch In"] = "10:15 am";
    punchInDoc.data["Time"] = "2026-09-24T04:45:00.000Z";
    punchInDoc.markModified("data");
    await punchInDoc.save();
    console.log("Punch In doc updated successfully.");
  } else {
    console.log("Punch In doc not found!");
  }
  
  // 2. Update Punch Out duration if needed (10:15 AM to 06:19 PM is 8h 4m)
  const punchOutDoc = await Attendance.findOne({
    "legacyId": "ATT_1790254182946"
  });
  
  if (punchOutDoc) {
    console.log("Found Punch Out doc. Updating duration...");
    punchOutDoc.data["Duration"] = "8h 4m";
    punchOutDoc.data["Total Working Hours"] = "8h 4m";
    punchOutDoc.markModified("data");
    await punchOutDoc.save();
    console.log("Punch Out doc updated successfully.");
  }
  
  console.log("Update completed!");
  process.exit(0);
}
run().catch(console.error);
'
`;
  conn.exec(script, (err, stream) => {
    if (err) throw err;
    stream.on('close', () => {
      conn.end();
    }).on('data', (d) => process.stdout.write(d.toString())).stderr.on('data', (d) => process.stderr.write(d.toString()));
  });
}).connect({
  host: '187.127.149.196',
  port: 22,
  username: 'root',
  password: 'Kriscel@12345'
});
