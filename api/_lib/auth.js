const crypto = require("crypto");

function tokenErzeugen() {
  return crypto.randomBytes(32).toString("hex");
}

function hashToken(roh) {
  return crypto.createHash("sha256").update(String(roh)).digest("hex");
}

function zugangAktiv(kind, activeUntil, now) {
  if (kind === "lifetime") return true;
  if (kind === "abo" && activeUntil) {
    return new Date(activeUntil).getTime() > new Date(now).getTime();
  }
  return false;
}

function magicLinkGueltig(eintrag, now) {
  if (!eintrag || eintrag.used_at) return false;
  return new Date(eintrag.expires_at).getTime() > new Date(now).getTime();
}

module.exports = { tokenErzeugen, hashToken, zugangAktiv, magicLinkGueltig };
