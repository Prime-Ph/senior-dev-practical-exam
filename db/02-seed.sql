BEGIN;
TRUNCATE inquiries, listings, agents RESTART IDENTITY;
INSERT INTO agents (tenant_id, id, name) VALUES
  ('alpha', 1, 'Alex'), ('alpha', 2, 'Sam'), ('alpha', 3, 'Jordan'),
  ('beta', 1, 'Taylor');
INSERT INTO listings (id, tenant_id, agent_id, title, price_cents)
SELECT n, 'alpha', ((n - 1) % 3) + 1, 'Alpha Office ' || n, 10000000 + n * 100000
FROM generate_series(1, 30) AS n;
INSERT INTO listings (id, tenant_id, agent_id, title, price_cents)
SELECT 100 + n, 'beta', 1, 'Beta Office ' || n, 20000000 + n * 100000
FROM generate_series(1, 10) AS n;
COMMIT;
