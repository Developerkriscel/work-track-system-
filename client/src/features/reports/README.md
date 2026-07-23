## Reports Feature

This feature owns the employee reports workspace rendered at `/reports`.

Legacy Apps Script sources:

- `#reports-view`
- `#report-table-tickets`
- `#report-table-fms`
- report range controls and export actions in `appscript/index.html`

Current React ownership:

- `ReportsPage.jsx`
- `useReportsData.js`
- `api.js`
- `components/ReportsHeader.jsx`
- `components/ReportsToolbar.jsx`
- `components/ReportsSummaryCards.jsx`
- `components/TicketReportSection.jsx`
- `components/FmsReportSection.jsx`
- `services/reportsPresentation.js`

Folder intent:

- keep ticket and FMS reports under one feature boundary
- keep range, filter, and export state inside React

Remaining parity gaps:

- exact export/print parity
- exact report filter/table control layout
