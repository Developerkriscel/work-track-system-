# WhatsApp Center

Route: `/whatsapp`, available to Admin, HR and Super Admin. Employee visibility follows the existing admin directory rules. Contacts, test sends and automatic employee alerts are supported. See [automatic alert rules and operations](../../../../server/WHATSAPP_ALERTS.md).

- Alert history: all accessible employees, saved WhatsApp number, alert count, latest status, per-employee message details, and an all-messages view with search/status/date/type filters. Phone-based matches for legacy records are best-effort; the destination stored in each log is always displayed in message details.
- Contacts: link an existing employee or add an external contact, save an international number, edit, enable/pause the alert preference, choose alert categories and add notes. Data is stored in the `whatsapp_contacts` MongoDB collection, independently of the employee's main mobile number.
- Duplicate phone numbers and duplicate employee links are prevented by unique indexes. Ten-digit Indian numbers normalize to +91. Employee names and departments are resolved on the server.
- `/api/whatsapp/workspace` reads the directory, saved contacts and up to 1,000 latest imported legacy log entries, then scopes logs to accessible identities/phones. Counts describe this loaded history, not lifetime totals. No synthetic message records are seeded into the application.
- `/api/whatsapp/contacts` creates/updates a contact. Both endpoints enforce employee account kind and administrative roles. Saving contacts does not configure AKNexus itself or create a provider contact.

The production server must run the current `server.js` for the routes and automatic alert worker. Use the existing MongoDB configuration. Provider delivery/read callbacks are not implemented; Sent means provider acceptance. Failed sends are not automatically retried.

Validation:

```sh
npm --prefix client run build
npm run verify:whatsapp
npm run verify:whatsapp-live
node server/scripts/verifyWhatsAppUi.js
```

The offline contact checks do not connect to MongoDB. `verify:whatsapp-live` uses the configured MongoDB and current localhost API, creates temporary contacts, verifies create/edit/read-back/duplicate handling, and deletes those temporary contacts. The UI check serves the built app with an isolated in-memory API and fake users; it never sends WhatsApp messages. Actual AKNexus delivery is not verified by these contact-management checks.
