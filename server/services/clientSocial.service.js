import { insertRow, listRows, upsertRow } from './legacyStore.service.js';

const safe = (value) => String(value ?? '').trim();
const eq = (left, right) => safe(left).toLowerCase() === safe(right).toLowerCase();
const first = (row, keys, fallback = '') => keys.map((key) => row?.[key]).find((value) => safe(value)) ?? fallback;
const ok = (payload = {}) => ({ success: true, ...payload });
const fail = (message) => ({ success: false, message });

function parseReferenceNow(value) {
  if (!value) return new Date();
  if (String(value).includes('T')) return new Date(value);
  return new Date(`${value}T12:00:00+05:30`);
}

const referenceNow = () => parseReferenceNow(process.env.WORKTRACK_REFERENCE_DATE);

function nowIso() {
  return referenceNow().toISOString();
}

function normalizedDate(value) {
  if (!value) return '';
  const raw = safe(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? raw : parsed.toISOString().slice(0, 10);
}

function dateInRange(value, start, end) {
  if (!start || !end || !value) return true;
  const date = normalizedDate(value);
  return date >= start && date <= end;
}

function asSocialRow(row = {}) {
  const id = first(row, ['Post ID', 'ID', 'postId']);
  return {
    ...row,
    'Post ID': id,
    ID: id,
    Client_Id: first(row, ['Client_Id', 'Client ID', 'clientId']),
    'Client Name': first(row, ['Client Name', 'clientName']),
    Platform: first(row, ['Platform', 'platform']),
    'Content Type': first(row, ['Content Type', 'contentType'], 'Post'),
    Description: first(row, ['Description', 'Caption', 'caption']),
    Caption: first(row, ['Caption', 'Description', 'caption']),
    Status: first(row, ['Status', 'status'], 'Pending Approval'),
    'Planned Post Date': first(row, ['Planned Post Date', 'Date', 'plannedDate']),
    Date: first(row, ['Date', 'Planned Post Date', 'plannedDate']),
    CreativeLink: first(row, ['CreativeLink', 'Creative Link', 'creativeLink'])
  };
}

async function getRows() {
  const [social, socialHistory] = await Promise.all([
    listRows('SocialMedia'),
    listRows('SocialHistory')
  ]);
  return { social, socialHistory };
}

export async function getClientSocialTasks(clientId, startDate, endDate) {
  const data = await getRows();
  return ok({
    data: data.social
      .filter((row) => eq(first(row, ['Client_Id', 'Client ID', 'clientId']), clientId) && dateInRange(first(row, ['Planned Post Date', 'Date']), startDate, endDate))
      .map(asSocialRow)
  });
}

async function getOwnedSocialPost(postId, clientId) {
  const rows = await listRows('SocialMedia');
  return rows.find((row) =>
    eq(first(row, ['Post ID', 'ID', 'postId']), postId)
    && eq(first(row, ['Client_Id', 'Client ID', 'clientId']), clientId)
  );
}

export async function getSocialTaskDetails(postId, clientId) {
  const post = await getOwnedSocialPost(postId, clientId);
  return post ? ok({ data: asSocialRow(post) }) : fail('Permission denied or social task not found.');
}

export async function getSocialTaskHistory(postId, clientId) {
  const data = await getRows();
  const post = await getOwnedSocialPost(postId, clientId);
  if (!post) return fail('Permission denied or social task not found.');
  return ok({ history: data.socialHistory.filter((row) => eq(row['Post ID'], postId)) });
}

export async function updateSocialPostStatusByClient(postId, newStatus, remarks, client) {
  const clientId = client?.Client_Id || client?.['Client ID'] || '';
  const existing = await getOwnedSocialPost(postId, clientId);
  if (!existing) return fail('Permission denied or social task not found.');
  const row = await upsertRow('SocialMedia', 'Post ID', postId, {
    'Post ID': postId,
    Client_Id: clientId,
    Status: newStatus,
    'Latest Update Date': nowIso()
  });
  await insertRow('SocialHistory', {
    'History ID': `HIST_${Date.now()}`,
    'Post ID': postId,
    'Update Timestamp': nowIso(),
    'Updated By': client?.['Client Name'] || 'Client',
    Remarks: remarks,
    'Status Change': newStatus
  });
  return ok({ item: row });
}

export async function addClientRemarkToHistoryEntry(historyId, clientRemark, clientId) {
  const historyRows = await listRows('SocialHistory');
  const history = historyRows.find((row) => eq(first(row, ['History ID', 'ID', 'historyId']), historyId));
  if (!history || !(await getOwnedSocialPost(first(history, ['Post ID', 'postId']), clientId))) {
    return fail('Permission denied or social history entry not found.');
  }
  const row = await upsertRow('SocialHistory', 'History ID', historyId, {
    'History ID': historyId,
    'Client Remark': clientRemark
  });
  return ok({ item: row });
}
