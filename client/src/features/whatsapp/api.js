import { httpClient } from '@/lib/api/httpClient';
export const fetchWhatsAppIntegration = () => httpClient('/api/whatsapp/integration');
export const saveWhatsAppIntegration = (settings) => httpClient('/api/whatsapp/integration', { method: 'PUT', body: JSON.stringify(settings) });

export const fetchWhatsAppWorkspace = (options = {}) => {
  const params = new URLSearchParams();
  if (options.includeLogs !== undefined) params.set('includeLogs', options.includeLogs ? '1' : '0');
  if (options.historyLimit) params.set('historyLimit', String(options.historyLimit));
  const query = params.toString();
  return httpClient(`/api/whatsapp/workspace${query ? `?${query}` : ''}`);
};
export const saveWhatsAppContact = (contact) => httpClient('/api/whatsapp/contacts', { method: 'POST', body: JSON.stringify(contact) });
export const sendWhatsAppTestMessage = (contactId, payload = {}) => httpClient('/api/whatsapp/test-message', { method: 'POST', body: JSON.stringify({ contactId, ...payload }) });
