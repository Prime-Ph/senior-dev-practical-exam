CREATE TABLE IF NOT EXISTS exam_meta (
  key text PRIMARY KEY,
  value text NOT NULL
);
INSERT INTO exam_meta (key, value) VALUES ('fixture', 'senior-dev-practical-exam-three-items')
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS agents (
  tenant_id text NOT NULL,
  id integer NOT NULL,
  name text NOT NULL,
  PRIMARY KEY (tenant_id, id)
);
CREATE TABLE IF NOT EXISTS listings (
  id integer PRIMARY KEY,
  tenant_id text NOT NULL,
  agent_id integer NOT NULL,
  title text NOT NULL,
  price_cents integer NOT NULL CHECK (price_cents >= 0),
  FOREIGN KEY (tenant_id, agent_id) REFERENCES agents (tenant_id, id)
);
CREATE INDEX IF NOT EXISTS listings_tenant_id_idx ON listings (tenant_id, id);
CREATE TABLE IF NOT EXISTS inquiries (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  listing_id integer NOT NULL REFERENCES listings (id),
  tenant_id text NOT NULL,
  user_id text NOT NULL,
  message text NOT NULL
);
