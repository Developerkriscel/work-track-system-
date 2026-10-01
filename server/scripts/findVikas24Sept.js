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
  
  const docs = await Attendance.find({}).lean();
  
  const vikasDocs = docs.filter(d => {
    const raw = JSON.stringify(d);
    return (d.data?.["Employee ID"] === "VK114" || d.data?.EmpID === "VK114" || d.data?.["Employee Name"] === "Vikas Kushwah") &&
           (d.data?.Date === "2026-09-24" || raw.includes("2026-09-24"));
  });
  
  console.log("Vikas 24 Sept docs count:", vikasDocs.length);
  for (const d of vikasDocs) {
    console.log(JSON.stringify(d, null, 2));
  }
  
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
