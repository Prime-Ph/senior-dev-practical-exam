# Senior NestJS Practical Exam

## Assignment: repair the reservation incident

You have inherited a small multi-tenant inventory reservation API. Support reports
that simultaneous bookings can reserve more inventory than exists, retries sometimes
create unexpected results, and one customer has seen another customer's booking.
Your task is to reproduce the problems, find their causes, and repair the API.

**Time limit:** 60 minutes of implementation, followed by a 45-minute technical
defense. The interviewer starts the clock after installation and the smoke checks.
If you run out of time, document unfinished work and its impact.

Suggested pacing: 10 minutes to reproduce and inspect, 30 minutes to implement
focused fixes, 15 minutes to verify and add regression coverage, and 5 minutes to
complete the submission notes. Keep the notes concise; production architecture is
a discussion topic, not an implementation requirement.

**AI is allowed.** You may use coding assistants, search, documentation, and libraries.
You are responsible for every submitted line and must be able to explain, test, and
modify your solution during the follow-up. Record meaningful AI assistance in
`SUBMISSION.md`; raw chat transcripts are not required. AI use itself is not penalized.

## Setup

Use Node.js 22 or 24 and npm. This project uses NestJS 11, TypeScript, Jest, and
Supertest. No Docker, database, external account, or paid service is required.

```sh
npm ci
npm run build
npm run test:smoke
npm run test:regression
npm start
```

The build and smoke tests should pass on the starter. Regression tests intentionally
fail: they describe required behavior. `npm test` runs both suites. Keep the supplied
tests and acceptance criteria; add your own tests for missing cases. If a test seems
incorrect, document why and discuss it rather than weakening an assertion.

The server listens on `http://127.0.0.1:3000` by default; `PORT` overrides the port.
Restarting it resets the in-memory fixtures. Each test gets an isolated application.

## Fixtures and authentication

Every route requires a demo bearer token. The guard derives tenant identity from the
token; the client must never choose its tenant through a body or header override.
These tokens and the in-memory storage are exam fixtures, not production security.

| Token | Tenant | Item | Initial availability |
| --- | --- | --- | ---: |
| `demo-alpha` | `alpha` | `desk` | 3 |
| `demo-alpha` | `alpha` | `room` | 2 |
| `demo-beta` | `beta` | `desk` | 10 |
| `demo-beta` | `beta` | `beta-only` | 4 |

## API contract to preserve

| Route | Success | Behavior |
| --- | --- | --- |
| `POST /reservations` | 201 | Create a reservation or replay a completed request. Requires `Idempotency-Key`. |
| `GET /reservations` | 200 | Return an array of the authenticated tenant's reservations. |
| `GET /reservations/:id` | 200 | Read an owned reservation; unknown or foreign IDs return 404. |
| `GET /inventory/:itemId` | 200 | Return `{ tenantId, itemId, available }` for the authenticated tenant; unknown/foreign items return 404. |

POST body: `{ "itemId": "desk", "quantity": 1 }`. Successful response:

```json
{
  "id": "generated-id",
  "tenantId": "alpha",
  "itemId": "desk",
  "quantity": 1,
  "idempotencyKey": "booking-001"
}
```

Rules:

1. `quantity` must be a JSON number that is a positive safe integer. Strings, zero,
   negatives, fractions, null, missing values, and unsafe integers return 400.
2. `itemId` must be a string of 1-64 characters matching `[A-Za-z0-9_-]+`.
   `Idempotency-Key` must be 1-64 characters with the same pattern. Missing, blank,
   or malformed keys return 400. Unknown body properties return 400. Do not silently
   coerce or trim invalid inputs. Validate before any state mutation or replay.
3. Missing or unrecognized bearer tokens return 401. Body fields or `X-Tenant-Id`
   must never override the authenticated identity.
4. If stock is insufficient, return 409 with no stock or reservation change.
   Stock must never become negative, and the sum of committed quantities must agree
   with the stock deduction, including under concurrent requests.
5. A tenant's successful key plus identical `{ itemId, quantity }` returns the
   original reservation, including its ID, without another deduction. Concurrent
   identical retries must also produce one reservation and one deduction.
6. Reusing a successful key with a different item or quantity returns 409, with no
   additional mutation. Keys are scoped to the tenant, across that tenant's items.
   Two tenants may use the same key independently.
7. Stock deduction and reservation persistence must succeed or fail together.
   Storage failures return 500, leave no partial mutation, and do not poison the key:
   retrying after the failure may succeed. Failed requests do not consume a key.
8. Reads must never reveal another tenant's reservations or inventory. A foreign
   reservation ID returns the same 404 behavior as an unknown ID.

Error response wording is your choice; status codes and state guarantees are required.

## Try the incident

With the app running, this portable Node command sends two competing requests for
two desks each. Correct behavior is one 201 and one 409, with one desk remaining.
On the starter, both may succeed. Restart before a fresh manual reproduction.

```sh
node scripts/reproduce.mjs
```

You can also create a reservation as Alpha and attempt to retrieve its returned ID
as Beta. The correct response is 404. The supplied tests cover selected symptoms;
passing only those tests is not a complete solution.

## Scope and constraints

- Repair the existing NestJS app. Keep route names, success shapes, auth fixtures,
  and status contracts. You may refactor services, providers, storage APIs, and DTOs.
- Implement correct behavior for **one running Node process** with in-memory data.
  A process-local lock is acceptable if justified. Do not claim that it protects
  multiple instances or survives restarts. Discuss the durable production design
  in your submission; implementing PostgreSQL or Redis is not required.
- Storage methods deliberately yield to simulate I/O. Preserve an asynchronous
  storage boundary so the fix addresses concurrency instead of removing the yield.
- The storage adapter exposes `failNextReservationWrite()` for failure tests. Keep
  an equivalent test-only failure mechanism; do not expose a debug HTTP endpoint.
- Do not hard-code fixture-specific answers, disable authentication, skip tests,
  or replace the application with a new project. No UI or deployment is needed.
- Prioritize correctness and maintainability. Extra frameworks, endpoints, and
  speculative features earn no extra credit.

## What to submit

Submit your changed source, added tests, and completed `SUBMISSION.md` through the
interviewer's agreed channel. Include the lockfile if dependencies change. Exclude
`node_modules`, build output, credentials, and private/company data.

Your submission must include:

- A reproduction and root-cause explanation for each problem you fixed.
- The chosen fix, alternatives considered, and why you chose it.
- Commands and results for build/tests, including any known failures.
- Remaining limitations and a specific plan for multiple API instances and durable
  storage, with consistency guarantees explained.
- A short AI-use log: what you asked it to do, what you accepted/rejected, and how
  you verified its output. Write `None` if you did not use AI.

## Technical defense

Be ready to trace one request through the NestJS lifecycle, show the original
failure and a regression test, explain how overlapping requests are ordered,
defend your atomicity and tenant boundaries, compare alternatives, and make a
small change with a test. The interviewer will ask about your actual diff. During
the ten-minute live change, drive without AI; normal documentation is allowed.

Evaluation considers correctness (35%), meaningful regression tests (20%), design
and trade-offs (15%), and your technical defense (30%). A polished submission is
not sufficient if you cannot explain or adapt it. Honest limitations and partial
progress are more useful than unsupported claims.

## Reference documentation

- [NestJS testing](https://docs.nestjs.com/fundamentals/testing)
- [NestJS 11 validation](https://docs.nestjs.com/v11/techniques/validation)

This assessment deliberately remains on NestJS 11; a framework upgrade is not part
of the task. References are optional and are not a prescribed solution.
