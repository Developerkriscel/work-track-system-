import { employeeIdOf, field, isActive } from './whatsappAlertRules.js';
import { finishMessage } from './whatsappTemplateRenderer.js';
import { legacyWhatsAppTemplates } from './whatsappLegacyTemplates.js';

export const clientIdOf = (row) => field(row, ['Client_Id', 'Client ID', 'clientId', 'CustomerID']);
export const clientPhoneOf = (row) => field(row, ['WhatsApp Number', 'Whatsapp Number', 'WhatsApp', 'Mobile Number', 'Contact', 'Mobile', 'Phone', 'phone', 'mobile']);
export const clientNameOf = (row) => field(row, ['Client Name', 'ClientName', 'Name']) || 'Client';
const admin = (user) => /^admin$/i.test(field(user, ['Role', 'role']));
const clientTicket = (ticket) => /^client$/i.test(field(ticket, ['Origin', 'origin']))
  || /client portal|^client$/i.test(field(ticket, ['Source', 'Ticket Source']))
  || /^(yes|true)$/i.test(field(ticket, ['Client Ticket', 'Is Client Ticket']))
  || /created from (mern )?client portal/i.test(field(ticket, ['Remarks']));

export function buildClientTicketAlerts(change, ticket, users, clients) {
  if (!ticket || !clientTicket(ticket)) return [];
  const clientId = clientIdOf(ticket);
  const client = clients.find((row) => clientIdOf(row) === clientId);
  if (!clientId) return [];
  const entityId = field(ticket, ['Ticket ID', 'ID']);
  const created = change.model === 'Ticket' && !change.before;
  const chat = change.model === 'Message' && !change.before;
  if (!created && !chat) return [];
  const senderType = field(change.after, ['Sender Type']);
  const senderId = field(change.after, ['Sender ID']);
  // Explicit authenticated sender IDs avoid guessing identities from display names.
  if (chat && (!senderId || !['client', 'employee'].includes(senderType))) return [];
  if (chat && senderType === 'client' && senderId !== clientId) return [];
  const recipients = users.filter((user) => isActive(user) && (admin(user) || (chat && employeeIdOf(user) === employeeIdOf(ticket))))
    .filter((user) => !(chat && senderType === 'employee' && employeeIdOf(user) === senderId))
    .map((user) => ({ employeeId: employeeIdOf(user), name: field(user, ['Employee Name', 'Name']) }));
  if (client && isActive(client) && !(chat && senderType === 'client')) recipients.push({ clientId, name: clientNameOf(client) });
  const event = created ? `client-created:${entityId}` : `client-chat:${field(change.after, ['MessageID', 'ID'])}`;
  return recipients.map((recipient) => ({ ...recipient, alertType: 'ticket', entityId, event,
    message: chat ? finishMessage(legacyWhatsAppTemplates.chatMessage({
      recipientObj: { 'Employee Name': recipient.name }, senderName: field(change.after, ['Sender']), taskId: entityId,
      messageText: `${field(change.after, ['Message'])}${field(change.after, ['Attachment']) ? '\n📎 Attachment shared — open the portal to view.' : ''}`.slice(0, 2600),
      clientName: clientNameOf(client || ticket)
    })) : finishMessage(`🎫 *NEW CLIENT TICKET*\n---------------------------------\nHello *${recipient.name}*,\n\n${recipient.clientId ? 'Your ticket has been created successfully.' : 'A client has created a new ticket.'}\n\n🎫 *Ticket ID:* ${entityId}\n🏢 *Client:* ${clientNameOf(client || ticket)}\n📋 *Category:* ${field(ticket, ['Task Category'])}\n⚡ *Priority:* ${field(ticket, ['Priority'])}\n📅 *Expected Date:* ${field(ticket, ['Plan Date']) || 'Not specified'}\n📝 *Description:* ${field(ticket, ['Task Description', 'Description']).slice(0, 2200)}\n\n~ Work Track System`)
  }));
}

export function clientAlertRecipientStillAllowed(job, ticket, users, clients) {
  if (!ticket || !clientTicket(ticket)) return false;
  if (job.clientId) return clientIdOf(ticket) === job.clientId && clients.some((row) => clientIdOf(row) === job.clientId && isActive(row));
  const user = users.find((row) => employeeIdOf(row) === job.employeeId);
  return isActive(user) && (admin(user) || (job.event?.startsWith('client-chat:') && employeeIdOf(ticket) === job.employeeId));
}
