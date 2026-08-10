import { MongoClient } from 'mongodb';

const url = 'mongodb+srv://devloper1_db_user:FcljdKvErYmD8gIB@work-track-system.tyyoknh.mongodb.net/?appName=work-track-system';
const dbName = 'worktrack';

async function testBuddy() {
  const client = new MongoClient(url);
  await client.connect();
  console.log('Connected to DB');
  const db = client.db(dbName);
  
  const leaves = await db.collection('Leave').find({}).toArray();
  const users = await db.collection('User').find({}).toArray();
  const tickets = await db.collection('Ticket').find({}).toArray();

  const first = (row, keys, fallback = '') => keys.map((key) => row?.[key]).find((value) => String(value ?? '').trim()) ?? fallback;
  const userId = (user = {}) => first(user, ['Employee ID', 'User ID', 'EMP Code', 'employeeId', 'EmpID']);

  function normalizedDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
    const parts = String(dateStr).split(/[-/]/);
    if (parts.length === 3) {
      const d2 = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
      if (!isNaN(d2.getTime())) return d2.toISOString().split('T')[0];
    }
    return '';
  }

  const todayDate = normalizedDate(new Date().toISOString());
  console.log('Today:', todayDate);
  const isApprovedStatus = (status) => ['approved', 'approve', 'accepted'].includes(String(status || '').toLowerCase().trim());
  const onLeaveUserIds = new Set();
  
  leaves.forEach(row => {
    if (isApprovedStatus(row.Status)) {
      const start = normalizedDate(row['Start Date'] || row.StartDate || '');
      const end = normalizedDate(row['End Date'] || row.EndDate || start);
      if (start && end && start <= todayDate && todayDate <= end) {
        onLeaveUserIds.add(userId(row).toLowerCase());
        console.log('User on leave:', userId(row));
      }
    }
  });

  console.log('Users on leave:', Array.from(onLeaveUserIds));

  const buddyTickets = [];
  users.forEach(u => {
    const uId = userId(u).toLowerCase();
    if (!onLeaveUserIds.has(uId)) return;

    const buddyId = String(first(u, ['Assign Buddy', 'Buddy', 'assignBuddy']) || '').trim().toLowerCase();
    console.log(`User ${uId} on leave. Assigned buddy:`, buddyId);
    if (!buddyId) return;

    const userTickets = tickets.filter(t => userId(t).toLowerCase() === uId);
    console.log(`Found ${userTickets.length} tickets for user ${uId}`);
  });

  await client.close();
}

testBuddy().catch(console.error);
