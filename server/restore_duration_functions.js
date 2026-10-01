import fs from 'fs';

const filePath = 'c:\\Users\\vikas\\OneDrive\\Desktop\\work track system kriscel\\server\\services\\ticket.service.js';
let content = fs.readFileSync(filePath, 'utf8');

const lines = content.split('\n');

const replacement = `function parseTicketStartTime(value, referenceDate = referenceNow()) {
  const raw = safe(value);
  if (!raw) return null;
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime()) && /T|GMT|UTC|\\d{4}-\\d{2}-\\d{2}/i.test(raw)) return parsed;
  const match = raw.match(/(\\d{1,2}):(\\d{2})(?::(\\d{2}))?\\s*(am|pm)?/i);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = Number(match[3] || 0);
  const meridian = match[4]?.toLowerCase();
  if (meridian === 'pm' && hour < 12) hour += 12;
  if (meridian === 'am' && hour === 12) hour = 0;
  
  const dateRef = Number.isNaN(referenceDate.getTime()) ? referenceNow() : referenceDate;
  const year = dateRef.getFullYear();
  const month = String(dateRef.getMonth() + 1).padStart(2, '0');
  const day = String(dateRef.getDate()).padStart(2, '0');
  const startStr = \`\${year}-\${month}-\${day}T\${String(hour).padStart(2, '0')}:\${String(minute).padStart(2, '0')}:\${String(second).padStart(2, '0')}+05:30\`;
  const start = new Date(startStr);
  
  const now = referenceNow();
  if (start.getTime() > now.getTime()) start.setTime(start.getTime() - 86400000);
  return start;
}

function addTicketSessionDuration(existingDuration, startTimeStr, endTime = referenceNow()) {
  const start = parseTicketStartTime(startTimeStr, endTime);
  const sessionMins = start ? Math.max(0, Math.round((endTime - start) / 60000)) : 0;
  const totalMins = durationToMinutes(existingDuration) + sessionMins;
  return { sessionMins, totalStr: minutesLabel(totalMins) };
}`;

// Lines 1013 to 1024 are indices 1012 to 1023
lines.splice(1012, 12, replacement);

fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
console.log('Successfully replaced broken functions in ticket.service.js');
