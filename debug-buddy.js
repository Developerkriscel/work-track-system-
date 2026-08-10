import 'dotenv/config';
import { connectDatabase } from './server/config/database.js';
import mongoose from 'mongoose';
import { LegacyModels } from './server/models/legacyModels.js';

const safe = (value) => String(value ?? '').trim();
const eq = (left, right) => safe(left).toLowerCase() === safe(right).toLowerCase();
const first = (row, keys, fallback = '') => keys.map((key) => row?.[key]).find((value) => safe(value)) ?? fallback;
const userId = (user = {}) => first(user, ['Employee ID', 'User ID', 'EMP Code', 'employeeId', 'EmpID']);

const normalizedDate = (dateStr) => {
  if (!dateStr) return null;
  const str = String(dateStr).trim();
  const parts = str.split(/[-/]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
  }
  return null;
};
const isApprovedStatus = (status) => ['approved', 'approve', 'accepted'].includes(String(status || '').toLowerCase().trim());

async function run() {
  await connectDatabase();
  const leaves = await LegacyModels.Leave.find({}).lean().then(r => r.map(x=>x.data));
  const intimations = await LegacyModels.Intimation.find({}).lean().then(r => r.map(x=>x.data));
  const usersRaw = await LegacyModels.User.find({}).lean().then(r => r.map(x=>x.data));
  const empMasters = await LegacyModels.EmpMaster.find({}).lean().then(r => r.map(x=>x.data));
  const tickets = await LegacyModels.Ticket.find({}).lean().then(r => r.map(x=>x.data));
  
  const users = usersRaw.map(user => {
    const empData = empMasters.find(e => safe(userId(e)).toLowerCase() === safe(userId(user)).toLowerCase());
    return { ...user, ...(empData || {}) };
  });

  const todayDate = new Date().toISOString().split('T')[0];
  console.log('todayDate:', todayDate);
  const onLeaveUserIds = new Set();
  
  leaves.forEach(row => {
    const status = first(row, ['Status', 'status', 'Approval Status']);
    if (isApprovedStatus(status)) {
      const start = normalizedDate(first(row, ['Start Date', 'StartDate', 'Date', 'date']));
      const end = normalizedDate(first(row, ['End Date', 'EndDate', 'Start Date', 'StartDate', 'Date', 'date']));
      if (start && end && start <= todayDate && todayDate <= end) {
        onLeaveUserIds.add(userId(row).toLowerCase());
        console.log('Added user on leave:', userId(row).toLowerCase(), 'Status:', status, 'Start:', start, 'End:', end);
      }
    }
  });

  const buddyTickets = [];
  users.forEach(u => {
    const uId = userId(u).toLowerCase();
    if (!onLeaveUserIds.has(uId)) return;

    const buddyId = String(first(u, ['Assign Buddy', 'Buddy', 'assignBuddy']) || '').trim().toLowerCase();
    console.log('Buddy ID for', uId, 'is', buddyId);
    if (!buddyId) return;

    const employeeId = 'kris_008';
    let canViewBuddy = false;
    const currentEmpId = String(employeeId).toLowerCase();
    if (buddyId === currentEmpId || buddyId.includes(currentEmpId) || buddyId.includes(`(${currentEmpId})`)) {
      canViewBuddy = true;
    }
    console.log('canViewBuddy:', canViewBuddy);
    if (canViewBuddy) {
      const userTickets = tickets.filter(t => userId(t).toLowerCase() === uId);
      console.log('Tickets for', uId, ':', userTickets.length);
      userTickets.forEach(ticket => buddyTickets.push(ticket));
    }
  });
  
  console.log('Total buddy tickets for KRIS_008:', buddyTickets.length);
  process.exit();
}
run().catch(console.error);
