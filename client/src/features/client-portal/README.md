## Client Portal Feature

This feature owns the client-facing React workspace that replaces the legacy `appscript/client-index.html` screens.

Current structure:

- `api.js`: live client portal backend adapters
- `components/`: reusable client portal UI building blocks
- `contracts/`: feature module planning metadata
- `services/`: presentation helpers for status, currency, and dates
- `useClientPortalResource.js`: shared client-session-aware resource loader
- `useClientDashboardData.js`
- `useClientTicketsData.js`
- `useClientTicketWorkspace.js`
- `useClientInvoicesData.js`
- `useClientReportsData.js`
- `ClientDashboardPage.jsx`
- `ClientTicketsPage.jsx`
- `ClientInvoicesPage.jsx`
- `ClientReportsPage.jsx`
- `manifest.js`

Current goal:

- keep client auth/session and shell inside React ownership
- keep old client workflows moving to `/client/*`
- continue replacing legacy tab/filter/modal/table details screen by screen
- move the legacy client ticket mode tabs, nested ticket tabs, range filters, and bulk ticket composer into dedicated reusable React modules
- move client ticket details, response, and chat flows from SweetAlert ownership into React-owned modal components
- tighten client ticket row rendering so status labels, auto-approved handling, latest-update previews, unread highlighting, and priority badges follow the legacy Apps Script behavior more closely
- align client ticket actions and discussion UI more closely with legacy presentation by using icon-led action states and sender-aware chat bubbles
- move DataTables-style ticket interaction into React ownership with page-size selection, search, sortable headers, and footer pagination
- extend the shared React table interaction layer into client invoices and client reports, including legacy-style invoice tabs and searchable/sortable paginated tables
- move the client dashboard closer to the legacy portal by rebuilding horizontal KPI cards, chart-style panels, and activity list sections inside reusable React modules
