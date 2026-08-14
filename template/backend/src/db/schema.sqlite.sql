-- converge-app-template schema – SQLite-Dialekt (Single-Container-Stack).
-- Spiegelt schema.sql; aktiv wenn DB_DRIVER=sqlite. app_users nicht entfernen.
-- TEXT-IDs mit UUIDv4-Default (SQLite-DEFAULT erlaubt keine User-Funktionen,
-- daher der randomblob()-Ausdruck statt gen_random_uuid()).
-- Add app-specific tables below the divider.

-- ─── Template tables (do not modify) ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS app_users (
  id            TEXT PRIMARY KEY DEFAULT (
                  lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' ||
                  substr(lower(hex(randomblob(2))), 2) || '-' ||
                  substr('89ab', abs(random()) % 4 + 1, 1) ||
                  substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))
                ),
  converge_id   TEXT UNIQUE NOT NULL,   -- sub from Converge JWT
  email         TEXT,
  name          TEXT,
  created_at    TEXT DEFAULT CURRENT_TIMESTAMP,
  last_seen_at  TEXT
);

-- Example table showing the owner_id pattern.
-- Replace or extend with your app's actual data model.
CREATE TABLE IF NOT EXISTS example_items (
  id          TEXT PRIMARY KEY DEFAULT (
                lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' ||
                substr(lower(hex(randomblob(2))), 2) || '-' ||
                substr('89ab', abs(random()) % 4 + 1, 1) ||
                substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))
              ),
  owner_id    TEXT REFERENCES app_users(id) ON DELETE SET NULL,
  title       TEXT NOT NULL,
  created_at  TEXT DEFAULT CURRENT_TIMESTAMP
);

-- ─── App-specific tables (add below) ─────────────────────────────────────────
