const { getBearerToken } = require("../_lib/http.js");
const { hashToken } = require("../_lib/auth.js");
const { deleteSession } = require("../_lib/db.js");

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "method" });
  const token = getBearerToken(req.headers && req.headers.authorization);
  if (token) await deleteSession(hashToken(token));
  return res.status(200).json({ ok: true });
};
