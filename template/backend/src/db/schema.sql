-- converge-app-template schema (PostgreSQL-Dialekt, Standard-Stack).
-- Aktiv wenn DB_DRIVER=postgres (Default). Das SQLite-Pendant für den
-- Single-Container-Stack ist schema.sqlite.sql — beide synchron halten.
-- Part of the @efa-one/sdk scaffold: do not remove app_users (SDK auth anchor) or example_items columns.
-- Add app-specific tables below the divider.

-- ─── Template tables (do not modify) ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS app_users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  converge_id   VARCHAR UNIQUE NOT NULL,   -- sub from Converge JWT
  email         VARCHAR,
  name          VARCHAR,
  created_at    TIMESTAMP DEFAULT NOW(),
  last_seen_at  TIMESTAMP
);

-- Example table showing the owner_id pattern.
-- Replace or extend with your app's actual data model.
CREATE TABLE IF NOT EXISTS example_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    UUID REFERENCES app_users(id) ON DELETE SET NULL,
  title       VARCHAR NOT NULL,
  created_at  TIMESTAMP DEFAULT NOW()
);

-- ─── App-specific tables (add below) ─────────────────────────────────────────
