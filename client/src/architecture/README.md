## WorkTrack MERN Frontend Blueprint

This folder is the source-of-truth map for migrating the legacy `appscript` UI into a production-ready React frontend under `client/src`.

It does three jobs:

1. Inventories the current Apps Script UI by screen, modal, table, filter, and script source.
2. Maps each legacy surface to a React feature area and reusable component layer.
3. Defines the stable frontend folder structure we will grow into without changing current working behavior.

Use these files together:

- `appscriptUiInventory.js`: canonical legacy screen inventory
- `appscriptUiInventory.js -> screenOwnershipMap`: enriched route/page/module ownership map
- `appscriptUiInventory.js -> featureFolderBlueprint`: production-ready folder responsibility map
- `legacyInteractionMap.js`: deeper interaction map of UI state, legacy functions, React targets, and must-own React surfaces
- `reactModuleOwnershipMatrix.js`: concrete current React file ownership for each legacy screen and remaining parity gaps
- `routeMigrationMatrix.js`: actual React route families, guards, shells, login entry points, and migration observations
- `legacySelectorRegistry.js`: high-value legacy selectors mapped to React shells/pages/components and parity status
- `featureStructureAudit.js`: feature-by-feature folder consistency audit against the target production pattern
- `uiSurfaceOwnershipMatrix.js`: dedicated ownership matrix for legacy tables, filters, modals, and script entry points
- `frontendParityBacklog.md`: prioritized implementation order for the remaining non-React-owned frontend surfaces
- `coverageMatrix.md`: current React coverage snapshot
- `parityAudit.md`: current exact-parity gap list
- `uiMigrationRunbook.md`: production-ready migration order and step-by-step goal prompts
- `index.js`: central export surface for the architecture maps

### Current target structure

```text
client/src
  app/                # router, providers, app bootstrap
  architecture/       # migration contracts and UI inventory
  components/
    charts/           # reusable chart shells and adapters
    common/           # shared atoms and small compounds
    forms/            # shared form fields and form layouts
    layout/           # app shell, nav, header, sidebars
    modals/           # modal wrappers and dialog building blocks
    tables/           # reusable data table and row action shells
  features/
    admin/
    approvals/
    attendance/
    auth/
    client-portal/
    client-social/
    clients-portal/
    dashboard/
    expenses/
    fms/
    forms-portal/
    management-dashboard/
    reports/
    tickets/
    todo/
  hooks/              # cross-feature hooks
  lib/                # http client, constants, contracts
  pages/              # route-level page assembly
  services/           # cross-feature service facades
  styles/             # tokens, base styles, page styles
  utils/              # pure helpers
```

### Rule for ongoing migration

- Keep current working behavior stable.
- New React work should land in `client/src`, not in `appscript`.
- Any parity decision should be validated against the inventory files in this folder before UI work starts.
- Frontend migration is not complete until client portal surfaces and remaining modal/table ownership are fully React-native.

### What the ownership map now gives us

For every legacy screen, we now keep one place that answers:

- which React feature owns it
- which route should render it
- which page file assembles it
- which feature-level folders should contain its modules
- which shared primitives it depends on
- which parity gaps still matter before we can remove Apps Script frontend ownership

And in the deeper interaction map we also track:

- which UI state clusters the legacy screen manages
- which concrete legacy functions currently own that behavior
- which React folders should absorb that behavior
- which visible surfaces must still become fully React-owned before the migration can be called complete

And in the module ownership matrix we track:

- which current React page file owns the route
- which hook/provider owns state
- which API/service files own data shaping
- which component files currently represent the legacy surfaces
- which specific parity gaps are still open for that screen

And in the route migration matrix we track:

- which guarded shell owns each route family
- public login entry points
- protected default routes
- actual route-to-page wiring already present in the React app
- route-level migration observations that still matter for full parity

And in the selector registry we track:

- high-value legacy IDs/classes from Apps Script pages
- the visible surface each selector represents
- the current React file targets that now own or should own that surface
- whether that selector is fully migrated, partially migrated, or still pending
- the remaining parity notes attached to that specific visual surface

And in the feature structure audit we track:

- whether each feature folder follows the target production pattern
- which route family and page entry it owns
- which hook/provider, API, services, contracts, and components it already has
- which folder-level gaps still remain, such as missing local documentation
- whether the remaining work is mostly structure work or parity work

And in the UI surface ownership matrix we track:

- legacy table surfaces and their current React owners
- legacy filter surfaces and their current React owners
- legacy modal/dialog surfaces and whether they are fully React-owned yet
- legacy backend script entry points and the React hooks/API layers that now absorb them

This is the most direct answer to "where did each old table/filter/modal/script go in MERN?"

And in the frontend parity backlog we track:

- the highest-priority remaining frontend dependency gaps
- which shared or feature-level surfaces should be implemented next
- a recommended execution sequence for the last mile of parity work

That means `appscript/*.html` can now be treated as a visual and behavioral reference, while `client/src` is the permanent production target.
