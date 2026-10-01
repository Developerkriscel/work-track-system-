import { httpClient } from '@/lib/api/httpClient';

export async function fetchHolidays() {
  return httpClient('/api/settings/holidays', { method: 'GET' });
}

export async function saveHoliday(payload) {
  return httpClient('/api/settings/holidays', {
    method: 'POST',
    body: JSON.stringify({ payload })
  });
}

export async function deleteHoliday(holidayId) {
  return httpClient(`/api/settings/holidays/${encodeURIComponent(holidayId)}`, { method: 'DELETE' });
}
