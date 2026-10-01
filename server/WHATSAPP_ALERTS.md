# Automatic WhatsApp alerts

## Message templates

Existing alert events render Apps Script message wording through `whatsappLegacyTemplates.js` and `whatsappTemplateRenderer.js`. The source expressions are copied by `server/scripts/extractWhatsAppTemplates.js` from `appscript/code.gs`; the generator never copies provider credentials or executes Apps Script triggers. Ticket assignment/reassignment, timer-start, approval requests/results/transfers, expense decisions and leave/intimation messages use the corresponding original formats. Events without an original equivalent (such as individual FMS updates) retain the same branded style. The daily summary uses the Apps Script greeting and category counts, but only the current employee's tasks planned/due today; old backlog and unrelated recipients remain excluded. Identical messages produced by overlapping enabled categories in the same event are queued once.

`WORKTRACK_PUBLIC_URL=https://kriscel.online` supplies the portal link in every automatic message. The old Google Apps Script URL is not used. Template text alone does not activate additional welcome/chat/audit/TAT-breach triggers that have no corresponding event wiring in the current app. Verify with `node server/scripts/verifyWhatsAppTemplates.js` and `node server/scripts/verifyWhatsAppAlerts.js`.

## Provider configuration

WhatsApp Center → WhatsApp Integration lets a Super Admin save and activate a provider without restarting. GET/PUT `/api/whatsapp/integration` are Super Admin-only. The active singleton lives in `whatsapp_integration`; the token is AES-256-GCM encrypted using `WHATSAPP_CONFIG_ENCRYPTION_KEY` (64 hex characters). Back up this key with deployment secrets; losing it prevents reading saved tokens. No token is returned to the browser. Blank tokens retain the existing credential only when provider/base URL are unchanged. Revision checks reject stale edits.

Until settings are saved, the existing AKNEXUS environment configuration remains active. Tests and automatic jobs load the same current database configuration for every send. Requests already in flight finish using their original configuration. History retains each message's provider name.

Supported adapters: AKNexus and providers compatible with its POST `/send` JSON API (`number`, `type`, `message`, `instance_id`, `access_token`, explicit success response). A different API version/authentication format such as an unrelated `/api/v2` or Meta Cloud API needs an adapter; changing the provider name alone cannot make those protocols compatible. Sender number is descriptive: the linked instance controls the sending account. Save & activate stores configuration; Send test message checks actual sending to the selected contact. Saving does not claim verified connectivity.

The API activates a post-save listener for insertRow/upsertRow. Source writes enqueue whatsapp_alert_jobs. A worker claims jobs atomically every five seconds and uses the current saved contact number. Both enqueue and send check enabled categories and active employees. External contacts without an employee link support manual tests, not employee events.

| Category | Events |
| --- | --- |
| Ticket | Assignment/reassignment, status changes |
| Approval | Ticket, attendance, leave, intimation and expense requests; approval/rejection/rework results; ticket approval transfer |
| Attendance | Punch-in/out; missing punch-in after 10:15 IST; missing punch-out after 18:15 IST; Super Admin attendance summary at 10:30 IST |
| Expense | Submission and status decisions |
| FMS | Assignment, completion/status changes, daily summary of own pending tasks planned today |
| Reminder | Daily summary of own pending tickets/to-dos planned or due today (IST); no old backlog or future tasks |

Approver selection reuses the approval module's actionable permissions. Expense reviewers follow expense role restrictions. Employee events require a saved contact linked to that employee. Editing notes does not generate an alert. Auto-ticket templates are excluded; generated task instances are eligible.

Task summaries run from 10:00 IST. Missing punch-in runs from 10:15 until 18:15 for active employees with no recorded punch-in; approved leave and Sunday weekly off suppress this reminder. Missing punch-out runs from 18:15 for employees whose latest punch remains open. Each event is deduplicated per employee/day, and reevaluated before sending. Approved half-day leave and punches after 10:15 count as half day, matching the attendance module's late-arrival cutoff. Present, absent and half-day counts are mutually exclusive; approved full-day leave without a punch is included in the not-present/absent count. Inactive employees and future joiners are excluded.

At 10:30, every active Super Admin with an enabled attendance contact receives counts plus names of present employees only. Names of absent/half-day employees are omitted. The summary uses punch timestamps up to 10:30 even on a later restart. Role and contact preferences are checked again at send time. The job stores an event discriminator so summary, missing-in and missing-out messages cannot be mixed up. Historical holiday calendars and custom shifts are not inferred. Previous-day jobs are skipped. Personal task reminders remain limited to the recipient's own tasks for today.

Server configuration: AKNEXUS_ACCESS_TOKEN, AKNEXUS_INSTANCE_ID, optional AKNEXUS_API_BASE_URL, AKNEXUS_TIMEOUT_MS, WHATSAPP_AUTOMATIC_ALERTS (default true), WHATSAPP_REMINDER_TIME_IST (default 10:00), WHATSAPP_MISSED_IN_TIME_IST (10:15), WHATSAPP_MISSED_OUT_TIME_IST (18:15), WHATSAPP_ATTENDANCE_SUMMARY_TIME_IST (10:30). Restart after changes. Keep the backend running for automatic sends. Test boundaries and counts with `node server/scripts/verifyWhatsAppAttendanceSchedule.js`.

Pending jobs survive restarts. Failed/ambiguous sends are not automatically retried because delivery may already have occurred. Interrupted processing jobs become unconfirmed after five minutes. Source persistence and alert enqueue are separate writes: enqueue failure is logged without rolling back the business action. Delivery/read callbacks and historical alert backfill are not implemented. Imports outside the API process do not activate alerts.

Verification: run server/scripts/verifyWhatsAppContacts.js, verifyWhatsAppSending.js and verifyWhatsAppAlerts.js with Node (offline, no actual messages). verifyWhatsAppAlertPersistence.js uses MongoDB with temporary records, cleans them up and never starts the worker. Run the client production build after UI changes.
# Client ticket notifications

WhatsApp Center contacts can now link to either an employee or a client. Add/Edit Contact lists them in separate dropdown groups. Admin and Super Admin can select Client Master records; existing client-module access restrictions still apply. A client can have one linked WhatsApp contact. Its saved number and ticket-alert preference take precedence over Client Master; Client Master remains the fallback when no linked contact exists. Client contacts support the ticket category, which includes ticket chat notifications.

New client-portal tickets notify active Admins and Super Admins using their enabled WhatsApp contacts (`ticket` category), and send a confirmation to the client using the current WhatsApp/mobile number in Client Master. An employee assignment alert remains available for an assignee outside that recipient list.

New ticket chat messages notify Admins, Super Admins, the current assignee, and the owning client, excluding the authenticated sender. Client responses containing attachments also count as chat messages; the message points to the portal for attachments. Existing messages, read receipts and ordinary ticket edits do not replay chat alerts. This is portal-to-WhatsApp notification delivery; WhatsApp inbound replies are not imported into portal chat.

Client jobs store `clientId` and resolve the current Client Master number at send time. Missing/invalid numbers, inactive clients, changed ticket ownership, and disabled matching WhatsApp contact preferences skip the job with a recorded reason. Employee contacts retain existing enabled/category checks. Sent/failed provider records include the client ID. No historical tickets or chat messages are backfilled.
