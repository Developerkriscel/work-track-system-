## Tickets Feature

This feature owns the employee ticket system rendered at `/ticket-system`.

Legacy Apps Script sources:

- `#ticket-system-view`
- `#ticket-table`
- ticket filters, bulk create rows, details, chat, reassign, and schedule flows in `appscript/index.html`

Current React ownership:

- `TicketSystemPage.jsx`
- `useTicketSystemData.js`
- `api.js`
- `components/TicketHeader.jsx`
- `components/TicketFilterPanel.jsx`
- `components/TicketCreateForm.jsx`
- `components/TicketTable.jsx`
- `services/ticketPresentation.js`

Folder intent:

- keep ticket filter state, create flow, and table rendering inside React
- continue extracting remaining ticket action dialogs into reusable React modules

Remaining parity gaps:

- ticket details dialog
- chat dialog
- assignment/reassign dialog
- schedule dialog
- exact team/my ticket parity
