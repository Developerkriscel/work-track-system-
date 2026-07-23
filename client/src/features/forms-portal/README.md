## Forms Portal Feature

This feature owns the forms portal rendered at `/forms-portal`.

Legacy Apps Script sources:

- `#forms-view`
- `#table-forms-portal`
- forms editor/access flows in `appscript/index.html`

Current React ownership:

- `FormsPortalPage.jsx`
- `useFormsPortalData.js`
- `api.js`
- `components/FormsPortalHeader.jsx`
- `components/FormsPortalFilterPanel.jsx`
- `components/FormsPortalTable.jsx`
- `components/FormsPortalEditor.jsx`
- `services/formsPresentation.js`

Folder intent:

- keep form listing, filters, editing, and selected-user access assignment inside React
- keep Apps Script forms only as destinations, not as frontend owners

Remaining parity gaps:

- exact access-management dialog parity
- final open-form iframe/new-tab behavior audit
