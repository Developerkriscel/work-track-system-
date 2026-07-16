import { listRows, replaceCollection } from '../services/legacyStore.service.js';

export const TEST_ARTIFACT_PATTERNS = [
  /SMOKE/i,
  /LIFECYCLE/i,
  /PARITY/i,
  /NOATT_/i,
  /ADMIN_NOATT_/i,
  /ATTENDANCE_GATE/i,
  /Should be blocked/i,
  /Should be ignored/i,
  /Expense receipt parity smoke/i,
  /Chat unread flag parity smoke/i,
  /Approval parity/i,
  /To-Do parity/i,
  /Attendance gate smoke/i,
  /Smoke task/i
];

export const TEST_ARTIFACT_COLLECTIONS = [
  'User',
  'Ticket',
  'Todo',
  'Attendance',
  'Leave',
  'Intimation',
  'Expense',
  'Message',
  'SocialMedia',
  'SocialHistory',
  'FormsPortal',
  'FmsTask',
  'TicketHistory'
];

export function isTestArtifact(row = {}) {
  const raw = JSON.stringify(row);
  return TEST_ARTIFACT_PATTERNS.some((pattern) => pattern.test(raw));
}

export async function purgeTestArtifacts() {
  const removed = {};

  for (const modelName of TEST_ARTIFACT_COLLECTIONS) {
    const rows = await listRows(modelName);
    const filtered = rows.filter((row) => !isTestArtifact(row));
    removed[modelName] = rows.length - filtered.length;
    if (removed[modelName]) {
      await replaceCollection(modelName, filtered);
    }
  }

  return removed;
}
