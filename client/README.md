# WorkTrack MERN Frontend

This folder is the new production-oriented frontend workspace for the WorkTrack migration.

## Why it exists

The current live app still renders exact Apps Script HTML through `server.js`. That keeps parity stable, but it also means the frontend is still tied to `appscript/*.html`.

This `client/` workspace is the clean React/Vite frontend where each module will be migrated one by one:

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

- The live app is still served from `appscript` through the Express exact-parity server.
- The new React shell is ready under `client/src`.
- No production routes have been flipped yet, so current working behavior stays intact.
