const { neon } = require("@neondatabase/serverless");

const sql = neon(process.env.DATABASE_URL);

async function getEntitlement(email) {
  const rows = await sql`SELECT email, kind, active_until FROM entitlements WHERE email = ${email}`;
  return rows[0] || null;
}

async function upsertEntitlement(email, kind, activeUntil) {
  await sql`
    INSERT INTO entitlements (email, kind, active_until, updated_at)
    VALUES (${email}, ${kind}, ${activeUntil}, now())
    ON CONFLICT (email) DO UPDATE
      SET kind = EXCLUDED.kind, active_until = EXCLUDED.active_until, updated_at = now()`;
}

async function createMagicLink(tokenHash, email, expiresAt) {
  await sql`INSERT INTO magic_links (token_hash, email, expires_at) VALUES (${tokenHash}, ${email}, ${expiresAt})`;
}

async function getMagicLink(tokenHash) {
  const rows = await sql`SELECT token_hash, email, expires_at, used_at FROM magic_links WHERE token_hash = ${tokenHash}`;
  return rows[0] || null;
}

async function useMagicLink(tokenHash) {
  const rows = await sql`UPDATE magic_links SET used_at = now() WHERE token_hash = ${tokenHash} AND used_at IS NULL RETURNING token_hash`;
  return rows.length > 0;
}

async function createSession(tokenHash, email) {
  await sql`INSERT INTO sessions (token_hash, email) VALUES (${tokenHash}, ${email})`;
}

async function getSession(tokenHash) {
  const rows = await sql`SELECT token_hash, email FROM sessions WHERE token_hash = ${tokenHash}`;
  return rows[0] || null;
}

async function touchSession(tokenHash) {
  await sql`UPDATE sessions SET last_seen_at = now() WHERE token_hash = ${tokenHash}`;
}

async function deleteSession(tokenHash) {
  await sql`DELETE FROM sessions WHERE token_hash = ${tokenHash}`;
}

module.exports = {
  sql, getEntitlement, upsertEntitlement,
  createMagicLink, getMagicLink, useMagicLink,
  createSession, getSession, touchSession, deleteSession,
};
