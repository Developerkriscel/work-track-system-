## FMS Feature

This feature owns the FMS tracker rendered at `/fms-tracker`.

Legacy Apps Script sources:

- `#fms-view`
- `#table-fms-main`
- FMS form modal and done flow in `appscript/index.html`

Current React ownership:

- `FmsPage.jsx`
- `useFmsData.js`
- `api.js`
- `components/FmsHeader.jsx`
- `components/FmsTabsPanel.jsx`
- `components/FmsFilterPanel.jsx`
- `components/FmsTaskTable.jsx`
- `services/fmsPresentation.js`

Folder intent:

- keep my/team tab logic, filters, and task actions in React
- keep table rendering and action handling in the feature folder

Remaining parity gaps:

- exact form-open modal behavior
- exact done confirmation flow
