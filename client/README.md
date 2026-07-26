# WorkTrack MERN Frontend

This folder is the production frontend workspace for the WorkTrack MERN runtime.

## Why it exists

The live WorkTrack runtime is served from the React build generated from `client/src`.
The old `appscript/` folder now acts as a parity reference only, not as a runtime
frontend dependency.

This `client/` workspace is the React/Vite frontend where modules are owned and
completed one by one:

- shared theme tokens
- shared shell layout
- real React routing
- module folders for attendance, tickets, FMS, reports, forms portal, admin, and client portal

## Commands

Run from the repo root:

```bash
npm run client:install
npm run client:dev
```

Build:

```bash
npm run client:build
```

## Current status

- The live app is served from the built React client through `server.js`.
- The React shell and route families live under `client/src`.
- The remaining migration work is module parity, data-contract cleanup, and final
  removal of any lingering Apps Script-era assumptions from runtime behavior.
