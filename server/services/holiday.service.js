import { deleteRow, insertRow, listRows, upsertRow } from './legacyStore.service.js';

const safe = (value) => String(value ?? '').trim();
const ok = (payload = {}) => ({ success: true, ...payload });
const fail = (message) => ({ success: false, message });

export function normalizeHolidayDate(value) {
  const raw = safe(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const dmy = raw.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (dmy) return `${dmy[3]}-${String(dmy[2]).padStart(2, '0')}-${String(dmy[1]).padStart(2, '0')}`;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(parsed);
  const map = Object.fromEntries(parts.map(({ type, value: part }) => [type, part]));
  return `${map.year}-${map.month}-${map.day}`;
}

export function isActiveHoliday(row = {}) {
  return !/^(inactive|deleted|cancelled|canceled)$/i.test(safe(row.Status || row.status));
}

export function holidayDateOf(row = {}) {
  return normalizeHolidayDate(row.Date || row.date || row['Holiday Date'] || row.holidayDate);
}

export function holidayNameOf(row = {}) {
  return safe(row.Name || row.name || row['Holiday Name'] || row.Title || row.title) || 'Holiday';
}

export async function listHolidays({ startDate = '', endDate = '', includeInactive = false } = {}) {
  const start = startDate ? normalizeHolidayDate(startDate) : '';
  const end = endDate ? normalizeHolidayDate(endDate) : '';
  const rows = (await listRows('Holiday'))
    .map((row) => ({
      ...row,
      HolidayID: safe(row.HolidayID || row['Holiday ID'] || row.ID || row.holidayId),
      Date: holidayDateOf(row),
      Name: holidayNameOf(row),
      Description: safe(row.Description || row.description || row.Remarks || row.remarks),
      Status: safe(row.Status || row.status || 'Active') || 'Active'
    }))
    .filter((row) => row.Date)
    .filter((row) => includeInactive || isActiveHoliday(row))
    .filter((row) => !start || row.Date >= start)
    .filter((row) => !end || row.Date <= end)
    .sort((left, right) => right.Date.localeCompare(left.Date) || left.Name.localeCompare(right.Name));
  return ok({ data: rows });
}

export async function saveHoliday(payload = {}, editor = {}) {
  const date = normalizeHolidayDate(payload.Date || payload.date || payload.holidayDate);
  const name = holidayNameOf(payload);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return fail('Holiday date is required.');
  if (!name) return fail('Holiday name is required.');
  const id = safe(payload.HolidayID || payload['Holiday ID'] || payload.ID || payload.holidayId) || `HOL_${date.replace(/-/g, '')}`;
  const row = {
    HolidayID: id,
    'Holiday ID': id,
    ID: id,
    Date: date,
    'Holiday Date': date,
    Name: name,
    'Holiday Name': name,
    Description: safe(payload.Description || payload.description || payload.Remarks || payload.remarks),
    Status: safe(payload.Status || payload.status || 'Active') || 'Active',
    'Updated By': safe(editor?.sub || editor?.employeeId || editor?.['Employee ID']),
    'Updated At': new Date().toISOString()
  };
  const saved = safe(payload.HolidayID || payload['Holiday ID'] || payload.ID || payload.holidayId)
    ? await upsertRow('Holiday', 'HolidayID', id, row)
    : await insertRow('Holiday', row);
  return ok({ message: 'Holiday saved successfully.', item: saved });
}

export async function removeHoliday(id = '') {
  const holidayId = safe(id);
  if (!holidayId) return fail('Holiday ID is required.');
  const deleted = await deleteRow('Holiday', 'HolidayID', holidayId);
  if (!deleted) return fail('Holiday not found.');
  return ok({ message: 'Holiday deleted successfully.', item: deleted });
}
