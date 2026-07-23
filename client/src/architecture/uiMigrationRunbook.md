# WorkTrack UI Migration Runbook

Last verified against the current workspace on **July 18, 2026**.

This runbook is the working source of truth for shifting the legacy Apps Script UI into a production-ready MERN frontend under `client/src` without depending on `appscript/*.html`.

## Objective

- Rebuild every legacy UI surface as React-native modules.
- Keep the exact same UI language, workflows, filters, tables, badges, dialogs, and page hierarchy.
- Preserve current working behavior while replacing legacy DOM-script ownership with React ownership.
- Remove frontend dependence on Apps Script HTML, inline scripts, jQuery DataTables wiring, and SweetAlert-owned flows.

## Verified current frontend structure

The current React codebase already has these top-level folders under `client/src`:

- `app`
- `architecture`
- `components/charts`
- `components/common`
- `components/forms`
- `components/layout`
- `components/modals`
- `components/tables`
- `features/*`
- `hooks`
- `lib`
- `pages`
- `services`
- `styles`
- `utils`

This means the scaffold exists. The remaining job is no longer "create folders". The remaining job is "move exact legacy rendering and behavior ownership into those folders completely."

## Production-ready target ownership

### `app`

- App bootstrap
- global providers
- router
- auth/session boundaries
- route guards

### `components/layout`

- employee shell
- client shell
- management shell
- sidebar variants
- topbar variants
- mobile navigation

### `components/common`

- status pills
- icon buttons
- empty states
- loader states
- summary cards
- notification items
- access badges

### `components/forms`

- field wrapper
- select wrapper
- date-range controls
- upload controls
- searchable multi-select
- inline validation blocks

### `components/tables`

- React table shell
- column config helpers
- filter/search header row
- pagination/footer row
- row action group
- expandable child-row renderer

### `components/modals`

- confirmation dialog
- editor dialog
- chat dialog
- form preview/open dialog
- image/file preview dialog
- password-change dialog

### `components/charts`

- chart card shell
- donut wrapper
- line wrapper
- bar wrapper
- legend blocks

### `features/*`

Each business module should fully own:

- page container
- UI state
- API adapters
- presentation formatting
- feature-specific dialogs
- feature-specific table columns
- feature-specific filters

## Locked folder ownership map

The folder scaffold is no longer generic. It is now explicitly locked to these ownership rules:

| Folder | Production responsibility |
| --- | --- |
| `app` | bootstrap, router, providers, auth boundaries, route guards |
| `architecture` | UI inventory, parity map, coverage contracts, migration evidence |
| `components/layout` | employee shell, client shell, management shell, sidebar, topbar, mobile nav |
| `components/common` | pills, badges, summary cards, notification cards, icon actions, empty/loading states |
| `components/forms` | field wrappers, date inputs, multi-selects, upload controls, validation blocks |
| `components/tables` | table shell, search/sort/pagination state, row action groups, filter headers |
| `components/modals` | confirmation, editor, chat, preview, access, password-change dialogs |
| `components/charts` | donut, line, bar, chart-card shells, legends |
| `features/*` | page composition, feature state, API adapters, presentation logic, feature-specific dialogs/tables/filters |
| `styles` | tokens, base styles, page styles, shared UI styling contracts |

This is the production target we should keep reinforcing until `appscript` is no longer needed for frontend ownership.

## Legacy-to-React screen mapping

### Employee/Admin portal from `appscript/index.html`

| Legacy screen | React feature owner | Current status | Exact-parity work still needed |
| --- | --- | --- | --- |
| Login | `features/auth` | scaffolded and routed | client-specific login parity, password-change dialog parity |
| Dashboard | `features/dashboard` | routed | exact table/chart/detail interactions audit |
| Attendance | `features/attendance` | routed | camera/punch edge cases, exact row renderer parity |
| Ticket System | `features/tickets` | routed | full modal/action parity, message/chat parity audit |
| FMS Tracker | `features/fms` | routed | exact form-open, done-flow, team-tab parity audit |
| Approvals | `features/approvals` | routed | transfer/remarks/attendance correction dialog parity |
| My Requests | `features/attendance` | partially absorbed | legacy view intentionally removable only if business confirms replacement |
| Forms Portal | `features/forms-portal` | routed | exact access-management persistence and dialog parity |
| Clients Portal admin | `features/clients-portal` | routed | keep admin-only behavior isolated from client-facing portal |
| To-Do | `features/todo` | routed | final parity audit against legacy table/editor behaviors |
| Expenses | `features/expenses` | routed | receipt preview and approval feedback parity audit |
| Reports | `features/reports` | routed | export and filter interaction parity audit |
| EMP Master | `features/admin` | routed | upload/editor parity audit |
| Users | `features/admin` | routed | exact form and role/access flow parity audit |

### Client portal from `appscript/client-index.html`

| Legacy screen | React feature owner | Current status | Exact-parity work still needed |
| --- | --- | --- | --- |
| Client Login | `features/auth` | routed with dedicated client auth/session provider | exact legacy visual parity and validation/messaging details still needed |
| Client Dashboard | `features/client-portal` | routed with live API base and React-owned KPI/chart/activity sections | exact clickable KPI drilldowns and final visual parity still needed |
| Client Tickets | `features/client-portal` | routed with live API base, React-owned workspace structure, initial React dialogs, and React-owned table interactions | final action parity, message polish, and visual audit still needed |
| Client Social | `features/client-social` | routed | needs integration into full client portal shell/session |
| Client Invoices | `features/client-portal` | routed with live API base and React-owned invoice tabs/table shell | exact financial action parity and final visual audit still needed |
| Client Reports | `features/client-portal` | routed with live API base and React-owned table shell | exact report filters, charts, export, and full visual parity still needed |

### Management dashboard from `appscript/dashboard-index.html`

| Legacy screen | React feature owner | Current status | Exact-parity work still needed |
| --- | --- | --- | --- |
| Overview Dashboard | `features/management-dashboard` | routed | final micro-layout and table drilldown parity audit |
| User Explorer | `features/management-dashboard` | routed | exact card/table collapse parity audit |
| Client Explorer | `features/management-dashboard` | routed | exact table drilldown and invoice band parity audit |
| Batch Assignment Modal | `features/management-dashboard` | planner shell only | full save flow still needs migration |

## Verified dependency gaps that still block "no App Script frontend dependency"

These are the areas that still need explicit replacement work before we can honestly call the frontend fully independent from `appscript`:

1. Client-facing login/session flow now exists, but the visual and behavioral parity of the full client app is still incomplete.
2. Client dashboard, tickets, invoices, and reports are still not fully rebuilt as dedicated React portal surfaces.
3. Several legacy modal workflows are inventoried but not yet rebuilt as reusable React dialogs.
4. Shared table primitives exist only as folder targets; exact DataTables-grade behavior still needs React-native ownership.
5. Some page-level features still rely on page-specific implementations instead of shared primitives.
6. Final screen-by-screen parity verification against legacy markup is still pending.

## What the enriched ownership map now tracks

The architecture inventory now stores, for every legacy screen:

- target route
- target React page file
- feature module folders
- required shared modules
- parity-focus checklist

This gives us a direct bridge from legacy Apps Script screens to production-ready React ownership under `client/src` without needing to keep UI behavior anchored in `appscript/*.html`.

## What the deeper interaction map now tracks

The new interaction inventory goes one step further and records, for each screen:

- legacy UI state clusters that still exist in Apps Script
- concrete legacy functions currently owning those interactions
- the React feature/shared folders that should absorb them
- the visible React surfaces that are still required for full parity

That gives us a practical migration checklist for replacing legacy function ownership screen by screen instead of only tracking page names.

## What the concrete module ownership matrix now tracks

For each legacy screen, we now also maintain:

- current React route page file
- state hook/provider owner
- API and presentation service owner
- component files currently representing the screen
- surface-level ownership across filters, tables, forms, charts, media, and modals
- screen-specific parity gaps that still block full independence from Apps Script frontend files

This is the bridge between the inventory work and the actual implementation work inside `client/src/features/*`.

## What the route migration matrix now tracks

The route matrix adds one more practical layer:

- employee/admin guarded shell and route family
- client guarded shell and route family
- public login entry points
- default protected landing routes
- route-to-page wiring already implemented in React
- route-level observations that may still need adjustment for exact Apps Script parity

This keeps route migration decisions explicit instead of leaving them implicit inside router files.

## What the selector registry now tracks

The selector registry gives us the most visual layer of the migration evidence:

- key legacy IDs/classes from `appscript/*.html`
- which shell, page, table, modal, or panel they represent
- which React file currently owns or should own that visual surface
- whether the selector is already covered, partially covered, or still pending
- selector-level parity notes for exact UI matching

This helps us keep exact same-to-same UI migration grounded in the real legacy DOM surfaces instead of only feature names.

## What the feature structure audit now tracks

The feature structure audit adds the folder-governance layer:

- the expected production pattern for each feature folder
- the current route family and page entry for each feature
- whether each feature has its hook/provider, API, contracts, services, components index, manifest, and local docs
- which remaining gaps are structure-related versus parity-related

This keeps the `client/src/features/*` tree disciplined while the UI migration continues.

## What the UI surface ownership matrix now tracks

This matrix pulls the migration down to the exact surface categories the legacy app depended on:

- tables
- filters
- modals/dialogs
- backend script entry points

For each one, it records:

- the legacy screen and legacy IDs/functions
- the current React owners
- whether the surface is fully migrated, partially migrated, or still pending
- the remaining parity notes attached to that surface

This gives us a direct implementation checklist for the last mile of the migration.

## What the frontend parity backlog now tracks

The backlog turns the architecture evidence into an implementation order:

- shared shell blockers first
- employee/admin workflow blockers next
- client portal parity blockers after that
- management dashboard blockers after that
- final exact same-to-same visual pass at the end

This keeps the next implementation steps explicit and reduces guesswork when moving from mapping into real React ownership work.

## Execution order

Follow this order to avoid breaking currently working employee/admin screens while finishing the migration:

### Phase 1: Freeze the UI contract

- confirm every legacy screen in `appscriptUiInventory.js`
- confirm every route and feature owner
- confirm every missing client and management parity surface

### Phase 2: Finish shared UI primitives

- `components/tables`
- `components/modals`
- `components/forms`
- `components/charts`
- `components/layout`

### Phase 3: Convert employee/admin feature internals

- dashboard
- attendance
- tickets
- fms
- approvals
- expenses
- reports
- forms portal
- admin
- todo

### Phase 4: Build complete client portal route family

- client auth provider/session
- client shell
- client dashboard
- client tickets
- client social inside client shell
- client invoices
- client reports

### Phase 5: Finish management dashboard parity

- overview drilldowns
- explorer collapse behavior
- batch assignment save flow

### Phase 6: Remove legacy frontend ownership

- no React screen should require `appscript/*.html`
- no page behavior should depend on inline legacy DOM scripts
- no modal should require SweetAlert for core feature ownership
- no table should require legacy jQuery DataTable setup for business behavior

### Phase 7: Parity verification

- compare every screen against legacy
- verify spacing, icons, typography, filters, row actions, tabs, modals, mobile behavior
- verify no missing features

## Ready-to-use step-by-step goal prompts

Use these one by one as working goals.

### Prompt 1

`Goal: audit the current App Script UI and React frontend against client/src/architecture/appscriptUiInventory.js and update the parity map so every legacy screen, table, modal, filter, tab, and script has a confirmed React owner and current migration status.`

### Prompt 2

`Goal: complete the production-ready shared UI primitives under client/src/components for tables, modals, forms, charts, and layout so feature pages no longer own one-off legacy-style rendering logic.`

### Prompt 3

`Goal: refactor employee dashboard, attendance, tickets, FMS, approvals, expenses, reports, forms portal, admin, and todo so each screen uses reusable React modules and no UI behavior depends on appscript HTML or inline DOM scripts.`

### Prompt 4

`Goal: build a dedicated client-side React route family with client login, client session handling, and a client app shell matching appscript/client-index.html exactly, without disturbing the existing employee/admin routes.`

### Prompt 5

`Goal: rebuild the client dashboard, client tickets, client invoices, and client reports as full React-native screens under client/src/features/client-portal with exact UI parity and live backend integration.`

### Prompt 6

`Goal: integrate the existing client-social feature into the dedicated client portal shell so client users see the same navigation, filters, tables, actions, and detail flows as the legacy Apps Script portal.`

### Prompt 7

`Goal: complete management dashboard parity by migrating the remaining overview drilldowns, user/client explorer behaviors, and batch assignment save flow into React modules under client/src/features/management-dashboard.`

### Prompt 8

`Goal: replace remaining SweetAlert-owned business dialogs with reusable React modal components while preserving exact same user-visible behavior, validations, and actions.`

### Prompt 9

`Goal: replace remaining DataTables-owned business rendering with React table primitives and explicit column definitions while preserving exact same sorting, searching, filters, pagination, row badges, and actions.`

### Prompt 10

`Goal: run a final screen-by-screen UI parity pass across employee, admin, client, and management portals and remove any remaining dependency on appscript frontend files before marking the MERN frontend production-ready.`

## What "done" actually means

The frontend should only be called fully migrated when all of the following are true:

- every legacy screen has a React route or React-owned panel
- every legacy modal has a React-owned equivalent
- every legacy filter and tab has React state ownership
- every legacy table has React-owned rendering behavior
- client portal is fully rebuilt, not partially represented
- management batch assignment is fully functional
- no user-visible workflow depends on `appscript/*.html`
- final parity audit shows no intentionally missing UI piece
