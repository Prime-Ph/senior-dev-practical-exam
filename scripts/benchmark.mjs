import { createRequire } from 'node:module';
import { performance } from 'node:perf_hooks';
const require = createRequire(import.meta.url);
const { createApp } = require('../dist/create-app.js');
const { SharedStorageBackend } = require('../dist/storage/shared-storage.backend.js');

function integer(name, fallback, max) {
  const n = Number(process.env[name] ?? fallback);
  if (!Number.isSafeInteger(n) || n < 1 || n > max) throw new Error('Invalid ' + name);
  return n;
}
const count = integer('REQUESTS', 100, 10000);
const concurrency = integer('CONCURRENCY', 10, 100);
const history = integer('HISTORY', 10000, 100000);
const delay = integer('IO_DELAY_MS', 1, 100);
const summaries = [];

for (const instances of [1, 2]) {
  for (const mode of ['hot-item', 'independent-items', 'retry-burst']) {
    const backend = new SharedStorageBackend(delay);
    backend.seedHistoricalReservations(history, 'alpha');
    backend.seedHistoricalReservations(history, 'beta');
    for (const tenant of ['alpha', 'beta']) {
      for (const item of ['desk', 'room']) backend.setStockForFixture(tenant, item, count);
    }
    const apps = [];
    try {
      for (let i = 0; i < instances; i += 1) {
        const app = await createApp(backend);
        await app.listen(0, '127.0.0.1');
        apps.push(app);
      }
      const urls = await Promise.all(apps.map((app) => app.getUrl()));
      await Promise.all(urls.map((url) => fetch(url + '/inventory/desk', {
        headers: { Authorization: 'Bearer demo-alpha' },
      })));
      backend.resetMetrics();
      const latency = [];
      const statusCounts = {};
      const reservationIds = new Set();
      let next = 0;
      const start = performance.now();
      await Promise.all(Array.from({ length: concurrency }, async () => {
        while (next < count) {
          const i = next++;
          const url = urls[i % instances];
          const tenant = mode === 'independent-items' ? (i % 2 ? 'beta' : 'alpha') : 'alpha';
          const item = mode === 'independent-items' ? (Math.floor(i / 2) % 2 ? 'room' : 'desk') : 'desk';
          const read = mode !== 'retry-burst' && i % 5 === 0;
          const started = performance.now();
          try {
            const response = await fetch(url + (read ? '/reservations?limit=20' : '/reservations'), {
              method: read ? 'GET' : 'POST',
              headers: {
                Authorization: 'Bearer demo-' + tenant,
                'Content-Type': 'application/json',
                'Idempotency-Key': mode === 'retry-burst' ? 'burst' : 'load-' + i,
              },
              ...(read ? {} : { body: JSON.stringify({ itemId: item, quantity: 1 }) }),
              signal: AbortSignal.timeout(10000),
            });
            const body = await response.json();
            statusCounts[response.status] = (statusCounts[response.status] ?? 0) + 1;
            if (response.status === 201) reservationIds.add(body.id);
          } catch {
            statusCounts.transportError = (statusCounts.transportError ?? 0) + 1;
          }
          latency.push(performance.now() - started);
        }
      }));
      const elapsed = performance.now() - start;
      let remaining = 0;
      for (const tenant of ['alpha', 'beta']) {
        for (const item of ['desk', 'room']) remaining += (await backend.findStock(tenant, item)).available;
      }
      latency.sort((a, b) => a - b);
      const percentile = (p) => Math.round(latency[Math.max(0, Math.ceil(latency.length * p) - 1)] * 100) / 100;
      const stockConsumed = count * 4 - remaining;
      summaries.push({
        mode, instances, requests: count, concurrency, historyPerTenant: history, simulatedIoMs: delay,
        requestsPerSecond: Math.round(count * 1000 / elapsed),
        p50Ms: percentile(.5), p95Ms: percentile(.95), statusCounts,
        uniqueReservationIds: reservationIds.size, stockConsumed,
        ...backend.metrics,
        stockMatchesCommittedWrites: stockConsumed === backend.metrics.reservationWrites,
        ...(mode === 'retry-burst' ? { oneReservationForRetryBurst: reservationIds.size === 1 } : {}),
      });
    } finally {
      await Promise.all(apps.map((app) => app.close()));
    }
  }
}
console.log(JSON.stringify(summaries, null, 2));
console.log('Local simulated-storage benchmark. Compare the same settings before/after; no production SLA is implied.');
