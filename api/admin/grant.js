const { getBearerToken, istEmail } = require("../_lib/http.js");
const { upsertEntitlement } = require("../_lib/db.js");

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "method" });
  const token = getBearerToken(req.headers && req.headers.authorization);
  if (!token || token !== process.env.ADMIN_SECRET) return res.status(401).json({ error: "auth" });

  const { email, kind, activeUntil } = req.body || {};
  if (!istEmail(email)) return res.status(400).json({ error: "email" });
  if (kind !== "abo" && kind !== "lifetime") return res.status(400).json({ error: "kind" });
  const au = kind === "abo" ? (activeUntil || null) : null;
  if (kind === "abo" && !au) return res.status(400).json({ error: "activeUntil" });

  await upsertEntitlement(email, kind, au);
  return res.status(200).json({ ok: true });
};
