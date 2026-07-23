# WorkTrack Frontend Migration Boundary

## Current live behavior

The routes below are still rendered from Apps Script HTML through the Express exact server:

- `/`
- `/worktrack`
- `/client`
- `/dashboard`
- any non-API fallback route handled by `server.js`

Those pages still depend on:

- `appscript/index.html`
- `appscript/client-index.html`
- `appscript/dashboard-index.html`
- `public/googleScriptRunShim.js`

## New MERN frontend boundary

The new React frontend now lives under:

- `client/src`

The built frontend is served from:

- `/mern`

That new frontend is independent from the Apps Script HTML files for:

- routing
- theme tokens
- app shell
- module folder structure
- API client wiring
- migration metadata and planning surfaces

## What is still pending

The actual business screens are still pending migration into React:

- Dashboard
- Attendance
- Ticket System
- FMS Tracker
- Approvals
- Forms Portal UI
- Client Portal UI
- Expenses
- Reports
- Admin screens

## Rule for next steps

Every next module migration should move code into `client/src/features/...` first and only remove the old `appscript` dependency after the React screen has been verified against the exact current UI.
