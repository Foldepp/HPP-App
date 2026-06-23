const { getBearerToken } = require("./_lib/http.js");
const { hashToken, zugangAktiv } = require("./_lib/auth.js");
const { getSession, touchSession, getEntitlement } = require("./_lib/db.js");

const KEIN = { hatZugang: false, kind: null, activeUntil: null };

module.exports = async (req, res) => {
  if (req.method !== "GET") return res.status(405).json({ error: "method" });
  const token = getBearerToken(req.headers && req.headers.authorization);
  if (!token) return res.status(200).json(KEIN);

  const session = await getSession(hashToken(token));
  if (!session) return res.status(200).json(KEIN);
  await touchSession(hashToken(token));

  const ent = await getEntitlement(session.email);
  if (!ent) return res.status(200).json(KEIN);

  const aktiv = zugangAktiv(ent.kind, ent.active_until, new Date());
  return res.status(200).json({ hatZugang: aktiv, kind: ent.kind, activeUntil: ent.active_until });
};
