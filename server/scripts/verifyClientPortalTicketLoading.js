import assert from 'node:assert/strict';

process.env.REDIS_URL = '';
process.env.REDIS_URI = '';

const { LegacyModels } = await import('../models/legacyModels.js');

const fieldValue = (row, field) => {
  if (field === 'legacyId') return row.legacyId;
  if (field.startsWith('data.')) return row.data?.[field.slice(5)];
  return row[field];
};

const matchesCondition = (row, condition) => {
  if (condition.$and) return condition.$and.every((part) => matchesCondition(row, part));
  if (condition.$or) return condition.$or.some((part) => matchesCondition(row, part));
  return Object.entries(condition).every(([field, expected]) => {
    const actual = fieldValue(row, field);
    if (expected instanceof RegExp) return expected.test(String(actual ?? ''));
    if (expected && typeof expected === 'object' && '$not' in expected) {
      const excluded = expected.$not;
      return excluded instanceof RegExp ? !excluded.test(String(actual ?? '')) : String(actual ?? '') !== String(excluded ?? '');
    }
    if (expected && typeof expected === 'object' && '$in' in expected) {
      return expected.$in.some((value) => String(value).toLowerCase() === String(actual ?? '').toLowerCase());
    }
    if (expected && typeof expected === 'object' && ('$gte' in expected || '$lte' in expected)) {
      const comparable = String(actual ?? '');
      if (expected.$gte && comparable < expected.$gte) return false;
      if (expected.$lte && comparable > expected.$lte) return false;
      return true;
    }
    return String(actual ?? '').toLowerCase() === String(expected ?? '').toLowerCase();
  });
};

class FakeCursor {
  constructor(rows) {
    this.rows = rows;
  }
  sort() {
    return this;
  }
  skip(value) {
    this.rows = this.rows.slice(value);
    return this;
  }
  limit(value) {
    this.rows = this.rows.slice(0, value);
    return this;
  }
  async toArray() {
    return this.rows;
  }
}

const ticketDocs = [
  {
    legacyId: 'TKT-1',
    data: {
      'Ticket ID': 'TKT-1',
      Client_Id: 'C1',
      Origin: 'client',
      Status: 'Open',
      'Plan Date': '2026-09-16',
      'Last Update Date': '2026-09-16T10:00:00.000Z',
      'Task Description': 'Client task 1'
    }
  },
  {
    legacyId: 'TKT-2',
    data: {
      'Ticket ID': 'TKT-2',
      Client_Id: 'C1',
      Origin: 'client',
      Status: 'Closed',
      'Plan Date': '2026-09-16',
      'Last Update Date': '2026-09-16T11:00:00.000Z',
      'Task Description': 'Client task 2'
    }
  },
  {
    legacyId: 'TKT-3',
    data: {
      'Ticket ID': 'TKT-3',
      Client_Id: 'C2',
      Origin: 'client',
      Status: 'Open',
      'Plan Date': '2026-09-16',
      'Task Description': 'Other client task'
    }
  },
  {
    legacyId: 'TKT-4',
    data: {
      'Ticket ID': 'TKT-4',
      Client_Id: 'C1',
      Origin: 'employee',
      Status: 'Open',
      'Plan Date': '2026-09-16',
      'Task Description': 'Internal task'
    }
  }
];

const messageDocs = [
  { legacyId: 'MSG-1', data: { MessageID: 'MSG-1', TaskID: 'TKT-1', Message: 'Hello', Timestamp: '2026-09-16T10:05:00.000Z' } },
  { legacyId: 'MSG-2', data: { MessageID: 'MSG-2', TaskID: 'TKT-2', Message: 'Other ticket', Timestamp: '2026-09-16T10:06:00.000Z' } }
];

const calls = [];
for (const [name, model] of Object.entries(LegacyModels)) {
  model.collection.findOne = async () => ({ _id: 'fixture' });
  model.collection.createIndex = async () => null;
  model.collection.find = (query = {}, options = {}) => {
    calls.push({ name, query, options });
    if (name !== 'Ticket' && name !== 'Message') {
      throw new Error(`${name} should not be loaded while reading Client Portal tickets`);
    }
    const source = name === 'Ticket' ? ticketDocs : messageDocs;
    return new FakeCursor(source.filter((row) => matchesCondition(row, query)));
  };
  model.collection.countDocuments = async (query = {}) => {
    if (name !== 'Ticket' && name !== 'Message') {
      throw new Error(`${name} should not be counted while reading Client Portal tickets`);
    }
    const source = name === 'Ticket' ? ticketDocs : messageDocs;
    return source.filter((row) => matchesCondition(row, query)).length;
  };
}

const {
  getClientTickets,
  getTicketDetails,
  getMessagesForTask
} = await import('../services/clientPortal.service.js');

const list = await getClientTickets('C1', '2026-09-16', '2026-09-16');
assert.equal(list.success, true);
assert.equal(list.data.length, 2);
assert.deepEqual(list.data.map((ticket) => ticket.ID).sort(), ['TKT-1', 'TKT-2']);

const page = await getClientTickets('C1', '2026-09-16', '2026-09-16', null, {
  paginated: true,
  statusGroup: 'all',
  page: 1,
  pageSize: 1,
  search: 'Client task',
  sortKey: 'createdDate',
  sortDirection: 'desc'
});
assert.equal(page.success, true);
assert.equal(page.data.length, 1);
assert.equal(page.pagination.total, 2);
assert.equal(page.pagination.pageSize, 1);
assert.equal(page.counts.all, 2);
assert.equal(page.counts.open, 1);
assert.equal(page.counts.closed, 1);

const open = await getClientTickets('C1', '2026-09-16', '2026-09-16', 'open');
assert.equal(open.data.length, 1);
assert.equal(open.data[0].ID, 'TKT-1');

const details = await getTicketDetails('TKT-1', 'C1');
assert.equal(details.success, true);
assert.equal(details.data.ID, 'TKT-1');

const deniedInternal = await getTicketDetails('TKT-4', 'C1');
assert.equal(deniedInternal.success, false);

const messages = await getMessagesForTask('TKT-1', 'C1');
assert.equal(messages.success, true);
assert.equal(messages.data.length, 1);
assert.equal(messages.data[0].Message, 'Hello');

assert.ok(calls.every((call) => call.name === 'Ticket' || call.name === 'Message'));
assert.ok(calls.some((call) => call.name === 'Ticket' && call.query.$and), 'Ticket reads must use scoped Mongo filters');
console.log('PASS: Client Portal tickets use scoped Ticket/Message queries and avoid full workspace loads.');
