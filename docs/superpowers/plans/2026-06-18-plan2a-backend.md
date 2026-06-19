# Plan 2a: Backend — Identität, Magic-Link & Entitlement (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ein minimales Backend auf Vercel (Neon Postgres + Resend) bereitstellen, das Magic-Link-Login, opake DB-Sessions und eine Entitlement-Prüfung liefert; Entitlements werden über einen geschützten Admin-Grant gesetzt (Stripe folgt in Plan 3).

**Architecture:** Vercel Serverless Functions unter `api/`. Reine, getestete Helfer in `api/_lib/` (Hashing, Zugangs-/Link-Logik, HTTP-Parsing). Datenzugriff über `@neondatabase/serverless`, Mailversand über `resend`. Token (Magic-Link + Session) werden nur als SHA-256-Hash gespeichert. Diese Spec deckt nur das Backend ab — die Frontend-Integration ist Plan 2b.

**Tech Stack:** Node.js (CommonJS), Vercel Functions, Neon Postgres, Resend, `node:test`.

**Spec:** `docs/superpowers/specs/2026-06-18-backend-entitlement-design.md`.

## Global Constraints

- **CommonJS überall** — KEIN `"type":"module"` in `package.json` (sonst brechen die bestehenden
  `app/*.test.js`, die `require` nutzen). Alle neuen Dateien nutzen `require`/`module.exports`.
- **Vercel-Function-Signatur (CJS):** `module.exports = async (req, res) => { … }`. Lesen:
  `req.method`, `req.query.<name>` (GET), `req.body` (von Vercel als JSON geparst bei
  `Content-Type: application/json`), `req.headers.authorization`. Antworten: `res.status(n).json(obj)`
  bzw. `res.setHeader(...)` + `res.status(n).send(html)`.
- **`api/_lib/`** (Unterstrich-Präfix) wird von Vercel NICHT als Route exponiert — dort liegt
  geteilter Code, keine Endpunkte.
- **Token nur als Hash at-rest.** Roh-Token nie in die DB.
- **`POST /api/auth/request` antwortet immer `200 {ok:true}`** (keine E-Mail-Enumeration).
- **Tests:** reine Helfer mit `node:test`. DB-/Mail-Module und Handler werden per `vercel dev` + curl
  verifiziert (brauchen `.env` + Konten — siehe Task 1).
- **Secrets** nur über `.env` (gitignored) / Vercel-Env, nie im Repo.

---

## Task 1: Projekt-Setup, Dependencies & externe Dienste

**Files:**
- Create: `package.json`
- Create: `.env.example`
- Create: `api/_lib/schema.sql`
- Modify: `.gitignore`
- Modify: `vercel.json`

**Interfaces:**
- Produces: lauffähiges `npm install`, dokumentierte Env-Variablen, eingespieltes Neon-Schema.

> ⚠️ **USER-ACTION (Blocker, kann der Agent nicht erledigen):** Vor den Endpoint-Tasks muss der
> Nutzer (a) ein **Neon**-Projekt anlegen und die `DATABASE_URL` holen, (b) ein **Resend**-Konto +
> API-Key anlegen, (c) das Schema aus `api/_lib/schema.sql` gegen Neon einspielen (Neon SQL-Editor
> oder `psql "$DATABASE_URL" -f api/_lib/schema.sql`), (d) eine lokale `.env` nach `.env.example`
> befüllen. Die Tasks 2–3 (reine Helfer) laufen ohne das; ab Task 4 ist es nötig.

- [ ] **Step 1: `package.json` anlegen**

```json
{
  "name": "hpp-app",
  "version": "1.0.0",
  "private": true,
  "description": "HPP-Prüfungstraining",
  "scripts": {
    "test": "node --test app/*.test.js api/_lib/*.test.js"
  },
  "engines": { "node": ">=18" },
  "dependencies": {
    "@neondatabase/serverless": "^1.1.0",
    "resend": "^6.14.0"
  }
}
```

(Kein `"type"`-Feld → CommonJS bleibt Default.)

- [ ] **Step 2: `.gitignore` ergänzen**

Ans Ende von `.gitignore` anhängen:

```
# Node / Backend
node_modules/
.env
.env*.local
.vercel
```

- [ ] **Step 3: `.env.example` anlegen**

```
DATABASE_URL=postgres://USER:PASS@HOST/neondb?sslmode=require
RESEND_API_KEY=re_xxxxxxxx
MAIL_FROM=HPP-Training <onboarding@resend.dev>
ADMIN_SECRET=ein-langer-zufaelliger-wert
APP_URL=http://localhost:3000
```

- [ ] **Step 4: `api/_lib/schema.sql` anlegen**

```sql
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
```

- [ ] **Step 5: `vercel.json` anpassen — Dependency-Installation aktivieren**

Ersetze die Zeile `"installCommand": null,` durch `"installCommand": "npm install",` (sonst installiert
Vercel die Function-Dependencies nicht). Die übrigen Felder bleiben.

- [ ] **Step 6: Install + bestehende Tests prüfen**

Run: `npm install`
Expected: Dependencies installiert, `node_modules/` erstellt (gitignored).
Run: `npm test`
Expected: alle bestehenden Tests (app/) grün; noch keine api/-Tests vorhanden.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json .gitignore .env.example api/_lib/schema.sql vercel.json
git commit -m "chore(backend): Projekt-Setup — package.json, deps, schema.sql, env-Vorlage"
```

---

## Task 2: Reine Auth-Helfer `api/_lib/auth.js`

**Files:**
- Create: `api/_lib/auth.js`
- Test: `api/_lib/auth.test.js`

**Interfaces:**
- Produces:
  - `tokenErzeugen()` → string (64 Hex-Zeichen, kryptografisch zufällig)
  - `hashToken(roh)` → string (SHA-256 Hex von `roh`)
  - `zugangAktiv(kind, activeUntil, now)` → bool (`lifetime` immer true; `abo` true wenn
    `activeUntil` in der Zukunft; sonst false). `now`/`activeUntil` als ISO-String oder Date.
  - `magicLinkGueltig(eintrag, now)` → bool (eintrag existiert, `used_at` leer, `expires_at` in Zukunft)

- [ ] **Step 1: Failing tests schreiben** — `api/_lib/auth.test.js`

```js
const test = require("node:test");
const assert = require("node:assert");
const A = require("./auth.js");

test("tokenErzeugen: 64 Hex-Zeichen, unterschiedlich", () => {
  const a = A.tokenErzeugen(), b = A.tokenErzeugen();
  assert.match(a, /^[0-9a-f]{64}$/);
  assert.notStrictEqual(a, b);
});

test("hashToken: deterministisch, != Rohwert", () => {
  assert.strictEqual(A.hashToken("abc"), A.hashToken("abc"));
  assert.notStrictEqual(A.hashToken("abc"), "abc");
  assert.match(A.hashToken("abc"), /^[0-9a-f]{64}$/);
});

test("zugangAktiv: lifetime immer true", () => {
  assert.strictEqual(A.zugangAktiv("lifetime", null, "2026-06-18T00:00:00Z"), true);
});

test("zugangAktiv: abo abhängig von activeUntil", () => {
  assert.strictEqual(A.zugangAktiv("abo", "2026-07-01T00:00:00Z", "2026-06-18T00:00:00Z"), true);
  assert.strictEqual(A.zugangAktiv("abo", "2026-06-01T00:00:00Z", "2026-06-18T00:00:00Z"), false);
  assert.strictEqual(A.zugangAktiv("abo", null, "2026-06-18T00:00:00Z"), false);
});

test("magicLinkGueltig: nur gültig wenn unbenutzt und nicht abgelaufen", () => {
  const now = "2026-06-18T00:00:00Z";
  assert.strictEqual(A.magicLinkGueltig({ used_at: null, expires_at: "2026-06-18T00:10:00Z" }, now), true);
  assert.strictEqual(A.magicLinkGueltig({ used_at: "2026-06-18T00:05:00Z", expires_at: "2026-06-18T00:10:00Z" }, now), false);
  assert.strictEqual(A.magicLinkGueltig({ used_at: null, expires_at: "2026-06-17T23:50:00Z" }, now), false);
  assert.strictEqual(A.magicLinkGueltig(null, now), false);
});
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `node --test api/_lib/auth.test.js`
Expected: FAIL — `Cannot find module './auth.js'`.

- [ ] **Step 3: `api/_lib/auth.js` implementieren**

```js
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
```

- [ ] **Step 4: Test laufen lassen, Erfolg bestätigen**

Run: `node --test api/_lib/auth.test.js`
Expected: PASS — alle 5 Tests grün.

- [ ] **Step 5: Commit**

```bash
git add api/_lib/auth.js api/_lib/auth.test.js
git commit -m "feat(backend): reine Auth-Helfer (Token, Hash, Zugang, Magic-Link-Gültigkeit)"
```

---

## Task 3: HTTP-Helfer `api/_lib/http.js`

**Files:**
- Create: `api/_lib/http.js`
- Test: `api/_lib/http.test.js`

**Interfaces:**
- Produces:
  - `getBearerToken(authHeader)` → string|null (extrahiert Token aus `Bearer <token>`, case-insensitiv)
  - `istEmail(s)` → bool (einfache, robuste E-Mail-Plausibilität)

- [ ] **Step 1: Failing tests schreiben** — `api/_lib/http.test.js`

```js
const test = require("node:test");
const assert = require("node:assert");
const H = require("./http.js");

test("getBearerToken: extrahiert Token, sonst null", () => {
  assert.strictEqual(H.getBearerToken("Bearer abc123"), "abc123");
  assert.strictEqual(H.getBearerToken("bearer abc123"), "abc123");
  assert.strictEqual(H.getBearerToken("Token abc"), null);
  assert.strictEqual(H.getBearerToken(""), null);
  assert.strictEqual(H.getBearerToken(undefined), null);
});

test("istEmail: einfache Plausibilität", () => {
  assert.strictEqual(H.istEmail("a@b.de"), true);
  assert.strictEqual(H.istEmail("kein-email"), false);
  assert.strictEqual(H.istEmail("a@b"), false);
  assert.strictEqual(H.istEmail(""), false);
  assert.strictEqual(H.istEmail(null), false);
});
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `node --test api/_lib/http.test.js`
Expected: FAIL — `Cannot find module './http.js'`.

- [ ] **Step 3: `api/_lib/http.js` implementieren**

```js
function getBearerToken(authHeader) {
  if (!authHeader || typeof authHeader !== "string") return null;
  const m = authHeader.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

function istEmail(s) {
  return typeof s === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

module.exports = { getBearerToken, istEmail };
```

- [ ] **Step 4: Test laufen lassen, Erfolg bestätigen**

Run: `node --test api/_lib/http.test.js`
Expected: PASS — beide Tests grün.

- [ ] **Step 5: Commit**

```bash
git add api/_lib/http.js api/_lib/http.test.js
git commit -m "feat(backend): HTTP-Helfer (Bearer-Token, E-Mail-Plausibilität)"
```

---

## Task 4: DB-Modul `api/_lib/db.js`

**Files:**
- Create: `api/_lib/db.js`

**Interfaces:**
- Consumes: `process.env.DATABASE_URL`.
- Produces (alle async, geben DB-Rows/void zurück):
  - `getEntitlement(email)` → `{email, kind, active_until}` | null
  - `upsertEntitlement(email, kind, activeUntil)` → void
  - `createMagicLink(tokenHash, email, expiresAt)` → void
  - `getMagicLink(tokenHash)` → `{token_hash, email, expires_at, used_at}` | null
  - `useMagicLink(tokenHash)` → void
  - `createSession(tokenHash, email)` → void
  - `getSession(tokenHash)` → `{token_hash, email}` | null
  - `touchSession(tokenHash)` → void
  - `deleteSession(tokenHash)` → void

> Voraussetzung ab hier: Task-1-USER-ACTION erledigt (Neon-Schema eingespielt, `.env` mit
> `DATABASE_URL`). Dieses Modul wird nicht per `node:test` getestet (echte DB nötig), sondern in
> Step 2 per Connectivity-Smoke verifiziert.

- [ ] **Step 1: `api/_lib/db.js` implementieren**

```js
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
  await sql`UPDATE magic_links SET used_at = now() WHERE token_hash = ${tokenHash} AND used_at IS NULL`;
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
```

- [ ] **Step 2: Connectivity-Smoke gegen Neon**

Run (lädt `.env` und prüft Verbindung + Schema):
```bash
node -e 'require("dotenv/config"); const {sql}=require("./api/_lib/db.js"); sql`SELECT count(*) AS n FROM entitlements`.then(r=>{console.log("OK",r[0]);process.exit(0)}).catch(e=>{console.error("FAIL",e.message);process.exit(1)})' 2>/dev/null || node --env-file=.env -e 'const {sql}=require("./api/_lib/db.js"); sql`SELECT count(*) AS n FROM entitlements`.then(r=>{console.log("OK",r[0]);process.exit(0)}).catch(e=>{console.error("FAIL",e.message);process.exit(1)})'
```
Expected: `OK { n: '0' }` (Node ≥20 unterstützt `--env-file=.env` ohne Zusatzpaket). Schlägt es mit
„relation … does not exist" fehl → Schema noch nicht eingespielt (Task-1-USER-ACTION nachholen).

- [ ] **Step 3: Commit**

```bash
git add api/_lib/db.js
git commit -m "feat(backend): Neon-DB-Modul (Entitlements, Magic-Links, Sessions)"
```

---

## Task 5: Mail-Modul `api/_lib/mail.js`

**Files:**
- Create: `api/_lib/mail.js`

**Interfaces:**
- Consumes: `process.env.RESEND_API_KEY`, `process.env.MAIL_FROM`.
- Produces: `sendMagicLink(email, url)` → Promise<void> (verschickt die Anmelde-Mail).

- [ ] **Step 1: `api/_lib/mail.js` implementieren**

```js
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
```

- [ ] **Step 2: Test-Versand verifizieren**

Run (an die EIGENE bei Resend verifizierte Adresse — Test-Domain kann nur dorthin senden):
```bash
node --env-file=.env -e 'require("./api/_lib/mail.js").sendMagicLink("DEINE@EMAIL.de","https://example.com/test").then(()=>{console.log("SENT");process.exit(0)}).catch(e=>{console.error("FAIL",e.message);process.exit(1)})'
```
Expected: `SENT`, und die Mail trifft im Postfach ein. (Bei „You can only send testing emails to your
own email address" → an die Resend-Account-Adresse senden bzw. Domain verifizieren.)

- [ ] **Step 3: Commit**

```bash
git add api/_lib/mail.js
git commit -m "feat(backend): Resend-Mailmodul (Magic-Link-Versand)"
```

---

## Task 6: Endpoint `POST /api/auth/request`

**Files:**
- Create: `api/auth/request.js`

**Interfaces:**
- Consumes: `istEmail` (http.js), `tokenErzeugen`/`hashToken` (auth.js), `createMagicLink` (db.js),
  `sendMagicLink` (mail.js), `process.env.APP_URL`.
- Produces: Route `POST /api/auth/request`, Body `{email}`, Antwort immer `200 {ok:true}`.

- [ ] **Step 1: `api/auth/request.js` implementieren**

```js
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
```

- [ ] **Step 2: Lokal verifizieren (vercel dev + curl)**

In Terminal A: `vercel dev` (lädt `.env`, serviert auf `http://localhost:3000`).
In Terminal B:
```bash
curl -s -X POST http://localhost:3000/api/auth/request -H "Content-Type: application/json" -d '{"email":"DEINE@EMAIL.de"}'
curl -s -X POST http://localhost:3000/api/auth/request -H "Content-Type: application/json" -d '{"email":"keine-email"}'
```
Expected: erste Antwort `{"ok":true}` + Mail kommt an + neue Zeile in `magic_links`; zweite Antwort
`{"error":"email"}` (400). Token-Wert aus der Mail/`magic_links` für Task 7 merken.

- [ ] **Step 3: Commit**

```bash
git add api/auth/request.js
git commit -m "feat(backend): POST /api/auth/request — Magic-Link anfordern"
```

---

## Task 7: Endpoint `GET /api/auth/verify`

**Files:**
- Create: `api/auth/verify.js`

**Interfaces:**
- Consumes: `hashToken`/`tokenErzeugen`/`magicLinkGueltig` (auth.js), `getMagicLink`/`useMagicLink`/
  `createSession` (db.js).
- Produces: Route `GET /api/auth/verify?token=…`; liefert HTML, schreibt bei Erfolg
  `localStorage['hpp_session']` und leitet auf `/` weiter.

- [ ] **Step 1: `api/auth/verify.js` implementieren**

```js
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
```

- [ ] **Step 2: Lokal verifizieren**

Mit dem Token aus Task 6 (gültig, unbenutzt):
```bash
curl -s "http://localhost:3000/api/auth/verify?token=<ROH_TOKEN>" | grep -o "hpp_session"
curl -s "http://localhost:3000/api/auth/verify?token=<ROH_TOKEN>" | grep -o "abgelaufen oder ungültig"
```
Expected: erster Aufruf enthält `hpp_session` (Session angelegt, `magic_links.used_at` gesetzt, neue
`sessions`-Zeile); zweiter Aufruf (Token jetzt benutzt) zeigt „abgelaufen oder ungültig". Im Browser
`http://localhost:3000/api/auth/verify?token=<NEUER_TOKEN>` öffnen → landet auf `/`, `hpp_session`
liegt in localStorage.

- [ ] **Step 3: Commit**

```bash
git add api/auth/verify.js
git commit -m "feat(backend): GET /api/auth/verify — Session anlegen, Token via Mini-HTML"
```

---

## Task 8: Endpoint `GET /api/entitlement`

**Files:**
- Create: `api/entitlement.js`

**Interfaces:**
- Consumes: `getBearerToken` (http.js), `hashToken`/`zugangAktiv` (auth.js), `getSession`/
  `touchSession`/`getEntitlement` (db.js).
- Produces: Route `GET /api/entitlement`; Header `Authorization: Bearer <session>`; Antwort
  `{hatZugang, kind, activeUntil}`.

- [ ] **Step 1: `api/entitlement.js` implementieren**

```js
const { getBearerToken } = require("./_lib/http.js");
const { hashToken, zugangAktiv } = require("./_lib/auth.js");
const { getSession, touchSession, getEntitlement } = require("./_lib/db.js");

const KEIN = { hatZugang: false, kind: null, activeUntil: null };

module.exports = async (req, res) => {
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
```

- [ ] **Step 2: Lokal verifizieren**

Mit dem `hpp_session`-Token aus Task 7 (Session ist gültig, aber noch KEIN Entitlement):
```bash
curl -s http://localhost:3000/api/entitlement -H "Authorization: Bearer <SESSION_TOKEN>"
curl -s http://localhost:3000/api/entitlement
```
Expected: beide `{"hatZugang":false,"kind":null,"activeUntil":null}` (Session ohne Entitlement bzw.
ohne Token). Nach Task 9 (Admin-Grant) wird derselbe erste Aufruf `hatZugang:true` liefern.

- [ ] **Step 3: Commit**

```bash
git add api/entitlement.js
git commit -m "feat(backend): GET /api/entitlement — Zugang per Session prüfen"
```

---

## Task 9: Endpoint `POST /api/admin/grant`

**Files:**
- Create: `api/admin/grant.js`

**Interfaces:**
- Consumes: `getBearerToken`/`istEmail` (http.js), `upsertEntitlement` (db.js),
  `process.env.ADMIN_SECRET`.
- Produces: Route `POST /api/admin/grant`; Header `Authorization: Bearer <ADMIN_SECRET>`; Body
  `{email, kind, activeUntil?}`.

- [ ] **Step 1: `api/admin/grant.js` implementieren**

```js
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
```

- [ ] **Step 2: Lokal verifizieren (End-to-End mit Entitlement)**

```bash
# falsches Secret -> 401
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/admin/grant -H "Authorization: Bearer falsch" -H "Content-Type: application/json" -d '{"email":"DEINE@EMAIL.de","kind":"lifetime"}'
# korrektes Secret -> Lifetime setzen
curl -s -X POST http://localhost:3000/api/admin/grant -H "Authorization: Bearer <ADMIN_SECRET aus .env>" -H "Content-Type: application/json" -d '{"email":"DEINE@EMAIL.de","kind":"lifetime"}'
# danach: dieselbe Session wie Task 8 hat jetzt Zugang
curl -s http://localhost:3000/api/entitlement -H "Authorization: Bearer <SESSION_TOKEN>"
```
Expected: `401`; dann `{"ok":true}`; dann `{"hatZugang":true,"kind":"lifetime","activeUntil":null}`.

- [ ] **Step 3: Commit**

```bash
git add api/admin/grant.js
git commit -m "feat(backend): POST /api/admin/grant — Entitlement setzen (geschützt)"
```

---

## Task 10: Endpoint `POST /api/auth/logout`

**Files:**
- Create: `api/auth/logout.js`

**Interfaces:**
- Consumes: `getBearerToken` (http.js), `hashToken` (auth.js), `deleteSession` (db.js).
- Produces: Route `POST /api/auth/logout`; Header `Authorization: Bearer <session>`; Antwort `{ok:true}`.

- [ ] **Step 1: `api/auth/logout.js` implementieren**

```js
const { getBearerToken } = require("../_lib/http.js");
const { hashToken } = require("../_lib/auth.js");
const { deleteSession } = require("../_lib/db.js");

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "method" });
  const token = getBearerToken(req.headers && req.headers.authorization);
  if (token) await deleteSession(hashToken(token));
  return res.status(200).json({ ok: true });
};
```

- [ ] **Step 2: Lokal verifizieren**

```bash
curl -s -X POST http://localhost:3000/api/auth/logout -H "Authorization: Bearer <SESSION_TOKEN>"
curl -s http://localhost:3000/api/entitlement -H "Authorization: Bearer <SESSION_TOKEN>"
```
Expected: erst `{"ok":true}`; danach `{"hatZugang":false,"kind":null,"activeUntil":null}` (Session
gelöscht → Zugang weg).

- [ ] **Step 3: Commit**

```bash
git add api/auth/logout.js
git commit -m "feat(backend): POST /api/auth/logout — Session löschen"
```

---

## Task 11: Produktion — Env setzen, deployen, Smoke-Test

**Files:** keine (Deploy + Verifikation)

> USER-ACTION: Die vier Env-Variablen in Vercel hinterlegen (Project → Settings → Environment
> Variables, Production): `DATABASE_URL`, `RESEND_API_KEY`, `ADMIN_SECRET`, `MAIL_FROM`. **`APP_URL`
> auf die Produktions-URL setzen** (`https://hpp-app-one.vercel.app`), NICHT localhost.

- [ ] **Step 1: Alle Unit-Tests grün**

Run: `npm test`
Expected: alle app/- und api/_lib/-Tests grün (Helfer; Handler sind integrationsgeprüft).

- [ ] **Step 2: Deploy**

Run: `vercel --prod --yes`
Expected: Deployment `READY`.

- [ ] **Step 3: Prod-Smoke**

```bash
curl -s -o /dev/null -w "request:    %{http_code}\n" -X POST https://hpp-app-one.vercel.app/api/auth/request -H "Content-Type: application/json" -d '{"email":"DEINE@EMAIL.de"}'
curl -s https://hpp-app-one.vercel.app/api/entitlement
```
Expected: `request: 200`; `/api/entitlement` ohne Token → `{"hatZugang":false,...}`. Optional die
ganze Kette (Mail → verify → grant → entitlement) einmal gegen Produktion durchspielen.

- [ ] **Step 4: Commit (falls noch offene Änderungen, sonst überspringen)**

Keine Code-Änderung in diesem Task; nichts zu committen. Plan 2a fertig.

---

## Self-Review (durchgeführt)

**1. Spec-Abdeckung** (`2026-06-18-backend-entitlement-design.md`):
- §2 Resend, opake DB-Sessions, dauerhafter Login → Tasks 5, 7 (Session-Token persistent in localStorage), 2 (`zugangAktiv`).
- §3 Datenmodell (3 Tabellen, Hash at-rest) → Task 1 `schema.sql`, Task 4 `db.js`, Task 2 `hashToken`.
- §4 fünf Endpunkte (request/verify/entitlement/grant/logout) → Tasks 6, 7, 8, 9, 10.
- §6 reine Helfer mit Tests → Tasks 2 (`auth.js`), 3 (`http.js`); `zugangAktiv` ist die anders
  benannte Server-Logik (≠ Frontend-`hatZugang`).
- §7 Secrets → Task 1 `.env.example`, Task 11 Vercel-Env.
- §8 Sicherheit (Hash, kurzlebige/einmalige Links, keine Enumeration, Admin-Secret) → Tasks 6 (immer
  200), 7 (`useMagicLink`+`magicLinkGueltig`), 9 (Secret-Check).
- §10 nur Backend (2a) → diese Spec. Frontend (2b), Stripe, Sync, Rechtstexte bewusst ausgeschlossen.
- §11 offene Punkte: TTL 15 Min (Task 6), Rate-Limit bewusst zurückgestellt (nicht in 2a — siehe Hinweis unten).

**2. Placeholder-Scan:** Keine TBD/TODO im Code. `<ROH_TOKEN>`/`<SESSION_TOKEN>`/`DEINE@EMAIL.de`
sind bewusste Laufzeit-Platzhalter in Verifikations-Kommandos (vom Ausführenden einzusetzen), kein
fehlender Plan-Inhalt.

**3. Typ-Konsistenz:** Helfer-Signaturen (`hashToken`, `zugangAktiv(kind, activeUntil, now)`,
`magicLinkGueltig(eintrag, now)`, `getBearerToken`, `istEmail`) sind in Tasks 2/3 definiert und in
Tasks 6–10 exakt so genutzt. DB-Funktionsnamen (Task 4) decken sich mit den Aufrufen in den Handlern.
localStorage-Schlüssel `hpp_session` konsistent (Task 7 schreibt, Plan 2b liest).

**Bewusste Auslassung (kein Spec-Verstoß):** Rate-Limit auf `/api/auth/request` ist in der Spec §11
als „wünschenswert/offen" markiert, nicht als Muss — in 2a zurückgestellt, in Plan 2b/3 nachrüstbar.
**Cleanup abgelaufener Links/Sessions** ist Lazy (Verify prüft Gültigkeit); periodisches Aufräumen
optional später.
