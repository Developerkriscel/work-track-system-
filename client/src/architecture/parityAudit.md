## WorkTrack UI Parity Audit

Last verified against current workspace on **July 18, 2026**.

### What is already established inside `client/src`

- React app shell, routing, auth provider, and protected routes.
- Separate client auth provider, client login route, client shell, and `/client/*` route family.
- Route-level pages for:
  - Dashboard
  - Attendance
  - Ticket System
  - FMS Tracker
  - Approvals
  - Forms Portal
  - Clients Portal
  - Expenses
  - Reports
  - Admin
  - Client Dashboard
  - Client Tickets
  - Client Invoices
  - Client Reports
- Shared theme, layout, and basic common components.
- The architecture layer now also includes a deeper interaction inventory that maps legacy UI state and concrete Apps Script functions to React feature ownership targets.

### What is now modularized as reusable React feature slices

- Attendance page has been split into dedicated header, action row, entry panel, range toolbar, summary stats, and table modules.
- Dashboard page has been split into dedicated header, KPI grid, mini stats, charts section, tasks section, and presentation helpers.
- FMS page has been split into dedicated header, tabs panel, filter panel, task table, and presentation helpers.
- Expenses page has been split into dedicated header, summary cards, expense form panel, history table, and presentation helpers.
- Admin page has been split into dedicated header, summary cards, tab-and-filter controls, editor, user table, EMP master table, and presentation helpers.
- Auth flow has been split into dedicated login shell, employee login form, auth error banner, session status screen, and session persistence helpers.
- To-Do workspace has been rebuilt as a routed React feature with summary cards, single-task form, bulk-add form, filters, table actions, and backend-backed mutations.
- Client Social has been rebuilt as a routed React feature with client-scoped loading, platform/status filters, summary cards, details/history panel, and approve/feedback actions backed by live APIs.
- Client-facing portal structure now has a dedicated React route family with separate client auth/session ownership and first-pass live pages for dashboard, tickets, invoices, and reports.
- Client-facing portal pages now also use a dedicated `client-portal` feature slice with reusable components, presentation services, and shared data hooks instead of only page-local fetch logic.
- Client Tickets now has a React-owned workspace slice for legacy-style main mode tabs, nested ticket status tabs, range filters, grouped table views, and bulk ticket submission scaffolding.
- Client Tickets also now includes React-owned details, response, and chat dialog components wired to live ticket detail/message endpoints instead of leaving those flows fully in legacy Swal ownership.
- Client Tickets now also applies legacy-style row interpretation for auto-approved status, compact latest-update previews, unread-row highlighting, and priority badge rendering.
- Client Tickets action cells and chat presentation now also move closer to the legacy portal with icon-led action states, closed/tracking indicators, and sender-aligned discussion bubbles.
- Client Tickets now also owns page-size selection, search, sortable headers, and footer pagination in React instead of relying on legacy DataTables behavior for that screen.
- Client Invoices and Client Reports now also use the shared React table interaction layer, and Client Invoices now restores legacy-style invoice status tabs inside React.
- Client Dashboard now also owns a more legacy-like React structure for horizontal KPI cards, chart-style panels, and pending/recent activity list blocks instead of only generic summary/table sections.
- Management Dashboard has been rebuilt as a routed React feature with overview analytics, user explorer, client explorer, and a React batch planner that submits ticket and to-do assignments through the live management API.
- Ticket System page has been split into dedicated header, filter panel, create form, table, and presentation helpers.
- Forms Portal page has been split into dedicated header, filter panel, editor, table, and presentation helpers.
- Reports page has been split into dedicated header, toolbar, summary cards, ticket section, FMS section, and presentation helpers.
- Clients Portal page has been split into dedicated header, summary cards, filter panel, detail card, editor, table, and presentation helpers.
- Approvals page has now been split into dedicated header, tab-and-filter controls, ticket approval table, generic approval tables, and presentation helpers.

### What the Apps Script inventory proves exists in legacy UI

### Employee/Admin portal

- Login
- Dashboard
- Attendance
- Ticket System
- FMS Tracker
- Approvals
- My Approval Status / request history
- Forms Portal
- Clients Portal admin
- To-Do
- Expenses
- Reports
- EMP Master
- Users

### Client portal

- Client login
- Dashboard
- Tickets
- Social
- Invoices
- Reports

### Management dashboard

- Overview dashboard
- User explorer
- Client explorer
- Batch assignment modal

### Exact-parity gaps still remaining

- Legacy `appscript` rendering is still the full parity source for many detailed interactions.
- DataTables behavior is not yet fully abstracted into reusable React table modules.
- SweetAlert-driven editor flows are inventoried, and the client ticket detail/respond/chat layer has started moving into React dialogs, but many other legacy dialogs still remain.
- Client Social, To-Do, and Management Dashboard now have dedicated feature folders, but they are still scaffolds and not complete React implementations yet.
- Shared table wrappers, form wrappers, chart wrappers, and some page-specific modal primitives still need final parity polish.
- Exact one-to-one markup parity for every legacy row renderer, badge, popup, and inline action still requires module-by-module rebuild work.

### What the deeper interaction audit now proves

The workspace now has evidence-backed mapping for each major portal screen covering:

- route and page ownership
- feature folder ownership
- shared module dependencies
- UI state clusters
- concrete legacy function clusters
- visible React surfaces that still must be absorbed from Apps Script ownership
- current React page/hook/api/service/component file ownership for each screen
- actual route-family wiring, guarded shells, and login entry points
- high-value legacy selectors tied to current React file targets and parity status
- feature-folder consistency against the target production-ready structure
- dedicated legacy tables, filters, modals, and script entry points mapped to React owners and parity status

This is stronger than the older screen-only inventory because it tells us where the remaining migration work actually lives in code, not just where it appears on screen.

### Safe next sequence

1. Build shared reusable React primitives from the roadmap folders.
2. Move each current page from feature-flat implementation to feature subcomponents.
3. Replace remaining legacy modal and table logic with React-native equivalents.

### Remaining parity gaps after the current feature sweep

- The separate management dashboard now exists in React, and batch ticket/to-do assignment is ported end-to-end through a MERN API; exact legacy modal styling and explorer drilldown details still need final parity review.
- Client login and client-facing portal routing now exist as dedicated React routes, and client dashboard/tickets/invoices/reports now own much more of their layout, table, and tab structure in React, but final action parity and remaining client screens still need screen-by-screen work.
- Exact DataTables behavior, SweetAlert interaction details, and some page-specific micro-layout parity still need final visual and behavioral audit against the legacy screens.

### Implementation order now captured separately

The workspace now also has a dedicated prioritized implementation backlog in `frontendParityBacklog.md` that groups the remaining frontend dependency gaps into:

- shared shell blockers
- employee/admin workflow blockers
- client portal blockers
- management dashboard blockers
- final visual parity pass
