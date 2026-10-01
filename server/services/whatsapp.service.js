/**
 * WhatsApp Service via AKNexus
 * Endpoint: POST https://app.aknexus.in/api/send
 */

const AKNEXUS_BASE_URL  = 'https://app.aknexus.in';
const INSTANCE_ID       = process.env.AKNEXUS_INSTANCE_ID;
const ACCESS_TOKEN      = process.env.AKNEXUS_ACCESS_TOKEN;

/**
 * Send a plain text WhatsApp message.
 * @param {string} toPhone - Recipient phone with country code, no + (e.g. "919876543210")
 * @param {string} message - Text message to send
 */
export async function sendWhatsAppMessage(toPhone, message) {
  if (!INSTANCE_ID || !ACCESS_TOKEN) {
    console.warn('[WhatsApp] AKNEXUS_INSTANCE_ID or AKNEXUS_ACCESS_TOKEN not set — skipping.');
    return null;
  }

  // Clean phone number — remove +, spaces, dashes
  const phone = String(toPhone || '').replace(/[^0-9]/g, '');
  if (!phone || phone.length < 10) {
    console.warn(`[WhatsApp] Invalid phone number: ${toPhone}`);
    return null;
  }

  const body = {
    number:       phone,
    type:         'text',
    message:      String(message || ''),
    instance_id:  INSTANCE_ID,
    access_token: ACCESS_TOKEN
  };

  try {
    const response = await fetch(`${AKNEXUS_BASE_URL}/api/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const data = await response.json();

    if (data?.status === 'success' || data?.sent === true || response.ok) {
      console.log(`[WhatsApp] ✅ Message sent to ${phone}`);
    } else {
      console.warn(`[WhatsApp] ⚠️ Response:`, JSON.stringify(data));
    }

    return data;
  } catch (err) {
    console.error(`[WhatsApp] ❌ Failed to send to ${phone}:`, err.message);
    return null;
  }
}

// ─── Pre-built notification helpers ───────────────────────────────────────────

/** Notify employee when a ticket is assigned */
export async function notifyTicketAssigned({ employeeName, employeePhone, ticketId, clientName, description, priority }) {
  const message =
    `🎫 *New Ticket Assigned*\n\n` +
    `Hello ${employeeName || 'Team'},\n\n` +
    `A ticket has been assigned to you.\n\n` +
    `*Ticket ID:* ${ticketId}\n` +
    `*Client:* ${clientName || '-'}\n` +
    `*Description:* ${description || '-'}\n` +
    `*Priority:* ${priority || 'Normal'}\n\n` +
    `Please login to the work portal to view details.`;

  return sendWhatsAppMessage(employeePhone, message);
}

/** Notify when ticket status changes */
export async function notifyTicketStatusChange({ phone, recipientName, ticketId, oldStatus, newStatus, clientName }) {
  const message =
    `🔄 *Ticket Status Updated*\n\n` +
    `Hello ${recipientName || 'Team'},\n\n` +
    `*Ticket ID:* ${ticketId}\n` +
    `*Client:* ${clientName || '-'}\n` +
    `*Status:* ${oldStatus} → *${newStatus}*\n\n` +
    `Login to the work portal for more details.`;

  return sendWhatsAppMessage(phone, message);
}

/** Notify manager for pending approval */
export async function notifyPendingApproval({ managerPhone, managerName, ticketId, employeeName, clientName }) {
  const message =
    `⏳ *Ticket Pending Approval*\n\n` +
    `Hello ${managerName || 'Manager'},\n\n` +
    `A ticket is awaiting your approval.\n\n` +
    `*Ticket ID:* ${ticketId}\n` +
    `*Employee:* ${employeeName || '-'}\n` +
    `*Client:* ${clientName || '-'}\n\n` +
    `Please login to approve or reject.`;

  return sendWhatsAppMessage(managerPhone, message);
}

/** Notify client when their ticket is updated */
export async function notifyClientTicketUpdate({ clientPhone, clientName, ticketId, status, remarks }) {
  const message =
    `📋 *Ticket Update — Kriscel*\n\n` +
    `Hello ${clientName || 'Valued Client'},\n\n` +
    `Your ticket has been updated.\n\n` +
    `*Ticket ID:* ${ticketId}\n` +
    `*Status:* ${status}\n` +
    (remarks ? `*Update:* ${remarks}\n` : '') +
    `\nLogin to your client portal for details.`;

  return sendWhatsAppMessage(clientPhone, message);
}

/** Send any custom message */
export async function sendCustomNotification(phone, message) {
  return sendWhatsAppMessage(phone, message);
}
