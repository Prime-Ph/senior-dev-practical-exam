# Senior NestJS Practical Exam

## Assignment: scale the reservation API

The reservation API works in a single application instance, but throughput drops
as traffic and reservation history grow. After adding a second API instance,
concurrent requests can oversell stock or create duplicate reservations.

Fix the scalability problems and demonstrate the improvement. Preserve stock
consistency, idempotency, tenant isolation, validation, and failure recovery.

**Time limit: 60-minute exam, followed by a 45-minute technical defense.**
The clock starts after installation, build, and smoke checks. Suggested pacing:
10 minutes to investigate, 30 to implement, 15 to test/measure, and 5 for notes.

**AI is allowed.** Record meaningful assistance in `SUBMISSION.md`. You must
explain and defend every change. During the ten-minute live defense exercise,
work without AI; documentation is allowed.

## Setup

Use Node.js 22 or 24 and npm. No Docker, database installation, external account,
or paid service is needed.

```sh
npm ci
npm run build
npm run test:smoke
npm run test:regression
npm run test:scalability
npm run bench
npm start
```

Build, smoke checks, and single-instance regression tests pass on the starter.
Seven of the nine scalability tests intentionally fail. `npm test` runs all
three suites. Keep supplied assertions; add tests for gaps in your solution.

The server runs at `http://127.0.0.1:3000`; `PORT` overrides the port.
Restarting resets its data. Tests create isolated apps unless sharing a backend.

## Required changes

1. **Correct coordination across instances.** Separate NestJS applications share
   one storage fixture but have independent service instances and queues. Protect
   stock and tenant-scoped idempotency at the shared storage boundary. A queue or
   mutex in one API instance cannot coordinate another instance.
2. **Concurrency without a global bottleneck.** A stalled request for Alpha's
   `desk` must not block Alpha's `room` or Beta's `desk`. Preserve correctness for
   a hot item and for a key reused across different items. Explain lock scope,
   ordering, cleanup, and the limits of your approach.
3. **Read cost independent of history size.** A key lookup must inspect at most
   one reservation, and a page of size `limit` at most `limit + 1` reservations,
   regardless of history size, tenant count, or cursor position. Maintain accurate
   `keyRowsVisited` and `listRowsVisited` instrumentation. Do not merely return a
   smaller response after scanning all records.

Run the supplied benchmark before and after. Report the same workload settings,
throughput, p50/p95 latency, statuses, row visits, and consistency checks. There
is no fixed latency target: measured improvement and correct reasoning matter.

## Shared-storage fixture

`createApp(backend)` creates an independent application. Two calls with the same
`SharedStorageBackend` share data and storage coordination, but not service queues.
Tests start both applications before issuing overlapping requests.

The backend supplies asynchronous I/O, ordered resource locks via
`transaction(resourceKeys, work)`, staged writes, and atomic publication/failure.
The starter uses an application-wide queue and empty transaction resource keys.
You may change service/storage interfaces and add indexes. Keep the asynchronous
boundary, accurate metrics, transaction failure guarantees, and test seams.

This is a **single-process simulation of multiple API instances using shared
storage**. Its in-memory locks do not coordinate OS processes and its data is not
durable. You are assessed on this fixture and on a concrete production design
using database transactions, indexes, and constraints. Implementing a real
distributed service or database is outside the sixty-minute scope.

Test-only methods include `pauseNextStockRead`, `failNextReservationWrite`,
`seedHistoricalReservations`, `setStockForFixture`, and `resetMetrics`. They
have no HTTP endpoints. Historical records concern a retired item and are not
new reservations deducted from the current stock fixtures.

## API and fixtures

All routes require `Authorization: Bearer demo-alpha` or `Bearer demo-beta`.
Tenant identity comes from the token. Initial availability:

| Tenant | Item | Available |
| --- | --- | ---: |
| alpha | desk | 3 |
| alpha | room | 2 |
| beta | desk | 10 |
| beta | beta-only | 4 |

| Route | Contract |
| --- | --- |
| `POST /reservations` | 201; requires `Idempotency-Key` and `{ "itemId": "desk", "quantity": 1 }`. |
| `GET /reservations?limit=20&cursor=0` | 200; returns `{ items, nextCursor }`. |
| `GET /reservations/:id` | 200 for an owned reservation; 404 for unknown or foreign IDs. |
| `GET /inventory/:itemId` | 200 with `{ tenantId, itemId, available }`; 404 for missing or foreign inventory. |

Reservation shape: `{ id, tenantId, itemId, quantity, idempotencyKey }`.

Preserve these requirements:

- Quantity is a positive JSON safe integer. Item/key strings contain only
  letters, digits, underscores, or hyphens, with length 1-64. Invalid input
  or unknown body fields return 400 before replay or mutation; invalid auth returns 401.
- Insufficient stock returns 409 without mutation. Committed quantities must
  match stock deductions; non-negative final stock alone is insufficient.
- Identical retries return the original reservation, including its ID, without
  another deduction. A changed item/quantity for a completed tenant key returns
  409. Keys span items within a tenant; different tenants may reuse a key.
- Persistence failure returns 500 with no partial writes or consumed key.
  A later retry and unrelated requests must still work.
- Lists contain only the authenticated tenant's rows, in commit order.
  `limit` defaults to 20 and must be an integer from 1 to 100.
  The fixture cursor is a non-negative safe integer string identifying a
  tenant-local position in an append-only history. Omitted cursor starts at 0.
  `nextCursor` is a string, or null at the end. Invalid parameters return 400;
  a cursor beyond the end returns `{ items: [], nextCursor: null }`.
  Explain how a production indexed/keyset cursor would differ from SQL OFFSET.

Validation and tenant isolation are already implemented. Keep them working.

## Measure and submit

`npm run bench` runs hot-item, independent-item, and retry-burst workloads against
one and two application instances. It seeds 10,000 historical rows per tenant
and injects 1 ms storage I/O. Defaults: 100 requests, concurrency 10.
Non-retry workloads include 20% paginated reads. Environment variables `REQUESTS`,
`CONCURRENCY`, `HISTORY`, and `IO_DELAY_MS` adjust the same workload before/after.

Report the exact settings. This local synthetic test is not a production
capacity estimate. Check stock/committed writes and retry IDs alongside speed.
Explain what happens as history, concurrent clients, or hot-key traffic increases.
Correct coordination may reduce apparent hot-item throughput when the baseline
was accepting inconsistent writes. Explain this trade-off alongside the gains
for independent work; do not trade correctness for a higher request count.

Submit source, added tests, and a concise `SUBMISSION.md` with:

- Root causes and the fixes, including alternatives and trade-offs.
- Before/after benchmark output and test/build results.
- Index/transaction boundaries, complexity, and memory/retention costs.
- A production plan: database schema/indexes, uniqueness constraints, locking
  or conditional updates, retries, connection limits, and overload handling.
- Remaining limitations and the AI-use log.

Keep the app runnable; do not skip checks, alter metrics to hide scans, remove
I/O yields, hard-code fixture answers, or add debug HTTP endpoints. No UI or
deployment is required.

## Defense and scoring

Be ready to demonstrate cross-instance correctness, explain contention and
lookup/page complexity, defend benchmark methodology, adapt a test, and describe
production failure/overload behavior.

Scoring: scalability 35%, correctness 20%, tests/evidence 15%, technical defense
30%. A working solution must also be explainable and defensible.

References: [NestJS testing](https://docs.nestjs.com/fundamentals/testing) and
[NestJS 11 validation](https://docs.nestjs.com/v11/techniques/validation).
This assessment stays on NestJS 11; a framework upgrade is not part of the task.
