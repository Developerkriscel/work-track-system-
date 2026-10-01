import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/worktrack';

async function main() {
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  const collections = await db.listCollections().toArray();
  console.log('Collections:', collections.map(c => c.name));

  const coll = db.collection('attendances') || db.collection('attendance');
  const userColl = db.collection('users') || db.collection('employees');

  const users = await userColl.find({ $or: [{ name: /vikas/i }, { 'Employee Name': /vikas/i }, { employeeId: /vikas/i }, { EmployeeID: /vikas/i }] }).toArray();
  console.log('Vikas users found:', users.map(u => ({ id: u._id, empId: u.employeeId || u.EmployeeID || u['Employee ID'], name: u.name || u['Employee Name'] })));

  const attendances = await coll.find({
    $or: [
      { date: /2026-09-24/ },
      { Date: /2026-09-24/ },
      { date: /24[\/-]09[\/-]2026/ },
      { Date: /24[\/-]09[\/-]2026/ }
    ]
  }).toArray();

  console.log(`Found ${attendances.length} records for 2026-09-24:`);
  for (const a of attendances) {
    console.log(JSON.stringify(a, null, 2));
  }

  await mongoose.disconnect();
}

main().catch(console.error);
