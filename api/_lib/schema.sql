CREATE TABLE IF NOT EXISTS entitlements (
  email        text PRIMARY KEY,
  kind         text NOT NULL CHECK (kind IN ('abo','lifetime')),
  active_until timestamptz,
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS magic_links (
  token_hash text PRIMARY KEY,
  email      text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at    timestamptz
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash   text PRIMARY KEY,
  email        text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);
