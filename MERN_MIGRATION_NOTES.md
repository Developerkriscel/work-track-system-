# WorkTrack MERN Migration Notes

This project now serves the original Apps Script UI as the primary MERN UI:

- `/` and `/worktrack` serve the original `appscript/index.html` WorkTrack UI.
- `/client` serves the original `appscript/client-index.html` UI.
- `/dashboard` serves the original `appscript/dashboard-index.html` UI.
- `/exact/worktrack`, `/exact/client`, and `/exact/dashboard` remain aliases.

Those exact pages keep the same Apps Script HTML, CSS, theme, layout, modals, DataTables, Chart.js usage, and client-side JavaScript. Express injects `public/googleScriptRunShim.js`, which recreates `google.script.run` in the browser and forwards calls to `/api/apps-script/:functionName`. The shim also supports Apps Script-style success/failure handlers, `withUserObject`, and safe `google.script.host` no-ops for browser parity.

The earlier generated React/Vite UI has been removed from the runnable app path. There is no `/react`, Vite dev server, or `dist` fallback; the Apps Script files are the only UI source of truth.

The WorkTrack and Client Portal pages also validate restored browser session data before auto-login. Incompatible stale `currentUser` / `currentClient` values from earlier local builds are cleared so the original Apps Script UI cannot boot with malformed generated-app state.

Current seed fallback logins when MongoDB has no imported rows:

- Employee/Admin: `NL106` / `123456`
- Employee/User used for Apps Script screenshot parity: `VK` / `123456`
- Client: `CL000` / `123456`

Run the server:

```bash
npm.cmd start
```

Check what the expected local ports are actually serving:

```bash
npm.cmd run status
```

Verify the exact UI wiring:

```bash
npm.cmd run build
```

Run live browser parity checks against the exact Apps Script pages:

```bash
npm.cmd run verify:browser
```

This logs into the employee WorkTrack UI, client portal, and master dashboard on `localhost:5173`, rejects the old generated React-style UI, and saves:

- `tmp-browser-parity-worktrack.png`
- `tmp-browser-parity-client.png`
- `tmp-browser-parity-dashboard.png`

The exact Apps Script UI is served on both `5000` and `5173` so old Vite/local browser tabs still show the same UI:

```text
http://localhost:5000/
http://localhost:5000/client
http://localhost:5000/dashboard
http://localhost:5173/
http://localhost:5173/client
http://localhost:5173/dashboard
```

If either exact port is busy with anything other than the exact Apps Script UI, `npm.cmd start` now fails loudly instead of leaving a stale generated UI visible on `localhost:5173`. Stop the conflicting process, then rerun `npm.cmd start`.

MongoDB migration:

1. Set `MONGO_URI` in `.env`.
2. Export each Google Sheet tab as `.csv` or `.xlsx`.
3. Put the files in `imports/`.
4. Run:

```bash
npm.cmd run import:sheets
```

The importer detects common file/sheet names such as Users, Clients, Tickets, Attendance, Leaves, Intimations, Expenses, FMS, To-Do, Invoices, Messages, Social, Forms, Ticket History, and WhatsApp Logs. Rows are stored with original column names so the Apps Script UI receives the same field names it already expects.

Uploaded base64/camera files are saved under `uploads/` and returned as URL paths.
