import { legacyWhatsAppTemplates as templates } from './whatsappLegacyTemplates.js';
const value = (row, keys, fallback = 'N/A') => keys.map((key) => String(row?.[key] ?? '').trim()).find(Boolean) || fallback;
const idOf = (row) => value(row, ['Employee ID', 'User ID', 'employeeId', 'EmpID'], '');
const nameOf = (row) => value(row, ['Employee Name', 'Name', 'name'], idOf(row) || 'Team');
function displayDate(raw) {
  if (!raw) return 'N/A';
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T12:00:00+05:30` : raw);
  return Number.isFinite(d.getTime()) ? d.toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata' }) : raw;
}
export function finishMessage(body) {
  let link = '';
  try { const url = new URL(process.env.WORKTRACK_PUBLIC_URL); if (url.protocol === 'https:' && !url.username && !url.password) link = `\n\nðŸ”— *Open Portal:* ${url.href}`; } catch { /* No link until the current portal URL is configured. */ }
  return body.length + link.length <= 4000 ? body + link : body.slice(0, Math.max(0, 3950 - link.length)) + '\nâ€¦\n~ Work Track System' + link;
}
export function rowMessage({ model, before, after: row, recipient, users, type, title }) {
  const owner = users.find((u) => idOf(u) === idOf(row)) || row;
  const target = users.find((u) => idOf(u) === recipient) || owner;
  const actorRef = value(row, ['Last Action By', 'Approved By', 'Approver', 'Updated By', 'Reassigned By', 'Creator ID', 'Created By'], '');
  const actor = users.find((u) => idOf(u) === actorRef || nameOf(u) === actorRef);
  const actorName = actor ? nameOf(actor) : actorRef || 'System';
  const ticketId = value(row, ['Ticket ID', 'Task ID', 'ID']);
  const clientName = value(row, ['Client Name', 'Name', 'Client']);
  const category = value(row, ['Task Category', 'Category']);
  const description = value(row, ['Task Description', 'Description', 'Task']).slice(0, 1800);
  const remarks = value(row, ['Admin Remarks', 'Admin Remarks/Feedback', 'Remarks', 'remarks'], '').slice(-700);
  const status = value(row, ['Status', 'status']);
  const planDateStr = displayDate(value(row, ['Plan Date', 'Date'], ''));
  const tat = value(row, ['TAT', 'tatMinutes'], '0');
  const priority = value(row, ['Priority', 'priority'], 'Normal');
  const employee = { ...owner, 'Employee Name': nameOf(owner) };
  const person = { ...target, 'Employee Name': nameOf(target) };
  const admin = { ...actor, 'Employee Name': actorName };
  const common = { ticketId, clientName, category, description, remarks, priority, tat, tatVal: `${tat} Mins`, planDateStr, fullDesc: description, adminUser: admin, adminRole: value(actor, ['Role', 'role'], 'N/A') };
  let body;
  if (model === 'Ticket' && type === 'ticket' && title === 'Ticket assigned') {
    const creatorId = value(row, ['Creator ID', 'Created By'], '');
    const creatorName = value(row, ['Creator Name', 'Created By Name'], actorName);
    const assignContext = creatorId === recipient ? 'ðŸ‘¤ *Created By:* *Self (Self-Created)*' : /client/i.test(value(row, ['Source'], '') + creatorName) ? 'ðŸ‘¤ *Created By:* *Client (Direct Portal)*' : `ðŸ‘¤ *Assigned By:* *${creatorName}*`;
    body = before ? templates.ticketReassigned({ ...common, newUser: person, assignerText: `ðŸ‘¤ *Reassigned By:* *${actorName}*` }) : templates.ticketAssigned({ ...common, assignedUserNotify: person, newTicket: { ...row, Name: clientName, Priority: priority, 'Task Description': description }, assignContext });
  } else if (model === 'Ticket' && type === 'approval' && /requested/.test(title)) {
    const transferred = before && value(before, ['Reassigned To', 'Task Approver'], '') !== value(row, ['Reassigned To', 'Task Approver'], '');
    body = transferred ? templates.approvalTransfer({ ...common, targetManager: person, currentManager: admin, completedByName: nameOf(owner), completedBy: idOf(owner) }) : templates.ticketApproval({ ...common, approverUser: person, ticketRow: { ...row, Name: clientName }, actionBy: nameOf(owner), assignedTAT: `${tat} Mins`, actualTimeTaken: value(row, ['Total Duration', 'Duration']), userRemarks: remarks || 'No remarks provided.' });
  } else if (model === 'Ticket' && /^(Closed|Approved|HR Approved|Rejected|Rework)$/i.test(status)) {
    body = /^HR Approved$/i.test(status) ? templates.ticketHrApproved(common) : /rejected|rework/i.test(status) ? templates.ticketRework(common) : templates.ticketClosed(common);
  } else if (model === 'Ticket' && status === 'In Progress') {
    body = templates.timerStarted({ ...common, user: person });
  } else if (model === 'Expense' && type === 'approval' && /requested/.test(title)) {
    body = templates.expenseRequest({ rec: { name: nameOf(target) }, expenseData: { ...row, 'Employee Name': nameOf(owner), Type: value(row, ['Type', 'Expense Type']), Amount: Number(row.Amount) || 0 } });
  } else if (model === 'Expense' && /^(approved|rejected)$/i.test(status)) {
    body = templates.expenseResult({ emoji: /^approved$/i.test(status) ? 'âœ…' : 'âŒ', status, employee, expenseId: value(row, ['ExpenseID', 'Expense ID', 'ID']), expenseRow: { ...row, Type: value(row, ['Type', 'Expense Type']), Amount: Number(row.Amount) || 0 }, admin, remarks });
  } else if (model === 'Leave' && /requested/.test(title)) {
    body = templates.leaveRequest({ rec: { name: nameOf(target) }, leaveData: { ...row, 'Employee Name': nameOf(owner) }, sDateStr: displayDate(row['Start Date']), eDateStr: displayDate(row['End Date']) });
  } else if (model === 'Intimation' && /requested/.test(title)) {
    body = templates.intimationRequest({ rec: { name: nameOf(target) }, intimationData: { ...row, 'Employee Name': nameOf(owner) }, dateStr: displayDate(row['Intimation Date']) });
  } else if (['Leave', 'Intimation'].includes(model)) {
    body = templates.requestResult({ emoji: /^approved$/i.test(status) ? 'âœ…' : 'âŒ', type: model, statusLabel: status.toUpperCase(), employeeObj: employee, subType: value(row, ['Leave Type', 'Intimation Type']), dateStr: displayDate(value(row, ['Start Date', 'Intimation Date', 'Date'], '')), reason: value(row, ['Reason']), remarks });
  } else {
    // No equivalent Apps Script template exists for these current events.
    body = `ðŸ”” *${title.toUpperCase()}* ðŸ””\n---------------------------------\nHello *${nameOf(target)}*,\n\nðŸ“Œ *Reference:* *${value(row, ['Ticket ID', 'Task ID', 'ExpenseID', 'AttendanceID', 'ID'])}*\nðŸ“ *Details:* ${description}\nâš™ï¸ *Status:* *${status}*\n\n~ Work Track System`;
  }
  return finishMessage(body);
}
export function dailyMessage(user, items, day, now = new Date()) {
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', hourCycle: 'h23' }).format(now));
  const greeting = hour < 12 ? 'ðŸŒ… *Good Morning*' : hour < 17 ? 'â˜€ï¸ *Good Afternoon*' : 'ðŸŒ† *Good Evening*';
  let body = `${greeting} *${nameOf(user)}*,\n\nðŸ“… *Date:* ${displayDate(day)}\n\n*ðŸ“Œ Your Pending Task Reminder:*\n`;
  for (const [model, label] of [['Ticket', 'ðŸŽ« Tickets'], ['Todo', 'ðŸ“ To-Do Tasks'], ['FmsTask', 'ðŸ“‹ FMS Tasks']]) {
    const count = items.filter((item) => item.model === model).length;
    if (count) body += `${label}: ${count}\n`;
  }
  return finishMessage(`${body}\nThese are your open tasks due today, overdue, or without a due date.\nPlease review and update them in the portal.\n~ Work Track System`);
}

export function noTicketAfterPresentMessage(user, day, punchInAt, now = new Date()) {
  const punchInText = Number.isFinite(punchInAt)
    ? new Date(punchInAt).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    : 'today';
  const body = `🔔 *No Ticket / Work Entry Reminder*
---------------------------------
Hello *${nameOf(user)}*,

📅 *Date:* ${displayDate(day)}
🕒 *Punch In:* ${punchInText}

You are marked present, but no ticket/work entry has been found even after 30 minutes of punch in.

Please create or update your ticket/work entry so today's work is recorded correctly.

~ Work Track System`;
  return finishMessage(body);
}

