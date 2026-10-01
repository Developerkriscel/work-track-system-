import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { rowMessage, dailyMessage } from '../services/whatsappTemplateRenderer.js';
process.env.WORKTRACK_PUBLIC_URL = 'https://kriscel.online';
const owner = { 'Employee ID': 'E1', 'Employee Name': 'Test Employee', Role: 'User' };
const manager = { 'Employee ID': 'M1', 'Employee Name': 'Test Manager', Role: 'Manager' };
const users = [owner, manager];
const ticket = { 'Ticket ID': 'T100', 'Employee ID': 'E1', 'Client Name': 'Test Client', 'Task Category': 'Development', 'Task Description': 'Build website', Priority: 'High', TAT: '60', 'Plan Date': '2026-09-11', Status: 'Open', 'Creator ID': 'M1', 'Creator Name': 'Test Manager', 'Last Action By': 'M1' };
const generated = rowMessage({ model: 'Ticket', before: null, after: ticket, recipient: 'E1', users, type: 'ticket', title: 'Ticket assigned' });
const source = fs.readFileSync(new URL('../../appscript/code.gs', import.meta.url), 'utf8');
const start = source.indexOf('const message = `🚨 *NEW TICKET ASSIGNED ALERT*');
const end = source.indexOf('`;', start) + 1;
const originalExpression = source.slice(start, end).replace(/^const message = /, '');
const original = vm.runInNewContext(originalExpression, { assignedUserNotify: owner, newTicket: { ...ticket, Name: 'Test Client' }, tatVal: '60 Mins', planDateStr: '11/09/2026', assignContext: '👤 *Assigned By:* *Test Manager*' });
assert.equal(generated, original + '\n\n🔗 *Open Portal:* https://kriscel.online/');
for (const [model, type, status, title, recipient, extra] of [
  ['Ticket', 'approval', 'Pending Approval', 'Ticket approval requested', 'M1', {}],
  ['Ticket', 'approval', 'Closed', 'Ticket Closed', 'E1', {}],
  ['Ticket', 'approval', 'Rework', 'Ticket Rework', 'E1', {}],
  ['Ticket', 'approval', 'HR Approved', 'Ticket HR Approved', 'E1', {}],
  ['Ticket', 'ticket', 'In Progress', 'Ticket status', 'E1', {}],
  ['Ticket', 'ticket', 'Open', 'Ticket assigned', 'E1', {}],
  ['Ticket', 'approval', 'Pending Approval', 'Ticket approval requested', 'M1', { 'Reassigned To': 'M1' }],
  ['Expense', 'approval', 'Pending', 'Expense approval requested', 'M1', { ExpenseID: 'EX1', Type: 'Travel', Amount: '100', Description: 'Travel expense' }],
  ['Expense', 'expense', 'Approved', 'Expense Approved', 'E1', { ExpenseID: 'EX1', Type: 'Travel', Amount: '100', Description: 'Travel expense' }],
  ['Leave', 'approval', 'Pending', 'Leave approval requested', 'M1', { 'Leave Type': 'Annual', 'Start Date': '2026-09-11', 'End Date': '2026-09-12', 'Day Type': 'Full Day', Reason: 'Personal' }],
  ['Intimation', 'approval', 'Submitted', 'Intimation approval requested', 'M1', { 'Intimation Type': 'Work', 'Intimation Date': '2026-09-11', Reason: 'Meeting' }],
  ['Leave', 'approval', 'Approved', 'Leave Approved', 'E1', { 'Leave Type': 'Annual', Reason: 'Personal' }],
]) {
  const message = rowMessage({ model, type, title, recipient, users, before: ticket, after: { ...ticket, Status: status, ...extra } });
  assert(!/undefined|NaN/.test(message), `${model}: missing template data`);
  assert(message.includes('~ Work Track System'));
  assert(message.endsWith('https://kriscel.online/'));
}
const daily = dailyMessage(owner, [{ model: 'Ticket' }, { model: 'Todo' }], '2026-09-11', new Date('2026-09-11T10:00:00+05:30'));
assert(daily.includes('🌅 *Good Morning* *Test Employee*'));
assert(daily.includes('🎫 Tickets: 1\n📝 To-Do Tasks: 1'));
assert(!daily.includes('script.google.com'));
assert(rowMessage({ model: 'Ticket', before: null, after: { ...ticket, 'Task Description': 'x'.repeat(6000) }, recipient: 'E1', users, type: 'ticket', title: 'Ticket assigned' }).length <= 4000);
console.log('Apps Script template parity, field mapping, today-only summary format, portal URL and message length checks passed. No messages sent.');
