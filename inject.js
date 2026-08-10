const fs = require('fs');
const filePath = 'server/services/ticket.service.js';
let content = fs.readFileSync(filePath, 'utf8');

const target = `  return ok({
    clients,
    users: assignableUsers,`;

const injected = `  try {
    const fs = await import('fs');
    const debugInfo = {
      todayDate,
      onLeaveUserIds: Array.from(onLeaveUserIds),
      leavesSample: (data.leaves || []).map(l => ({ id: userId(l), status: first(l, ['Status', 'status', 'Approval Status']), start: first(l, ['Start Date', 'StartDate', 'Date', 'date']), end: first(l, ['End Date', 'EndDate', 'Start Date', 'StartDate', 'Date', 'date']) })).filter(l => l.status && isApprovedStatus(l.status)),
      employeeId,
      role,
      buddyTicketsCount: buddyTickets.length
    };
    fs.writeFileSync('buddy-debug.log', JSON.stringify(debugInfo, null, 2));
  } catch(e) {}
` + target;

content = content.replace(target, injected);
fs.writeFileSync(filePath, content);
console.log('Injected successfully');
