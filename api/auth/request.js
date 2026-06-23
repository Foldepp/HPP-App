const { istEmail } = require("../_lib/http.js");
const { tokenErzeugen, hashToken } = require("../_lib/auth.js");
const { createMagicLink } = require("../_lib/db.js");
const { sendMagicLink } = require("../_lib/mail.js");

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "method" });
  const email = req.body && req.body.email;
  if (!istEmail(email)) return res.status(400).json({ error: "email" });

  const roh = tokenErzeugen();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  try {
    await createMagicLink(hashToken(roh), email, expiresAt);
    const url = process.env.APP_URL + "/api/auth/verify?token=" + roh;
    await sendMagicLink(email, url);
  } catch (e) {
    console.error("auth/request:", e.message); // bewusst geschluckt: keine Enumeration
  }
  return res.status(200).json({ ok: true });
};
