# WorkTrack MERN Migration Notes

WorkTrack now runs from the React frontend in `client/src`, the Express APIs in
`server/`, and MongoDB. The `appscript/` directory remains only as a reference
for parity review and is not loaded by the production server.

## Runtime

- `/` and `/worktrack` open the employee/admin React workspace.
- `/client` and `/client/*` open the client React portal.
- `/dashboard` opens the management dashboard route for authorized employees.
- `/api/health` reports the active Mongo-backed service.
- `client/dist` is served by `server.js` after `npm.cmd run build`.

Authentication and every protected module API use signed MERN sessions. The
runtime has no `google.script.run` shim, Apps Script route, Apps Script HTML
renderer, or seed-data fallback. Login credentials come from MongoDB only.

## Data migration

1. Set `MONGO_URI` and `WORKTRACK_AUTH_SECRET` in `.env`.
2. Export Google Sheet tabs as `.csv` or `.xlsx` files into `imports/`.
3. Run `npm.cmd run import:sheets`.

The importer maps the known WorkTrack modules to Mongo collections while
preserving legacy field names and identifiers. It supports Users, Clients,
Tickets, Attendance, Leaves, Intimations, Expenses, FMS, To-Do, Invoices,
Messages, Social, Forms Portal, Ticket History, and WhatsApp Logs.

Forms Portal records, external links, and selected-user access assignments are
stored in MongoDB. Uploaded and camera/base64 files are stored under
`uploads/`, with their URL paths persisted in MongoDB.

## Verification

```bash
npm.cmd run verify:all
npm.cmd run verify:mongo-persistence
npm.cmd run verify:visual
```

`verify:all` builds the React application, checks import contracts, and smoke
tests employee and client route families. `verify:mongo-persistence` performs
temporary authenticated writes through the real API, verifies their Mongo
readbacks, then removes only its own temporary records.

`verify:visual` renders the dashboard, attendance, tickets, Forms Portal, and
reports routes in Chrome at a fixed desktop viewport, captures screenshots, and
fails on protected-route redirects, invalid rendered values, console errors, or
failed API responses.

For local development, run `npm.cmd run dev` and open
`http://localhost:5000/login` after the production client build is present.
