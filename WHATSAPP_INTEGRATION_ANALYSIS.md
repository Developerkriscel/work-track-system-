oa# WorkTrack / Kriscel — AKNexus automatic alerts analysis

Reviewed: 9 September 2026. Scope confirmed by the user: existing AKNexus, automatic alerts.

This is a source-code audit and implementation blueprint, not an activated integration. Existing application changes were preserved. No provider send request, database mutation, deployment, or live recipient test was performed. Local credential presence was checked without copying values. Mock checks below used dummy credentials and a replaced `fetch`.

## 1. Main finding

The project already has an AKNexus sender, but it is disconnected from the running application. Searches of current server and React source found its send/helper functions only in `server/services/whatsapp.service.js`, with no business-service imports or calls. Adding credentials alone therefore does not activate alerts.

The old Apps Script has considerably more notification functionality than the migrated backend: assignment, approvals, client replies, chat alerts, leave/intimation, expenses, daily summaries, TAT warnings, and failed-message retries. Integration is a migration of event behavior as well as an API connection.

## 2. Current architecture and implications

| Area | What the code implements | Integration implication |
| --- | --- | --- |
| Frontend | React 18, Vite, React Router; feature pages under `client/src/features` | Trigger alerts on the server so they work when browsers are closed. |
| API | Express routes mounted by `server.js`; business logic in services | Emit semantic notification events from successful business mutations. |
| Authentication | Signed bearer sessions, employee/client identity separation, route and service permissions | Recipient selection must respect existing ownership and approval rules. |
| Database | MongoDB/Mongoose; 19 legacy model definitions storing fields inside `data` | Normalize identity/phone aliases centrally; use a separately indexed durable outbox. |
| Cache | Redis plus in-process caches | These are read caches, not a durable notification job system. |
| In-app notifications | Backend derives notifications from current records; frontend polls every 45 seconds and stores read state locally | Do not send WhatsApp from polling endpoints; repeated reads would produce repeated alerts and historical alerts. |
| Employee master | `EmpMaster` syncs into login `User` records using `User ID` | Resolve operational recipients via login identity, rather than assuming EMP Code equals Employee ID. |
| Files | Local uploads and S3-compatible/R2 service | Start with a portal link; attachment delivery needs separate provider-contract verification. |
| Scheduling | Auto-ticket generation on startup and a local-midnight timer | No WhatsApp reminder/retry worker is started. Multi-process execution needs durable claims. |
| FMS | MongoDB tasks plus Google Sheets CSV synchronization, enabled by default in code | App-created tasks and sheet-synced changes are different event sources. |
| Deployment | Render manifest and a separate deployment script exist | Actual live environment, instance count and provider configuration were not verified. |

Primary files: `server.js`, `server/models/legacyModels.js`, `server/services/legacyStore.service.js`, `server/services/notifications.service.js`, `client/src/features/notifications/useNotificationCenter.js`, `server/services/empMaster.service.js`, `server/services/fms.service.js`.

## 3. Existing WhatsApp implementation: verified gaps

1. **No event wiring.** `whatsapp.service.js` exports `sendWhatsAppMessage`, ticket assignment/status/approval/client-update helpers, and a custom sender. None are called by current business services.
2. **Configuration mismatch.** The sender expects `AKNEXUS_ACCESS_TOKEN`; `.env.example` declares `AKNEXUS_API_TOKEN`. Local `.env` does contain nonempty `AKNEXUS_ACCESS_TOKEN` and `AKNEXUS_INSTANCE_ID`. Thus the mismatch affects setup/documentation; it is not evidence that the local token is missing. Token validity and instance connection are unverified. The Render manifest declares neither AKNexus variable.
3. **False-positive success.** The condition `data.status === 'success' || data.sent === true || response.ok` logs success for HTTP 200 even if the JSON says `status: 'error'`. Conversely a positive body can override an unsuccessful HTTP status. Acceptance requires the documented combination of HTTP and provider response fields.
4. **Incomplete phone validation.** Non-digits are removed and only a minimum length of 10 is checked. A ten-digit Indian number is forwarded without `91`, despite the function contract requiring a country code. Excessively long or ambiguous input also passes. Use canonical international numbers and an explicit default country policy.
5. **No application timeout.** Fetch has no abort signal/deadline. A slow provider could hold a future inline business request open.
6. **No durable delivery lifecycle.** The sender writes console logs only. The existing `WhatsAppLog` model/import support is not used by it. No queue, attempt history, backoff, dead-letter handling, persistent deduplication, or message-status reconciliation is implemented.
7. **Ambiguous return values.** Missing config, invalid numbers and exceptions return `null`; rejected JSON is returned as an ordinary object. Callers need explicit outcomes such as accepted, failed, skipped and unknown, with safe reason codes.
8. **No integration controls.** No module toggles, global send switch, dry-run mode, recipient preferences, admin message-log page or dedicated WhatsApp routes were found in current application source.
9. **Limited message content.** Existing helpers omit real portal URLs and some actionable details such as approver context and plan date. Internal remarks must not be copied wholesale into client-facing messages.
10. **Legacy credential exposure in source.** `appscript/code.gs` contains hardcoded provider credentials near its old API constants. Treat those old credentials as exposed and rotate if still valid. Their values are deliberately omitted here. The old sender points to `aiadrika.in`, whereas the Node sender points to AKNexus; do not assume interchangeable credentials/contracts.

## 4. Exact business integration map

The recipients below are proposed defaults, to be implemented using existing permission decisions and canonical recipient resolution.

| Event | Current mutation point | Intended recipient / special handling |
| --- | --- | --- |
| Ticket assigned | `ticket.service.js:createTicket` | Assigned active employee after persistence. |
| Employee bulk creation | `ticket.service.js:createBulkTickets` calls `createTicket` | Reuse assignment event; do not emit again in bulk wrapper. |
| Auto-ticket occurrence created | `autoTicketScheduler.service.js:processAutoTickets` | Assigned employee; this writes directly and bypasses `createTicket`. Template edits should not send assignment alerts. |
| Client creates ticket | `clientPortal.service.js:createBulkTicketsWithDetails` | Configured client-ticket triage owner/team; these new rows have no employee assignee. |
| Completion submitted | `ticket.service.js:updateTicket` | Effective approver only when persisted final status is Pending Approval; some completions become Closed immediately. |
| Approved / rework | `ticket.service.js:adminTicketAction` AND `approvals.service.js:adminTicketAction` | Assigned employee; client-facing closure update only under the client notification rule. Both API paths must emit the same event shape. |
| Approval transferred | `transferTicketApproval` in both ticket and approvals services | New effective approver, resolving the application's transfer rules. |
| Employee reassignment | `ticket.service.js:reassignTicket` | New assignee; compare old/new owner and suppress no-op assignments. |
| Client action requested | `ticket.service.js:reassignTicket`, target `client` | Owning client. This clears Employee ID, so retain prior actor/owner context for the event. |
| Client responds | `ticket.service.js:processClientResponse` AND `clientPortal.service.js:submitClientResponse` | Restored responsible employee; avoid duplicate sends for the same response. |
| Client changes status | `clientPortal.service.js:updateTicketStatusByClient` | Responsible employee/triage owner, according to resulting status. |
| Portal chat | `ticket.service.js:postTaskMessage`, `clientPortal.service.js:postMessage` | Authorized counterpart; never echo to sender. Group rapid messages into a short notification window. |
| Leave / intimation submitted | `attendance.service.js:submitLeaveRequest`, `submitIntimation` | Actionable reviewer(s), with one event per logical request rather than per stored day. |
| Leave / intimation / attendance reviewed | `approvals.service.js:processApprovalAction` | Requesting employee, reflecting HR Approved versus final approval. |
| Expense submitted / reviewed | `expenses.service.js:recordExpense`, `processExpenseApprovalFromMongo` | Eligible approver(s) / employee; use expense-specific authorization rules. |
| FMS assignment / completion | `fms.service.js:createFmsTask`, `markFmsTaskDone` | Assignee / configured reviewer; client name alone is insufficient to resolve a client contact. |
| FMS sheet changes | `fms.service.js:syncFmsFromGoogleSheet` | Explicit source-diff events after initial baseline; no notification flood on first sync/import. |
| Employee onboarding | `admin.service.js:saveOrUpdateUser`, called by EMP Master sync | Send only for genuinely new eligible account, not each master edit. Never include stored passwords. |
| To-do / daily workload | `todo.service.js` plus a new reminder job | Owner digest; replace old hardcoded individual auditors with configurable recipients. |

## 5. Recipient and event correctness

- Employee phone aliases include `Mobile Number`, `Mobile`, `Phone No`, `phone`, and `mobile`. Client aliases include `Mobile Number`, `Contact`, and `mobile`.
- Resolve recipients by stable employee/client ID, check active status, normalize phone once, and deduplicate identical destinations within an event.
- Approval selection is more complex than looking up Manager ID. The code has explicit approvers, comma-separated IDs, role rules and reassignment fields. Several optimized projections omit phone fields; query contacts separately with a minimal projection.
- Keep actor ID, old/new owner, old/new status, client ID, logical operation ID and source in the event. Sending from only the updated row loses important context.
- Generate an event only for a successful meaningful change. Updating read flags, refreshing dashboards, importing history or warming caches must not send messages.
- The store's `registerStoreMutationListener` receives only the model name, not old/new row data, identity or action. It is suitable for cache invalidation, not sufficient for reliable semantic alerts. A generic send hook in `upsertRow` would also include imports and unrelated writes.
- Use the same resolver/event contract from duplicated mutation paths. Longer term, consolidate those paths after behavior parity checks.

## 6. Proposed reliable delivery design

```text
Authorized business action
  -> validate business transition and recipients
  -> persist entity change + durable notification event
  -> return normal application result

Worker atomically claims queued event
  -> recheck event eligibility / recipient preference
  -> render message and call AKNexus with timeout
  -> record accepted / failed / unknown + next attempt
  -> show state in restricted admin logs
```

Prefer a new typed outbox model rather than putting all delivery state into unindexed legacy `Mixed` fields. Suggested fields:

`eventId`, `operationId`, `eventType`, `entityType`, `entityId`, `source`, `recipientKind`, `recipientId`, `toPhone`, `templateKey`, `templateVersion`, `payload`, `status`, `attemptCount`, `nextAttemptAt`, `leaseUntil`, `providerMessageId`, `lastErrorCode`, `createdAt`, `acceptedAt`.

Add a unique event/recipient/template key and an index for claiming due jobs. The key must identify the actual operation/version, not just ticket ID and status: the same ticket can legitimately enter Rework more than once. Use atomic lease claims so multiple processes cannot normally send the same job concurrently.

For a durable guarantee, entity mutation and outbox insert must commit together in a MongoDB transaction, after confirming the deployed topology supports transactions. A separate enqueue after saving leaves a crash gap. If transactions cannot be used, explicitly design a persisted pending-event marker and reconciliation process; do not label an ordinary fire-and-forget call reliable.

Retry documented transient failures with bounded backoff and jitter. Treat invalid recipient/configuration and documented permanent rejection as non-retryable until corrected. After a timeout following request transmission, delivery is uncertain: local deduplication alone cannot guarantee exactly-once delivery. Verify whether AKNexus supports an idempotency key or message lookup before automatically retrying ambiguous attempts.

Use `accepted` when the provider accepts a request. Do not claim `delivered` or `read` without provider evidence. If the account supports authenticated delivery callbacks, reconcile them by provider message ID with duplicate/out-of-order handling. Automatic outbound alerts can be implemented without an inbound chatbot.

Suggested code additions: an outbox model, contact resolver, event dispatcher, message templates, AKNexus adapter, worker, and admin-only status/log routes. Keep existing `whatsapp.service.js` as a small compatibility layer if its helpers are retained.

Suggested configuration: standardize `AKNEXUS_ACCESS_TOKEN` and `AKNEXUS_INSTANCE_ID`; add validated base URL, `WHATSAPP_ENABLED`, dry-run control, portal base URL, explicit timezone, send timeout and event-category settings. Do not store tokens in React, browser storage, or message logs.

## 7. Reminders and scheduler issues

Old Apps Script contains five-minute TAT warnings, breach, ten-minute overdue, one-hour and subsequent reminders, plus daily pending/audit/company summaries and retry handling. These are absent from the current Node WhatsApp flow.

Do not port old TAT arithmetic blindly. The old reminder code uses Last Update Date as the running start. Current Node chat and other edits also update that timestamp. Derive active work time from persisted session timing plus Total Duration; explicitly model pause/resume and date rollover.

The auto-ticket duplicate query repeats the JavaScript `$or` key three times. Only the final description condition survives; client and employee filters are overwritten. Consequently a ticket for one client/employee can suppress generation for another. A local extracted-query check confirmed this. Separately, check-then-insert without a unique occurrence key permits races between processes.

Before enabling auto-ticket alerts, use a stable template ID + business date occurrence key, atomic creation and an explicit business timezone. The current scheduler uses host-local dates and midnight, while ticket timing hardcodes `Asia/Kolkata`. Reminder state and daily digest deduplication must survive restarts. Recheck status before sending a delayed reminder, so closed tickets do not receive stale warnings.

## 8. Related project findings relevant to rollout

- `server/routes/ticket.routes.js` exposes a destructive GET `/delete-generated-autos`; the mounted employee guard does not restrict this route to administrators. Any authenticated employee reaching it can invoke the deletion query. Remove the debug operation or replace it with an appropriately authorized administrative mutation before rollout.
- Auto-ticket save/delete routes have no administrative role gate, and their service functions accept no actor identity or role. The delete service also does not verify that the target is an auto-ticket template. Add ownership/role and record-type checks before notifications amplify these operations.
- `server.js` mounts `/debug-buddy-raw` outside the API authentication guard. Its current call to `listRows()` without a model appears inconsistent with the store contract; data disclosure from this route was not demonstrated. Remove or protect the debug route regardless.
- FMS uses direct `bulkWrite` during sheet sync, bypassing ordinary per-task create/update functions. Hooking only those functions will not cover synchronized tasks.
- Existing verification scripts can connect to the configured database and create test fixtures, sometimes using existing active users/clients. Once notifications are wired, running them without a mock/disabled transport could contact real people. A dedicated test database and fake transport are needed.

## 9. Verification performed and remaining evidence

Performed:

- Traced active entrypoint, routes, business mutations, legacy storage, recipient fields, notification polling, scheduler and relevant Apps Script behavior.
- Checked local AKNexus variable presence, sample-variable mismatch and deployment-manifest omissions without recording credential values.
- Executed the existing sender with a mocked fetch and HTTP 200 `{status: 'error'}`: confirmed the false success log.
- Confirmed that the sender forwards a ten-digit number unchanged and supplies no abort signal.
- Evaluated the scheduler duplicate-query expression with dummy values: confirmed the overwritten client/employee conditions.

Not established: current AKNexus authentication contract, accepted/error response schema, instance connectivity, recipient data quality in the live database, webhook authentication, rate limits, media support, idempotency support, live deployment health or actual message delivery.

Public AKNexus pages advertise API/webhook features and multiple connection options, but the accessible application entrypoint is a login page. That is insufficient to validate this account's `/api/send` contract. References checked: [AKNexus application](https://app.aknexus.in/login), [AKNexus product page](https://aknexus.in/cloud-base-software/). Use the existing account's API documentation or a redacted request/response example to settle the remaining contract details; do not infer them from promotional claims.

## 10. Implementation order and acceptance criteria

1. **Delivery foundation:** verify account contract, align config, fix phone/response handling, implement timeout, outbox, worker, masked logs and dry-run controls.
2. **Core ticket alerts:** assignment, effective pending approval, approved/rework, reassignment, pending client response and client reply across all mutation paths.
3. **Additional workflows:** leave/intimation, expense approvals, onboarding and FMS, with explicit recipients and event toggles.
4. **Scheduled reminders:** correct scheduler occurrence handling and session-time calculations, then add bounded TAT reminders and daily digests.
5. **Operational UI:** restricted delivery logs, failed/unknown reason, safe retry actions, integration health and event settings.

Acceptance checks should cover both ticket approval APIs, client-origin tickets with no assignee, rejected business actions, repeated/no-op updates, pause/resume, closed-before-reminder, duplicate queue claims, worker restarts, malformed provider responses, HTTP 200 failures, 429/5xx, invalid phone, inactive recipient, multi-day leave grouping, sheet-sync baseline suppression, and transport-disabled regression tests. Finish with a controlled delivery check to an explicitly designated test recipient before enabling real automatic alerts.
