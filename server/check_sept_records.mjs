import dns from 'node:dns';
dns.setServers(['8.8.8.8', '1.1.1.1']);
import mongoose from 'mongoose';

const legacyRowSchema = new mongoose.Schema(
  { legacyId: { type: String, index: true }, data: { type: mongoose.Schema.Types.Mixed, default: {} } },
  { timestamps: true, strict: false }
);

async function run() {
  await mongoose.connect('mongodb+srv://devloper1_db_user:FcljdKvErYmD8gIB@work-track-system.tyyoknh.mongodb.net/?appName=work-track-system', { dbName: 'worktrack' });
  
  const AttendanceModel = mongoose.model('attendance_legacy', legacyRowSchema, 'attendance_legacy');
  
  const docs = await AttendanceModel.find({}).lean();

  const sept = docs.filter(d => {
    const s = JSON.stringify(d.data).toLowerCase();
    return s.includes('vikas') && s.includes('2026-09');
  }).sort((a, b) => String(a.data.Date).localeCompare(String(b.data.Date)));

  console.log('Total Sept docs for Vikas:', sept.length);
  
  sept.forEach(d => {
    console.log(`${d.data.Date} | Action: ${d.data.Action || '-'} | In: ${d.data['Punch In'] || '-'} | Out: ${d.data['Punch Out'] || '-'} | Status: ${d.data.Status || '-'} | Duration: ${d.data.Duration || '-'}`);
  });

  await mongoose.disconnect();
}

run().catch(console.error);
