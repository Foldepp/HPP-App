# Plan 2b: Frontend-Integration — echtes Entitlement statt Stub (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Das Frontend an das Plan-2a-Backend anschließen — der Bezahl-Zugang kommt jetzt vom Server (Magic-Link-Login + Entitlement-Check) statt vom lokalen Stub, ohne die synchrone `hatZugang()`-Render-Schnittstelle zu brechen.

**Architecture:** `entitlement.js` wird async-fähig: `lade()` liefert weiter synchron den **gecachten** Serverstand (sofortiges Rendern, Free-Tier offline), `refresh()` holt den echten Stand per `GET /api/entitlement` und aktualisiert Cache + Anzeige. Die Paywall bekommt einen Magic-Link-Login (`POST /api/auth/request`) und Abmelden (`POST /api/auth/logout`); der Kauf-Button bleibt bis Plan 3 deaktiviert. Der Stub (`entsperreStub`) entfällt.

**Tech Stack:** Vanilla JS (UMD `entitlement.js`), `fetch`, `node:test`. Lokales Dev jetzt über `vercel dev` (serviert `app/` **und** `api/` auf einer Origin), nicht mehr `python -m http.server`.

**Spec:** `docs/superpowers/specs/2026-06-18-backend-entitlement-design.md` §5 (Frontend-Integration). Baut auf Plan 2a (Backend, auf `main`).

## Global Constraints

- **Synchrone Render-Schnittstelle bleibt:** `window.HPP_ENT.hatZugang(ent)` (boolean) und `app.js`-Helper `hatZugang()` bleiben unverändert nutzbar; nur die Datenquelle wird der Server-Cache.
- **Cache-Shape ändert sich** von `{aktiv}` (Plan 1) zu `{hatZugang, kind, activeUntil}`. localStorage-Schlüssel: `hpp_entitlement` (Cache), `hpp_session` (Session-Token).
- **Free-Tier ohne Netz/Login:** Ohne `hpp_session` wird **kein** API-Call gemacht; die App rendert nur aus dem Cache (Default = kein Zugang).
- **Alle API-Calls relativ** (`/api/...`, gleiche Origin).
- `entitlement.js` bleibt im Browser **und** unter `node:test` ladbar (UMD); async-Funktionen bekommen `fetchFn` injiziert (Testbarkeit ohne Browser).
- **Kein echtes Bezahlen** in 2b — Kauf-Button deaktiviert („kommt bald"); Zugang entsteht serverseitig (Plan-2a-Admin-Grant bzw. Plan-3-Stripe).
- Lokale Verifikation über `vercel dev` (lädt `.env`); Free-Tier-Schnelltest auch über `python3 -m http.server` möglich (dann sind API-Calls erwartbar 404 → Cache greift).

---

## Task 1: `entitlement.js` async umbauen + Tests neu

**Files:**
- Modify (Vollersatz): `app/entitlement.js`
- Modify (Vollersatz): `app/entitlement.test.js`

**Interfaces:**
- Produces:
  - `leererStand()` → `{hatZugang:false, kind:null, activeUntil:null}`
  - `hatZugang(ent)` → bool (liest `ent.hatZugang`)
  - `ladeSession(storage)` → string|null (`hpp_session`)
  - `lade(storage)` → gecachter Stand `{hatZugang,kind,activeUntil}` | leererStand
  - `speichere(storage, ent)` → void
  - `refresh(storage, fetchFn)` → Promise<stand> (ohne Session: leererStand cachen, kein Call; mit Session: `GET /api/entitlement` Bearer; Netzfehler: Cache behalten)
  - `anfordern(email, fetchFn)` → Promise<bool> (`POST /api/auth/request`)
  - `abmelden(storage, fetchFn)` → Promise<stand> (`POST /api/auth/logout`, dann Session+Cache löschen)
- Consumes: Endpunkte aus Plan 2a (`/api/entitlement`, `/api/auth/request`, `/api/auth/logout`).

- [ ] **Step 1: Tests neu schreiben (Vollersatz von `app/entitlement.test.js`)**

```js
const test = require("node:test");
const assert = require("node:assert");
const E = require("./entitlement.js");

function stubStore(init) {
  var m = Object.assign({}, init || {});
  return {
    getItem: function (k) { return k in m ? m[k] : null; },
    setItem: function (k, v) { m[k] = String(v); },
    removeItem: function (k) { delete m[k]; },
  };
}
function okFetch(body) {
  return function () { return Promise.resolve({ ok: true, json: function () { return Promise.resolve(body); } }); };
}

test("leererStand: kein Zugang, Felder null", () => {
  assert.deepStrictEqual(E.leererStand(), { hatZugang: false, kind: null, activeUntil: null });
});

test("hatZugang liest .hatZugang", () => {
  assert.strictEqual(E.hatZugang({ hatZugang: true }), true);
  assert.strictEqual(E.hatZugang({ hatZugang: false }), false);
  assert.strictEqual(E.hatZugang(null), false);
  assert.strictEqual(E.hatZugang(undefined), false);
});

test("lade: leer/kaputt -> leererStand; sonst Cache", () => {
  assert.deepStrictEqual(E.lade(stubStore()), { hatZugang: false, kind: null, activeUntil: null });
  var s = stubStore();
  E.speichere(s, { hatZugang: true, kind: "lifetime", activeUntil: null });
  assert.deepStrictEqual(E.lade(s), { hatZugang: true, kind: "lifetime", activeUntil: null });
  assert.deepStrictEqual(E.lade({ getItem: function () { return "kaputt{"; } }), E.leererStand());
});

test("refresh ohne Session -> leererStand gecacht, KEIN fetch", async () => {
  var s = stubStore();
  var called = false;
  var fetchFn = function () { called = true; return Promise.reject(new Error("should not be called")); };
  var stand = await E.refresh(s, fetchFn);
  assert.strictEqual(called, false);
  assert.deepStrictEqual(stand, E.leererStand());
  assert.deepStrictEqual(E.lade(s), E.leererStand());
});

test("refresh mit Session -> Serverstand gecacht", async () => {
  var s = stubStore({ hpp_session: "tok" });
  var stand = await E.refresh(s, okFetch({ hatZugang: true, kind: "lifetime", activeUntil: null }));
  assert.deepStrictEqual(stand, { hatZugang: true, kind: "lifetime", activeUntil: null });
  assert.deepStrictEqual(E.lade(s), stand);
});

test("refresh Netzfehler -> behält Cache", async () => {
  var s = stubStore({ hpp_session: "tok" });
  E.speichere(s, { hatZugang: true, kind: "lifetime", activeUntil: null });
  var stand = await E.refresh(s, function () { return Promise.reject(new Error("net")); });
  assert.strictEqual(stand.hatZugang, true);
});

test("anfordern: POST /api/auth/request mit email-Body", async () => {
  var captured = null;
  var fetchFn = function (url, opt) { captured = { url: url, opt: opt }; return Promise.resolve({ ok: true, json: function () { return Promise.resolve({ ok: true }); } }); };
  var ok = await E.anfordern("a@b.de", fetchFn);
  assert.strictEqual(ok, true);
  assert.strictEqual(captured.url, "/api/auth/request");
  assert.strictEqual(captured.opt.method, "POST");
  assert.deepStrictEqual(JSON.parse(captured.opt.body), { email: "a@b.de" });
});

test("abmelden: ruft logout, löscht Session + Cache", async () => {
  var s = stubStore({ hpp_session: "tok" });
  E.speichere(s, { hatZugang: true, kind: "lifetime", activeUntil: null });
  var captured = null;
  var fetchFn = function (url, opt) { captured = { url: url, opt: opt }; return Promise.resolve({ ok: true, json: function () { return Promise.resolve({ ok: true }); } }); };
  var stand = await E.abmelden(s, fetchFn);
  assert.strictEqual(captured.url, "/api/auth/logout");
  assert.strictEqual(s.getItem("hpp_session"), null);
  assert.deepStrictEqual(stand, E.leererStand());
  assert.deepStrictEqual(E.lade(s), E.leererStand());
});
```

- [ ] **Step 2: Tests laufen lassen, Fehlschlag bestätigen**

Run: `node --test app/entitlement.test.js`
Expected: FAIL (alte API: `leererStand` liefert noch `{aktiv:false}`, `refresh`/`anfordern`/`abmelden`/`ladeSession` existieren nicht).

- [ ] **Step 3: `app/entitlement.js` ersetzen (Vollersatz)**

```js
(function (root) {
  "use strict";

  var SESSION_KEY = "hpp_session";
  var CACHE_KEY = "hpp_entitlement";

  function leererStand() { return { hatZugang: false, kind: null, activeUntil: null }; }
  function hatZugang(ent) { return !!(ent && ent.hatZugang); }

  function ladeSession(storage) {
    try { return storage.getItem(SESSION_KEY) || null; } catch (e) { return null; }
  }

  function lade(storage) {
    try {
      var roh = JSON.parse(storage.getItem(CACHE_KEY));
      if (roh && typeof roh.hatZugang === "boolean") return roh;
    } catch (e) {}
    return leererStand();
  }

  function speichere(storage, ent) {
    try { storage.setItem(CACHE_KEY, JSON.stringify(ent)); } catch (e) {}
  }

  async function refresh(storage, fetchFn) {
    var token = ladeSession(storage);
    if (!token) { var leer = leererStand(); speichere(storage, leer); return leer; }
    try {
      var res = await fetchFn("/api/entitlement", { headers: { Authorization: "Bearer " + token } });
      var data = await res.json();
      var stand = {
        hatZugang: !!data.hatZugang,
        kind: data.kind || null,
        activeUntil: data.activeUntil || null,
      };
      speichere(storage, stand);
      return stand;
    } catch (e) {
      return lade(storage); // Netzfehler: zuletzt gecachten Stand behalten
    }
  }

  async function anfordern(email, fetchFn) {
    var res = await fetchFn("/api/auth/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email }),
    });
    return !!(res && res.ok);
  }

  async function abmelden(storage, fetchFn) {
    var token = ladeSession(storage);
    try {
      if (token) await fetchFn("/api/auth/logout", { method: "POST", headers: { Authorization: "Bearer " + token } });
    } catch (e) {}
    try { storage.removeItem(SESSION_KEY); } catch (e) {}
    var leer = leererStand();
    speichere(storage, leer);
    return leer;
  }

  var api = {
    leererStand: leererStand, hatZugang: hatZugang, ladeSession: ladeSession,
    lade: lade, speichere: speichere, refresh: refresh, anfordern: anfordern, abmelden: abmelden,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.HPP_ENT = api;
})(typeof window !== "undefined" ? window : this);
```

- [ ] **Step 4: Tests laufen lassen, Erfolg bestätigen**

Run: `node --test app/entitlement.test.js`
Expected: PASS — 8 Tests grün.
Run: `npm test`
Expected: alle Suites grün (app/ + api/_lib/). Hinweis: Plan 1 hatte keine app.js-Unit-Tests; nur entitlement.test.js wurde ersetzt.

- [ ] **Step 5: Commit**

```bash
git add app/entitlement.js app/entitlement.test.js
git commit -m "feat(2b): entitlement.js async — Server-Cache, Login/Logout/Refresh (ersetzt Stub)"
```

---

## Task 2: `app.js` — Startfluss mit Hintergrund-Refresh

**Files:**
- Modify: `app/app.js`

**Interfaces:**
- Consumes: `window.HPP_ENT.lade/hatZugang/ladeSession/refresh` (Task 1).
- Produces: `state.view`-Markierung; beim Start einmaliger `refresh()`, der die Auswahl bei geändertem Zugang neu rendert.

Hinweis: Zeile 37–38 (`var ent = window.HPP_ENT.lade(window.localStorage);` + `function hatZugang()`) bleibt **unverändert** — `lade` liefert jetzt den neuen Cache-Shape, `hatZugang()` liest `ent.hatZugang`.

- [ ] **Step 1: `state.view` in `zeigeGuertelauswahl` setzen**

In `app/app.js`, in `zeigeGuertelauswahl`, direkt nach der Zeile `state.session = null;` (am Anfang der Funktion) einfügen:

```js
    state.view = "auswahl";
```

- [ ] **Step 2: Startfluss am Dateiende ersetzen**

Ersetze am Ende von `app/app.js` den Block

```js
  zeigeGuertelauswahl();
})();
```

durch

```js
  zeigeGuertelauswahl();

  // Beim Start einmal den echten Zugang holen (nur wenn eingeloggt) und ggf. die Auswahl auffrischen.
  if (window.HPP_ENT.ladeSession(window.localStorage)) {
    window.HPP_ENT.refresh(window.localStorage, window.fetch.bind(window)).then(function (stand) {
      var geaendert = window.HPP_ENT.hatZugang(stand) !== window.HPP_ENT.hatZugang(ent);
      ent = stand;
      if (geaendert && state.view === "auswahl" && !state.pruefung && !state.session) zeigeGuertelauswahl();
    });
  }
})();
```

- [ ] **Step 3: Syntax-Check**

Run: `node --check app/app.js`
Expected: keine Ausgabe (Syntax OK).
Run: `npm test`
Expected: weiterhin alle Tests grün (keine Unit-Tests für app.js; DOM-Verhalten wird in Task 5 im Browser geprüft).

- [ ] **Step 4: Commit**

```bash
git add app/app.js
git commit -m "feat(2b): Startfluss — Entitlement im Hintergrund refreshen, Auswahl auffrischen"
```

---

## Task 3: `app.js` — Paywall mit Magic-Link-Login statt Stub

**Files:**
- Modify: `app/app.js`

**Interfaces:**
- Consumes: `window.HPP_ENT.ladeSession/anfordern/abmelden` (Task 1).
- Produces: `zeigePaywall(guertel, modus)` mit Login-/Bestätigt-/Abmelden-Zuständen; kein `entsperreStub` mehr.

- [ ] **Step 1: `zeigePaywall` ersetzen (Vollersatz der Funktion)**

Ersetze die komplette `zeigePaywall`-Funktion in `app/app.js` (von `function zeigePaywall(guertel) {` bis zur zugehörigen schließenden `}` vor `function starteValidierung`) durch:

```js
  function zeigePaywall(guertel, modus) {
    leeren();
    state.session = null;
    state.pruefung = null;
    state.view = "pay";
    var session = window.HPP_ENT.ladeSession(window.localStorage);
    var html = '<div class="pay">' +
      '<div class="ov-top">' + homeButtonHtml(guertel) + '<h2 class="ov-title">Vollzugang</h2></div>' +
      '<p class="pay-lead">Level 1–2 (Gelb &amp; Grün) sind und bleiben kostenlos. ' +
      'Mit dem Vollzugang schaltest du <b>Level 3–5</b> (Blau, Braun, Originalprüfung) und den ' +
      'vollständigen <b>Prüfungsmodus</b> frei.</p>' +
      '<div class="pay-plans">' +
      '<div class="pay-plan"><div class="pay-price">0,99 €<span>/Monat</span></div><div class="pay-note">monatlich kündbar</div></div>' +
      '<div class="pay-plan"><div class="pay-price">9,99 €<span> einmalig</span></div><div class="pay-note">Lifetime-Zugang</div></div>' +
      '</div>' +
      '<button class="btn btn-primary pay-cta" id="pay-buy" disabled>Kaufen — kommt bald</button>';

    if (modus === "gesendet") {
      html += '<p class="pay-info">📬 Anmelde-Link verschickt. Öffne ihn auf diesem Gerät, dann bist du eingeloggt.</p>';
    } else if (modus === "login") {
      html += '<div class="pay-login">' +
        '<input type="email" id="pay-email" class="pay-input" placeholder="deine@email.de" autocomplete="email" inputmode="email">' +
        '<button class="btn" id="pay-send">Link senden</button></div>';
    } else {
      html += '<button class="btn pay-login-link" id="pay-login">Schon Zugang? Anmelden</button>';
    }
    if (session) {
      html += '<button class="btn pay-logout" id="pay-logout">Abmelden</button>';
    }
    html += '<button class="btn" id="pay-back">Zurück</button></div>';
    app.innerHTML = html;

    app.querySelector("#pay-back").addEventListener("click", zeigeGuertelauswahl);
    var loginBtn = app.querySelector("#pay-login");
    if (loginBtn) loginBtn.addEventListener("click", function () { zeigePaywall(guertel, "login"); });
    var sendBtn = app.querySelector("#pay-send");
    if (sendBtn) sendBtn.addEventListener("click", function () {
      var email = (app.querySelector("#pay-email").value || "").trim();
      if (!email) return;
      window.HPP_ENT.anfordern(email, window.fetch.bind(window)).then(function () {
        zeigePaywall(guertel, "gesendet");
      });
    });
    var logoutBtn = app.querySelector("#pay-logout");
    if (logoutBtn) logoutBtn.addEventListener("click", function () {
      window.HPP_ENT.abmelden(window.localStorage, window.fetch.bind(window)).then(function (stand) {
        ent = stand;
        zeigeGuertelauswahl();
      });
    });
    bindHome();
  }
```

- [ ] **Step 2: Syntax-Check**

Run: `node --check app/app.js`
Expected: keine Ausgabe. Prüfe per Suche, dass `entsperreStub` in `app/app.js` nicht mehr vorkommt:
Run: `grep -c entsperreStub app/app.js`
Expected: `0`.

- [ ] **Step 3: Commit**

```bash
git add app/app.js
git commit -m "feat(2b): Paywall mit Magic-Link-Login + Abmelden, Kauf-Button deaktiviert (Stub entfernt)"
```

---

## Task 4: Styles für Login/Logout in der Paywall

**Files:**
- Modify: `app/styles.css`

- [ ] **Step 1: CSS ergänzen**

Ans Ende von `app/styles.css` anhängen:

```css
/* Paywall-Login (Plan 2b) */
.pay-cta[disabled] { opacity: .5; cursor: not-allowed; }
.pay-login-link { width: 100%; margin-bottom: 10px; }
.pay-login { display: flex; gap: 8px; margin-bottom: 12px; }
.pay-input { flex: 1; border: 1.5px solid var(--line); border-radius: 14px; padding: 14px 16px; font: inherit; }
.pay-input:focus { outline: none; border-color: var(--accent); }
.pay-login .btn { white-space: nowrap; }
.pay-info { background: var(--accent-soft); border: 1px solid var(--accent); border-radius: 12px; padding: 12px 14px; font-size: 14px; margin-bottom: 12px; }
.pay-logout { width: 100%; margin-bottom: 10px; color: var(--warn); }
```

- [ ] **Step 2: Commit**

```bash
git add app/styles.css
git commit -m "style(2b): Paywall-Login/Logout (E-Mail-Feld, Hinweis, Abmelden)"
```

---

## Task 5: Lokale End-to-End-Verifikation (Koordinator, `vercel dev` + Browser)

**Files:** keine (nur Prüfung)

> Voraussetzung: `.env` mit `DATABASE_URL`, `RESEND_API_KEY`, `ADMIN_SECRET`, `APP_URL=http://localhost:3000` (aus Plan 2a vorhanden). Neon-Schema ist live.

- [ ] **Step 1: Unit-Tests grün**

Run: `npm test`
Expected: alle Tests grün (inkl. 8 neue entitlement-Tests).

- [ ] **Step 2: Dev-Server starten**

`vercel dev` starten (serviert statisches `app/` + `api/`-Functions auf `http://localhost:3000`, lädt `.env`).

- [ ] **Step 3: Free-Tier ohne Login prüfen**

`http://localhost:3000` öffnen, `localStorage.clear()` + reload. Erwartet: Level 1–2 frei, Level 3–5 mit 💎. Keine fehlgeschlagenen `/api/entitlement`-Calls (ohne Session wird keiner gemacht). Konsole fehlerfrei.

- [ ] **Step 4: Login-Flow**

Mit `hoechsterGuertel:'schwarz'` (alle gürtelfrei): auf Level 3 (💎) → Paywall. „Schon Zugang? Anmelden" → E-Mail eingeben → „Link senden" → Bestätigungs-Hinweis erscheint. Eine echte Magic-Link-Mail geht an die Adresse; alternativ Session manuell setzen (Koordinator-Trick, da Token im Postfach): einen Magic-Link per node anlegen und `/api/auth/verify?token=…` im Browser öffnen → landet auf `/`, `hpp_session` liegt in localStorage.

- [ ] **Step 5: Zugang per Admin-Grant → Unlock**

Per curl `POST /api/admin/grant` (Bearer ADMIN_SECRET, kind=lifetime) für die Test-E-Mail. Dann App neu laden → `refresh()` holt `hatZugang:true` → Level 3–5 ohne 💎, Prüfungs-/Übungsmodus für diese Level zugänglich. preview/Browser bestätigt.

- [ ] **Step 6: Abmelden**

In der Paywall (oder nach erneutem Öffnen) „Abmelden" → `hpp_session` weg, Cache zurück, Level 3–5 wieder 💎. Konsole fehlerfrei. Screenshot der freigeschalteten Auswahl + des Login-Zustands als Beweis.

---

## Task 6: Produktion — Env setzen, deployen, Smoke (bündelt Plan-2a Task 11)

**Files:** keine (Deploy)

> USER-/Koordinator-AKTION: die Backend-Env-Variablen in Vercel (Production) hinterlegen — `DATABASE_URL`, `RESEND_API_KEY`, `MAIL_FROM`, `ADMIN_SECRET`, und **`APP_URL=https://hpp-app-one.vercel.app`** (NICHT localhost). Entweder im Dashboard (Settings → Environment Variables) oder per CLI `vercel env add <NAME> production` (Wert aus `.env`).

- [ ] **Step 1: Deploy**

Run: `vercel --prod --yes`
Expected: Deployment `READY`.

- [ ] **Step 2: Prod-Smoke (Backend erreichbar)**

```bash
curl -s -o /dev/null -w "request: %{http_code}\n" -X POST https://hpp-app-one.vercel.app/api/auth/request -H "Content-Type: application/json" -d '{"email":"cwick6116@gmail.com"}'
curl -s https://hpp-app-one.vercel.app/api/entitlement
```
Expected: `request: 200`; `/api/entitlement` ohne Token → `{"hatZugang":false,...}`.

- [ ] **Step 3: Prod-E2E im Browser**

`https://hpp-app-one.vercel.app` öffnen → Paywall → Anmelden mit eigener E-Mail → Magic-Link aus dem Postfach klicken (zeigt jetzt auf die Prod-URL) → eingeloggt. Admin-Grant per curl gegen Prod → reload → Level 3–5 frei. Damit ist die ganze Kette produktiv verifiziert.

- [ ] **Step 4: Abschluss**

Keine Code-Änderung; Plan 2b fertig. STATUS.md/Memory aktualisieren (Koordinator).

---

## Self-Review (durchgeführt)

**1. Spec-Abdeckung** (`2026-06-18-backend-entitlement-design.md` §5):
- async `entitlement.js`, sync `hatZugang(ent)` bleibt → Task 1.
- Cache `hpp_entitlement` `{hatZugang,…}` + `hpp_session` → Task 1 (`lade`/`speichere`/`ladeSession`).
- `lade` instant + `refresh()` Hintergrund → Task 1 (`refresh`) + Task 2 (Startfluss).
- `anfordern`/`abmelden`, `entsperreStub` entfällt → Task 1 + Task 3 (grep-Check auf 0).
- Startfluss „sofort Cache, dann refresh, bei Änderung neu rendern" → Task 2.
- Paywall „Schon Zugang? Anmelden", Kauf-Button bis Plan 3 deaktiviert, Abmelden wenn eingeloggt → Task 3.
- Free-Tier ohne Login/offline → Task 1 (kein Call ohne Session) + Task 5 Step 3.

**2. Placeholder-Scan:** Keine TBD/TODO. `…`/`token` in Task-5-Kommandos sind bewusste Laufzeitwerte.

**3. Typ-Konsistenz:** `refresh(storage, fetchFn)`, `anfordern(email, fetchFn)`, `abmelden(storage, fetchFn)`, `ladeSession(storage)`, `hatZugang(ent)` in Task 1 definiert und in Tasks 2/3 exakt so aufgerufen (`window.fetch.bind(window)` als `fetchFn`). Cache-Shape `{hatZugang,kind,activeUntil}` durchgängig. `state.view` in Task 2 (`"auswahl"`) und Task 3 (`"pay"`) gesetzt, im Startfluss-Guard (Task 2) geprüft. Endpunkt-Pfade decken sich mit Plan 2a.

**Hinweis Dev-Workflow:** Ab 2b braucht das lokale Testen `vercel dev` (API + statisch gemeinsam), nicht den reinen `python -m http.server` aus früheren Paketen. In STATUS.md beim Abschluss vermerken.
