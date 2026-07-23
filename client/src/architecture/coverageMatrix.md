## WorkTrack Legacy Coverage Matrix

Last verified against current workspace on **July 18, 2026**.

This file tracks whether each legacy UI surface has a React feature boundary under `client/src`.

| React Feature | Legacy Screens Covered | Notes |
| --- | --- | --- |
| `auth` | employee login, client login | Auth now has manifest, components, contracts, services structure, and reusable login/session modules for the employee flow. |
| `dashboard` | employee dashboard | KPI cards, charts, task tables, and range controls are mapped and now split into reusable header, stats, charts, tasks, and presentation modules. |
| `attendance` | attendance, request history | Punch, leave, intimation, timer, camera, and attendance tables are mapped. |
| `tickets` | employee ticket system | Filters, create flow, status actions, schedule flow, and messages are mapped. |
| `fms` | FMS tracker | FMS tables, filters, done flow, and external form modal are mapped and now split into reusable header, tabs, filters, table, and presentation modules. |
| `approvals` | approvals queue | Tickets, leaves, intimations, attendance approvals are mapped and now split into reusable header, filter, table, and presentation modules. |
| `forms-portal` | forms portal | Filters, listing, access, and editor modal are mapped. |
| `clients-portal` | admin clients portal | Admin-side client maintenance workspace now stands separate from the dedicated client route family. |
| `client-portal` | client dashboard, client tickets, client invoices, client reports | Dedicated client route family now exists under `/client/*` with separate auth/session ownership. |
| `client-social` | client social view | Client social is now implemented as a routed React feature with client-scoped filters, summary cards, details/history view, and action workflows backed by live APIs. |
| `expenses` | expenses | Submission and history table are mapped and now split into reusable header, summary, form, history, and presentation modules. |
| `reports` | employee reports | Ticket/FMS report surfaces and export controls are mapped. |
| `admin` | EMP Master, Users | Admin maintenance screens are mapped and now split into reusable header, summary, filters, editor, users table, EMP master table, and presentation modules. |
| `todo` | employee to-do | Employee to-do is now implemented as a routed React feature with summary cards, single/bulk create flows, filters, table actions, and backend wiring. |
| `management-dashboard` | overview dashboard, user explorer, client explorer, batch modal | Management dashboard is now implemented as a routed React feature with overview analytics, user explorer, client explorer, and a batch-planner shell backed by live admin-report data. |

### Current evidence

- Every known legacy application family now has a dedicated React feature boundary or an explicitly assigned feature owner.
- Every known legacy screen is represented in `featureContracts.js`.
- Every known legacy screen is now also represented in `reactModuleOwnershipMatrix.js` with a concrete current React page/data/component ownership path.
- High-value legacy DOM surfaces across shell, approvals, reports, expenses, admin, client social, and management screens are now also tracked in `legacySelectorRegistry.js`.
- Every feature folder is now also audited in `featureStructureAudit.js` against the standard production-ready folder pattern.
- Legacy tables, filters, modals, and script entry points are now also tracked directly in `uiSurfaceOwnershipMatrix.js`.
- Every major feature now has a production-style scaffold:
  - `manifest.js`
  - `components/index.js`
  - `contracts/index.js`
  - `services/index.js`
- Live modularization is now completed for:
  - `dashboard`
  - `attendance`
  - `tickets`
  - `fms`
  - `forms-portal`
  - `expenses`
  - `reports`
  - `admin`
  - `clients-portal`
  - `client-portal`
  - `approvals`
  - `auth`
  - `todo`
  - `client-social`
  - `management-dashboard`

### Still not complete

- Exact UI parity is still incomplete because several features are still page-level implementations or scaffolds rather than full one-to-one React rebuilds.
- Remaining major gaps are now end-to-end parity gaps rather than empty feature folders:
  - management batch assignment save flow
  - full exact-markup parity across the new client portal route family
  - final DataTables/SweetAlert/micro-layout parity audit
- Legacy table rendering, modal flows, charts, and detailed row actions still need to be rebuilt as actual React modules across the remaining features.
