## Clients Portal Feature

This feature owns the admin-side clients portal rendered at `/clients-portal`.

Legacy Apps Script sources:

- `#clients-view`
- `#table-clients-portal`
- client details popup
- client edit/delete flows in `appscript/index.html`

Current React ownership:

- `ClientsPortalPage.jsx`
- `useClientsPortalData.js`
- `api.js`
- `components/ClientsPortalHeader.jsx`
- `components/ClientsPortalSummaryCards.jsx`
- `components/ClientsPortalFilterPanel.jsx`
- `components/ClientsPortalTable.jsx`
- `components/ClientDetailsCard.jsx`
- `components/ClientEditor.jsx`
- `services/clientsPresentation.js`

Folder intent:

- keep admin-side client maintenance separate from the client-facing portal
- keep details/editor/filter/table state inside React

Remaining parity gaps:

- exact details popup parity
- exact edit/delete action flow
