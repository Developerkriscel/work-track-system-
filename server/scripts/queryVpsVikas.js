import { Client } from 'ssh2';

const conn = new Client();
conn.on('ready', () => {
  console.log('SSH Ready.');
  const script = `
cd /opt/kriscel.online
node -e '
import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  const collections = await db.listCollections().toArray();
  
  for (const c of collections) {
    if (c.name.toLowerCase().includes("attend")) {
      const coll = db.collection(c.name);
      const docs = await coll.find({
        $or: [
          { "date": /2026-09-24/i },
          { "Date": /2026-09-24/i },
          { "Date": /24/ }
        ]
      }).toArray();
      console.log("Collection:", c.name, "Found:", docs.length);
      for (const d of docs) {
        if (JSON.stringify(d).toLowerCase().includes("vikas") || JSON.stringify(d).includes("10:17")) {
          console.log("MATCH:", JSON.stringify(d, null, 2));
        }
      }
    }
  }
  await mongoose.disconnect();
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
