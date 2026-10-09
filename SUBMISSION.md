# Candidate submission

Candidate:
Implementation time used:

## Diagnosis and changes

Identify the bottlenecks and cross-instance failures. Explain each fix, its
coordination/index boundary, a credible alternative, and the trade-off.

## Before/after evidence

Include build/test results and benchmark output with identical settings:
instances, requests, concurrency, history, simulated I/O, throughput, p50/p95,
statuses, row visits, committed writes, stock consistency, and replay IDs.

## Complexity and limits

Explain key lookup and page complexity, hot-key contention, lock ordering and
cleanup, index memory, retention, and the limits of the shared in-memory fixture.

## Production design

Outline database tables/indexes, tenant/key uniqueness, indexed pagination,
transaction/isolation rules, safe retries, connection limits, overload handling,
and the metrics you would monitor. No deployment or infrastructure is required.

## AI-use log

Tools, meaningful prompts/tasks, accepted or rejected suggestions, and independent
verification. Write `None` if unused.
