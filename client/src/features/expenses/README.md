## Expenses Feature

This feature owns the expenses workspace rendered at `/expenses`.

Legacy Apps Script sources:

- `#expense-view`
- `#expense-history-table`
- expense submit form and receipt behavior in `appscript/index.html`

Current React ownership:

- `ExpensesPage.jsx`
- `useExpensesData.js`
- `api.js`
- `components/ExpensesHeader.jsx`
- `components/ExpensesSummaryCards.jsx`
- `components/ExpenseFormPanel.jsx`
- `components/ExpensesHistoryTable.jsx`
- `services/expensesPresentation.js`

Folder intent:

- keep expense submission and history rendering in React
- keep live backend updates in this feature boundary

Remaining parity gaps:

- receipt preview parity
- exact history table controls parity
