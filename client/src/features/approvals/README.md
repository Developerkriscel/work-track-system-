## Approvals Feature

This feature owns the approvals workspace rendered at `/approvals`.

Legacy Apps Script sources:

- `#approvals-view`
- `#table-approve-tickets`
- `#table-approve-leaves`
- `#table-approve-intimations`
- `#table-approve-attendance`
- approval remarks, rework, transfer, and attendance-correction flows in `appscript/index.html`

Current React ownership:

- `ApprovalsPage.jsx`
- `useApprovalsData.js`
- `api.js`
- `components/ApprovalsHeader.jsx`
- `components/ApprovalsTabsAndFilters.jsx`
- `components/TicketApprovalTable.jsx`
- `components/GenericApprovalTables.jsx`
- `services/approvalsPresentation.js`

Folder intent:

- keep tickets, leaves, intimations, and attendance approvals under one feature boundary
- keep filter/tab state inside React
- replace remaining SweetAlert-owned actions with React-owned dialogs over time

Remaining parity gaps:

- transfer approval modal parity
- attendance correction dialog parity
- exact multi-table filter/action behavior
