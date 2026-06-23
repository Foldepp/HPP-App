const { hashToken, tokenErzeugen, magicLinkGueltig } = require("../_lib/auth.js");
const { getMagicLink, useMagicLink, createSession } = require("../_lib/db.js");

function htmlSeite(body) {
  return '<!doctype html><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<body style="font-family:system-ui;padding:2rem">' + body + "</body>";
}

module.exports = async (req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  const roh = req.query && req.query.token;
  if (!roh) return res.status(400).send(htmlSeite("<p>Ungültiger Link.</p>"));

  const eintrag = await getMagicLink(hashToken(roh));
  if (!magicLinkGueltig(eintrag, new Date())) {
    return res.status(400).send(htmlSeite('<p>Link abgelaufen oder ungültig. <a href="/">Zur App</a></p>'));
  }

  await useMagicLink(hashToken(roh));
  const session = tokenErzeugen();
  await createSession(hashToken(session), eintrag.email);

  const js = "try{localStorage.setItem('hpp_session'," + JSON.stringify(session) + ")}catch(e){};" +
    "location.replace('/')";
  return res.status(200).send(htmlSeite("<p>Angemeldet — weiter …</p><script>" + js + "</script>"));
};
