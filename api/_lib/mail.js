const { Resend } = require("resend");

async function sendMagicLink(email, url) {
  const resend = new Resend(process.env.RESEND_API_KEY);
  const from = process.env.MAIL_FROM || "HPP-Training <onboarding@resend.dev>";
  await resend.emails.send({
    from,
    to: email,
    subject: "Dein Anmelde-Link für HPP-Prüfungstraining",
    html:
      "<p>Hier ist dein Anmelde-Link (15 Minuten gültig):</p>" +
      '<p><a href="' + url + '">Jetzt anmelden</a></p>' +
      "<p>Falls du das nicht angefordert hast, ignoriere diese Mail.</p>",
  });
}

module.exports = { sendMagicLink };
