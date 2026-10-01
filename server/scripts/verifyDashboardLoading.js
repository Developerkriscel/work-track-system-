// Offline dashboard regression: no database or scheduler is started.
import assert from 'node:assert/strict';
process.env.REDIS_URL = '';
process.env.REDIS_URI = '';
process.env.WORKTRACK_REFERENCE_DATE = '2026-09-11';
const { LegacyModels } = await import('../models/legacyModels.js');
const { getDashboardData } = await import('../services/dashboard.service.js');
const { touchStoreMutation } = await import('../services/legacyStore.service.js');
const users = [{ 'Employee ID': 'U1', 'Employee Name': 'Test', Role: 'Admin', Status: 'Active' }];
const dates = ['2026-09-11', '09/11/2026', '11/09/2026', '9/11/26', '11-Sep-2026', '2026-09-11T09:00:00Z'];
const tickets = dates.map((date, i) => ({ 'Ticket ID': `T${i}`, 'Employee ID': 'U1', 'Plan Date': date, Status: 'Open', TAT: '60' }));
tickets.push({ 'Ticket ID': 'OLD', 'Employee ID': 'U1', 'Plan Date': '2025-01-20', Status: 'Closed' });
const rows = { User: users, Ticket: tickets, FmsTask: [], Todo: [], Expense: [], TicketHistory: [], Leave: [] };
function condition(value, wanted) {
  if (wanted instanceof RegExp) return typeof value === 'string' && wanted.test(value);
  if (wanted && typeof wanted === 'object') return Object.entries(wanted).every(([op, arg]) => {
    if (op === '$in') return arg.includes(value);
    if (op === '$type') return arg === 'string' ? typeof value === 'string' : value instanceof Date;
    if (op === '$regex') return typeof value === 'string' && new RegExp(arg, wanted.$options || '').test(value);
    if (op === '$options') return true;
    if (op === '$not') return !condition(value, arg);
    throw new Error(`Unsupported fixture operator ${op}`);
  });
  return value === wanted;
}
function matches(doc, query) {
  return Object.entries(query).every(([field, value]) => field === '$and' ? value.every((q) => matches(doc, q))
    : field === '$or' ? value.some((q) => matches(doc, q))
      : condition(field.split('.').reduce((obj, key) => obj?.[key], doc), value));
}
let reads = 0;
for (const [name, model] of Object.entries(LegacyModels)) {
  const docs = () => (rows[name] || []).map((data, i) => ({ legacyId: `${name}${i}`, data }));
  model.collection.find = (query) => ({ toArray: async () => { reads++; await new Promise((r) => setTimeout(r, 5)); return docs().filter((doc) => matches(doc, query)); } });
  model.collection.findOne = async (query) => { reads++; return docs().find((doc) => matches(doc, query)) || null; };
  model.collection.countDocuments = async (query) => docs().filter((doc) => matches(doc, query)).length;
}
const options = { includeTasks: true, includeCollections: false, includeSummary: true };
const [one, two] = await Promise.all([getDashboardData('U1', 'today', 'my', options), getDashboardData('U1', 'today', 'my', options)]);
assert.deepEqual(one, two);
assert.equal(one.data.kpis.pendingTickets, 5, 'Keep mixed legacy date formats');
assert.equal(one.data.todaysTasks.length, 5);
assert.equal(one.data.kpis.plannedBandwidthHours, '5h 0m');
assert.equal(reads, 8, 'Concurrent requests share one snapshot computation');
const before = reads;
touchStoreMutation('WhatsAppLog');
await getDashboardData('U1', 'today', 'my', options);
assert.equal(reads, before, 'Unrelated log writes must not flush dashboard caches');
touchStoreMutation('Ticket');
await getDashboardData('U1', 'today', 'my', options);
assert(reads > before, 'Ticket writes invalidate cached dashboard');
const emptyTeam = await getDashboardData('U1', 'today', 'team', options);
assert.equal(emptyTeam.data.taskTotals.all, 0, 'An empty team must not load the manager’s own tickets');
const all = await getDashboardData('U1', 'all', 'my', options);
assert.equal(all.data.taskTotals.tickets, 7);
console.log('PASS: mixed dates, KPI/task consistency, shared reads, cache invalidation, empty-team scope and All Time.');
