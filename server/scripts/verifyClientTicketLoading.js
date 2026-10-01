import assert from 'node:assert/strict';

// Offline fixtures: no database writes, server, or outgoing notifications.
process.env.REDIS_URL = '';
process.env.REDIS_URI = '';
const { LegacyModels } = await import('../models/legacyModels.js');
const { getTicketSystemData } = await import('../services/ticket.service.js');
const calls = [];
const users = [
  { 'Employee ID': 'SA', Role: 'Super Admin', Status: 'Active' },
  { 'Employee ID': 'E1', Role: 'Employee', Status: 'Active' },
  { 'Employee ID': 'E2', Role: 'Employee', Status: 'Active' }
];
const tickets = Array.from({ length: 23 }, (_, i) => ({
  'Ticket ID': `C${i}`, 'Employee ID': i < 13 ? 'E1' : 'E2',
  Origin: 'client', Status: 'Open', 'Task Description': `Client task ${i}`
}));
for (const [name, model] of Object.entries(LegacyModels)) {
  model.collection.findOne = async () => ({ _id: 'fixture' });
  model.collection.find = (query, options = {}) => {
    calls.push({ name, query });
    if (name === 'Leave' || name === 'Intimation') throw new Error('Unrelated leave query');
    if (name === 'Ticket' && options.projection?.['data.Status']) {
      assert.ok(query.$and?.some((part) => part.$or?.some((condition) => condition['data.Origin'])), 'Client origin must be filtered in Mongo');
    }
    const rows = name === 'User' ? users : name === 'Ticket' ? tickets : [];
    return { toArray: async () => rows.map((data, i) => ({ legacyId: `${name}${i}`, data })) };
  };
}
const first = await getTicketSystemData('SA', 'Super Admin', { viewMode: 'client', page: 1, pageSize: 10 });
assert.equal(first.pagination.total, 23);
assert.equal(first.clientOriginTickets.length, 10);
const last = await getTicketSystemData('SA', 'Super Admin', { viewMode: 'client', page: 3, pageSize: 10 });
assert.equal(last.clientOriginTickets.length, 3);
const employee = await getTicketSystemData('E1', 'Employee', { viewMode: 'client', page: 1, pageSize: 10 });
assert.equal(employee.pagination.total, 13);
assert.ok(employee.clientOriginTickets.every((row) => row['Employee ID'] === 'E1'));
assert.equal(calls.filter((call) => call.name === 'Ticket' && call.query.$and).length, 2, 'Page changes reuse the scoped rows');
console.log('PASS: Client queries scoped, no leave/Buddy reads, pagination and employee permissions preserved.');
