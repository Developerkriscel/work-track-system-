# WorkTrack Frontend Parity Backlog

Last verified against the current workspace on **July 18, 2026**.

This backlog converts the architecture maps into a concrete implementation order for removing the remaining frontend dependence on `appscript`.

## Priority 1: Shared shell and global blockers

These block parity across multiple screens and should be handled early.

### Notifications

- Legacy surfaces:
  - `#notification-popup-container`
  - `#notification-panel`
  - `#notification-bell-btn`
- Current React state:
  - bell icon, polling, employee/client APIs, unread count, and upgraded drawer are React-owned
- Target React ownership:
  - `components/common/UserProfileMenu.jsx`
  - new shared notification drawer/popup component
- Why high priority:
  - affects employee and client shells
  - one of the most visible remaining global gaps

### Change password modal

- Legacy surface:
  - `#change-password-modal`
- Current React state:
  - employee password update is wired to the Mongo-backed auth API
- Target React ownership:
  - `components/modals/AppModal.jsx`
  - feature-level auth password dialog
- Why high priority:
  - global auth parity gap
  - blocks full shell/auth independence from Apps Script

### Shared React table primitives

- Legacy dependency class:
  - DataTables-grade search, sorting, pagination, header filters
- Current React state:
  - `components/tables/DataTableShell.jsx`
  - `components/tables/useDataTableState.js`
  - still not full parity everywhere
- Why high priority:
  - affects nearly every module
  - many remaining gaps are really shared-table behavior gaps

## Priority 2: Employee/admin workflow blockers

### Ticket dialogs and action workflows

- Legacy surfaces:
  - close/update Swal
  - assign/reassign Swal
  - schedule update Swal
  - client response Swal
  - ticket chat Swal
- Current React state:
  - table and create form exist
  - dialog layer is still missing
- Target React ownership:
  - `features/tickets/components/*Dialog.jsx`
  - shared modal shell under `components/modals`
- Why high priority:
  - this is one of the largest remaining functional parity gaps in the employee app

### Approval dialogs

- Legacy surfaces:
  - approval remarks
  - transfer approval
  - attendance correction
- Current React state:
  - tables and filters exist
  - dialog actions are still incomplete
- Target React ownership:
  - `features/approvals/components/*Dialog.jsx`
  - shared modal shell
- Why high priority:
  - approval flow is functionally important and still partly legacy-shaped

### FMS modal flows

- Legacy surfaces:
  - `#fms-form-modal`
  - completion confirmation
- Current React state:
  - page, tabs, filters, and table exist
  - modal/open behavior still incomplete
- Target React ownership:
  - feature-local FMS modal components
- Why high priority:
  - keeps external-form and completion workflow from being fully React-owned

## Priority 3: Client portal parity blockers

### Client dashboard drilldowns and notifications

- Legacy surfaces:
  - clickable KPI items
  - `#kpi-filtered-table`
  - notification panel behavior
- Current React state:
  - KPI cards and chart/list panels exist
  - drilldown table and final notification UX still missing
- Target React ownership:
  - `features/client-portal/ClientDashboardPage.jsx`
  - dedicated KPI detail panel/table
  - client notification drawer

### Client reports filters and charts

- Legacy surfaces:
  - `#report-filters`
  - `#report-distribution-chart`
  - `#report-completion-chart`
- Current React state:
  - report table exists
  - dedicated filter/charts/export layer still pending
- Target React ownership:
  - `features/client-portal/components/*`

### Client social shell integration

- Legacy surfaces:
  - full client portal navigation context around social tasks
- Current React state:
  - feature exists and is routed
  - final shell-level integration parity still needs audit/polish
- Target React ownership:
  - `features/client-social/*`
  - `components/layout/ClientShell.jsx`

## Priority 4: Management dashboard parity blockers

### Batch assignment modal save flow

- Legacy surface:
  - `#batch-modal`
- Current React state:
  - controlled planner, validation, add/remove rows, and live ticket/to-do save flow are complete
- Target React ownership:
  - `features/management-dashboard/components/BatchAssignmentPlanner.jsx`
  - feature data layer

### Overview and explorer drilldowns

- Legacy surfaces:
  - overview subtables
  - explorer child rows
  - client/user drilldown behavior
- Current React state:
  - sections exist
  - exact child-row and drilldown parity still pending
- Target React ownership:
  - `OverviewDashboardSection.jsx`
  - `UserExplorerSection.jsx`
  - `ClientExplorerSection.jsx`

## Priority 5: Visual and micro-layout parity pass

After the major workflow gaps above are done:

- run a table-by-table control placement audit
- run a modal-by-modal behavior audit
- run a tab/filter spacing audit
- run a shell/icon/header alignment audit
- run a final route-by-route comparison against:
  - `appscript/index.html`
  - `appscript/client-index.html`
  - `appscript/dashboard-index.html`

## Recommended execution sequence

1. notifications + change-password modal
2. employee ticket dialogs
3. approval dialogs
4. FMS modal flow
5. client dashboard drilldowns
6. client reports filters/charts
7. management batch modal save flow
8. management explorer drilldowns
9. final table/modal/layout parity pass

## What this backlog means

At this point, the biggest remaining frontend gaps are no longer missing folders.

They are:

- shared interaction primitives not fully parity-complete
- modal workflows still not fully React-owned
- a handful of high-value drilldown/report surfaces still missing
- final exact same-to-same visual audits
