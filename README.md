# Senior NestJS Practical Exam

Fix three scalability issues in a small listing API:

1. Rate limiting on inquiry requests.
2. Caching listing summaries.
3. An N+1 query when loading listings and their agents.

**60-minute practical exam + 45-minute technical defense.** Complete setup before
starting the clock. Suggested pacing: 5 minutes to inspect, 15 per item, and
10 minutes to verify and write notes.

**AI is allowed.** Record meaningful assistance in `SUBMISSION.md`. You must
explain your code, evidence, trade-offs, and why you chose each approach.
During the defense's 10-minute live exercise, work without AI; documentation is allowed.

## Setup — outside the timed hour

Requirements: Node.js 22 or 24, npm, and Docker with Compose. The supplied
PostgreSQL container and schema are ready to use; database design is not a task.

```sh
npm ci
npm run db:up
npm run db:check
npm run build
npm run test:smoke
npm run test:tasks
npm run db:reset
npm start
```

The starter builds and passes all five smoke tests. Ten of the eleven task tests
intentionally fail; the independent-user/GET case within that suite already
passes. After your fixes, all 16 supplied tests should pass.

The API runs at `http://127.0.0.1:3000`; `PORT` overrides the port.
PostgreSQL is exposed on `127.0.0.1:55432`. Default local connection:

```text
postgresql://exam:exam_local_only@127.0.0.1:55432/practical_exam
```

`DATABASE_URL` can override it. Use only this exam database: tests and
`npm run db:reset` restore the seed and discard exam inquiries and price edits.
They check the exam database name and fixture marker before resetting.
Run tests serially; do not run them while manually changing the same database.

Docker initialization runs on first creation of the volume. Use
`npm run db:reset` to restore the seed. `npm run db:down` stops the container
and retains its data.

## The three items

### 1. Rate limiting

Implement `src/rate-limit/inquiry-rate-limit.service.ts`.

- Allow five authenticated `POST /inquiries` attempts per user per 60 seconds.
- Use a fixed window starting with that user's first attempt. Reset at expiry.
- The sixth attempt returns 429 with an integer `Retry-After` in seconds,
  rounded up to the remaining window. A blocked attempt performs no SQL.
- Users have separate quotas, including two users in the same tenant.
  GET requests and unauthenticated requests do not consume this quota.
- Authenticated attempts that fail body validation still count.
  The supplied guard runs before validation and is already wired to this service.
- Concurrent attempts must not exceed the quota.

Use the supplied `Clock` instead of waiting in tests. An in-memory limiter is
sufficient. Explain how your design would change with multiple API instances
during the defense; do not implement distributed infrastructure.

### 2. Cache

Implement `src/cache/summary-cache.ts`.

- Cache a successful `GET /summary` result by tenant for 30 seconds.
- Repeated requests within the TTL return the cached result without SQL.
  Hits do not extend the TTL.
- At expiry, load a fresh result. Do not cache failed loads.
- Invalidate only the affected tenant after a successful listing price update.
  The update service already calls `invalidate`; keep this wiring.
- Preserve tenant isolation and the existing response shape.

An in-memory cache is sufficient. Distributed caching, concurrent-miss
deduplication, and a general cache library are outside the required scope.

### 3. N+1 query

Fix `list` in `src/listings/listings.service.ts`.

- Return a page of listings and their agents using at most two SQL queries,
  independent of page size. A JOIN or batch load is acceptable.
- Preserve tenant isolation, ascending listing ID order, and the response shape.
  Agent IDs are unique within a tenant, so include tenant identity in lookups.
- Keep the default limit of 10 and the allowed range of 1–50.
- Use parameterized SQL and the supplied database query counter to show the
  before/after query count.

Do not change the schema or add pagination infrastructure. Discuss performance
at larger data volumes during the defense.

## API and seeded data

Use `Authorization: Bearer <token>`.

| Token | Tenant | User |
| --- | --- | --- |
| `demo-alpha` | alpha | alpha-user-1 |
| `demo-alpha-2` | alpha | alpha-user-2 |
| `demo-beta` | beta | beta-user-1 |

Alpha has 30 listings (IDs 1–30) and three agents. Beta has 10 listings
(IDs 101–110) and one agent. Both tenants have an agent with ID 1.

| Route | Request / response |
| --- | --- |
| `GET /listings?limit=10` | `[{ id, title, priceCents, agent: { id, name } }]` |
| `GET /summary` | `{ totalListings, averagePriceCents }` |
| `PATCH /listings/:id/price` | Body: `{ "priceCents": 20000000 }`; response: `{ id, priceCents }`. |
| `POST /inquiries` | Body: `{ "listingId": 1, "message": "Interested" }`; 201 with `{ id, listingId }`. |

Authentication, validation, and tenant-scoped writes already work. Preserve them.
Unknown or foreign listing IDs return 404. Invalid authentication returns 401;
invalid input or unknown body fields return 400, subject to the inquiry quota.

## Verify and submit

```sh
npm run build
npm test
```

Focused commands: `npm run test:smoke`, `npm run test:tasks`, or
`npm test -- --runTestsByPath test/cache.e2e-spec.ts`.
Tests use the real Docker database and a controllable clock.
`Database.metrics.queryCount` counts SQL calls; `resetMetrics()` resets it.
Keep the supplied assertions and accurate metrics. Add targeted tests when useful.

Submit your code and a concise `SUBMISSION.md`: each fix, why that approach,
before/after evidence, limitations, and AI use. No UI, deployment, load-test
framework, Redis setup, or framework upgrade is required.

Scoring: rate limiting 20%, cache 20%, N+1 query 20%, tests/evidence 10%,
technical defense 30%. A solution must be explainable and defensible.

References: [NestJS rate limiting](https://docs.nestjs.com/security/rate-limiting),
[NestJS caching](https://docs.nestjs.com/techniques/caching), and
[parameterized PostgreSQL queries](https://node-postgres.com/features/queries).
