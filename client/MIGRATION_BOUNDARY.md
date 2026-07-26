# WorkTrack Frontend Migration Boundary

## Current live behavior

The routes below are rendered from the built React app served by `server.js`:

- `/`
- `/worktrack`
- `/client`
- `/dashboard`
- any non-API fallback route handled by `server.js`

Those routes now depend on:

- `client/src`
- the built frontend in `client/dist`
- Express APIs under `server/`
- MongoDB-backed application services

## New MERN frontend boundary

The React frontend lives under:

- `client/src`

The built frontend is served from:

- `/`
- `/worktrack`
- `/client`
- `/dashboard`
- any non-API fallback route handled by `server.js`

The React runtime is already independent from the Apps Script HTML files for:

- routing
- theme tokens
- app shell
- module folder structure
- API client wiring
- migration metadata and planning surfaces

## What is still pending

The remaining work is not route migration anymore. The remaining work is full
feature parity and independence hardening across business modules such as:

- Dashboard
- Attendance
- Ticket System
- FMS Tracker
- My Approval Status
- Approvals
- Forms Portal
- Client Portal
- Expenses
- Reports
- EMP Master
- Notifications
- Admin screens

## Rule for next steps

Every next migration step should keep runtime inside `client/src` + `server/`
only, use `appscript/` strictly as a reference for parity review, and remove any
remaining Apps Script-era assumptions only after the React flow has been
verified against the current working UI.
