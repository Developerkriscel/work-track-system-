import assert from 'node:assert/strict';
import { attendanceSchedule } from '../services/whatsappAttendanceSchedule.js';

const day = '2026-09-11';
const user = (id, role = 'User') => ({ 'Employee ID': id, 'Employee Name': `${id} Name`, Role: role, Status: 'Active' });
const punch = (id, kind, time, extra = {}) => ({ 'Employee ID': id, Date: day, Action: `Punch ${kind}`, Time: `${day}T${time}:00+05:30`, ...extra });
const rows = {
  User: [user('P'), user('H'), user('A'), user('AS101', 'Super Admin'), user('MS101', 'Admin'), { ...user('DISABLED'), Status: 'Inactive' }],
  Attendance: [punch('P', 'In', '10:00'), punch('H', 'In', '10:20'), punch('AS101', 'In', '09:30'), punch('MS101', 'In', '09:45')],
  Leave: []
};
const at = (time, data = rows) => attendanceSchedule(data, new Date(`${day}T${time}:00+05:30`), { day, time });

assert.equal(at('10:14').length, 0);
assert.deepEqual(at('10:15').filter((e) => e.event.startsWith('missed-in:')).map((e) => e.employeeId).sort(), ['A', 'H']);
const summary = at('10:30', { ...rows, Intimation: [{ IntimationID: 'I1', 'Employee ID': 'A', Status: 'Submitted', 'Intimation Date': day }] }).filter((e) => e.event.startsWith('attendance-summary:'));
assert.equal(summary.length, 2);
assert.deepEqual(summary.map((e) => e.employeeId).sort(), ['AS101', 'MS101']);
assert.match(summary[0].message, /Total Present: 4/);
assert.match(summary[0].message, /Total Absent: 1/);
assert.match(summary[0].message, /Leave Requests: 0/);
assert.match(summary[0].message, /Intimations: 1/);
assert.equal(at('18:14').filter((e) => e.event.startsWith('missed-out:')).length, 0);
assert.deepEqual(at('18:15').filter((e) => e.event.startsWith('missed-out:')).map((e) => e.employeeId).sort(), ['AS101', 'H', 'MS101', 'P']);
assert.equal(at('18:15').filter((e) => e.event.startsWith('missed-in:')).length, 0);

const checkedOut = { ...rows, Attendance: [...rows.Attendance, punch('P', 'Out', '18:00')] };
assert(!at('18:15', checkedOut).some((e) => e.employeeId === 'P' && e.event.startsWith('missed-out:')));

const caughtUp = { ...rows, Attendance: [...rows.Attendance, punch('A', 'In', '11:00')] };
assert(at('18:15', caughtUp).some((e) => ['AS101', 'MS101'].includes(e.employeeId) && e.event.startsWith('attendance-summary:')));

const onLeave = { ...rows, Leave: [{ 'Employee ID': 'A', Status: 'Approved', 'Day Type': 'Full Day', 'Start Date': day, 'End Date': day }] };
assert(!at('10:30', onLeave).some((e) => e.employeeId === 'A' && e.event.startsWith('missed-in:')));
const appliedLeave = { ...rows, Leave: [{ 'Employee ID': 'A', Status: 'Pending', 'Day Type': 'Full Day', 'Start Date': day, 'End Date': day }] };
assert(!at('10:30', appliedLeave).some((e) => e.employeeId === 'A' && e.event.startsWith('missed-in:')));

const promoted = { ...rows, User: [...rows.User, user('HR', 'HR'), user('SA2', 'Super Admin')] };
assert.deepEqual(at('10:30', promoted).filter((e) => e.event.startsWith('attendance-summary:')).map((e) => e.employeeId).sort(), ['AS101', 'MS101']);

const sunday = '2026-09-13';
assert(!attendanceSchedule({ User: rows.User }, new Date(`${sunday}T10:15:00+05:30`), { day: sunday, time: '10:15' }).some((e) => e.event.startsWith('missed-in:')));

console.log('Attendance schedule passed: AS101/MS101 attendance summary, own missing-in, own missing-out, future punches, checkout suppression, inactive users, approved leave and weekly off. No messages sent.');
