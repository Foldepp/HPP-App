# Freemium-Gating (Frontend) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die Free/Paid-Grenze im Frontend sichtbar machen — Gelb/Grün gratis, Blau/Braun/Schwarz + Prüfungsmodus hinter einer Paywall, die gegen einen lokalen Stub-Zugang prüft.

**Architecture:** Reine Gating-Logik kommt in das getestete UMD-Modul `logic.js`. Ein neues UMD-Modul `entitlement.js` kapselt den Zugangs-Status in localStorage (Schlüssel `hpp_entitlement`) — im Plan 1 ein simpler `{aktiv:bool}`-Stub, dessen `hatZugang()`-Schnittstelle Plan 2/3 (echtes Backend/Stripe) unverändert übernehmen. `app.js` rendert je Level einen von drei Zuständen (frei / gürtel-gesperrt / bezahl-gesperrt) und zeigt bei Bezahl-Sperre eine Paywall-Ansicht.

**Tech Stack:** Vanilla JS (UMD-Module wie bestehend), `node:test` für Unit-Tests, kein Build. Verifikation lokal über `python3 -m http.server` (launch.json `hpp-app`) + preview_*-Tools.

**Bezug zur Spec:** `docs/superpowers/specs/2026-06-18-monetarisierung-design.md` — Abschnitte 2 (Free-Schnitt), 4 (Freischalten in der App), 6 (Soft-Gating). Backend/Stripe/Magic-Link (Abschnitte 5–6) sind **Plan 2/3**, nicht hier.

---

## Datei-Struktur

- `app/logic.js` (modify) — neue reine Funktionen: `istGratisLevel`, `istBezahlLevel`, `levelStatus`. Verantwortung: alle Gürtel/Level-Statusregeln, frei von DOM und Storage.
- `app/logic.test.js` (modify) — Tests für die drei neuen Funktionen.
- `app/entitlement.js` (create) — UMD-Persistenz des Zugangs (`hpp_entitlement`). Verantwortung: laden/speichern des Zugangs-Status + `hatZugang`. Spiegelt das Muster von `srs.js`.
- `app/entitlement.test.js` (create) — Tests für das Entitlement-Modul.
- `app/index.html` (modify) — lädt `entitlement.js` vor `app.js`.
- `app/app.js` (modify) — lädt Entitlement, rendert Level-Status, neue `zeigePaywall`-Ansicht, defensive Guards in den Einstiegspunkten.
- `app/styles.css` (modify) — Styles für Paywall-Ansicht und das Bezahl-gesperrt-Level.

---

## Task 1: Reine Gating-Logik in `logic.js`

**Files:**
- Modify: `app/logic.js`
- Test: `app/logic.test.js`

- [ ] **Step 1: Failing tests schreiben**

In `app/logic.test.js` ans Dateiende anhängen:

```js
test("istGratisLevel: nur gelb und gruen", () => {
  assert.strictEqual(L.istGratisLevel("gelb"), true);
  assert.strictEqual(L.istGratisLevel("gruen"), true);
  assert.strictEqual(L.istGratisLevel("blau"), false);
  assert.strictEqual(L.istGratisLevel("braun"), false);
  assert.strictEqual(L.istGratisLevel("schwarz"), false);
});

test("istBezahlLevel: blau, braun, schwarz", () => {
  assert.strictEqual(L.istBezahlLevel("blau"), true);
  assert.strictEqual(L.istBezahlLevel("braun"), true);
  assert.strictEqual(L.istBezahlLevel("schwarz"), true);
  assert.strictEqual(L.istBezahlLevel("gelb"), false);
  assert.strictEqual(L.istBezahlLevel("gruen"), false);
});

test("levelStatus: Gürtel-Sperre hat Vorrang vor Bezahl-Sperre", () => {
  assert.strictEqual(L.levelStatus("blau", "gruen", false), "guertel-gesperrt");
  assert.strictEqual(L.levelStatus("blau", "gruen", true), "guertel-gesperrt");
});

test("levelStatus: freigeschaltetes Bezahllevel ohne Zugang -> bezahl-gesperrt", () => {
  assert.strictEqual(L.levelStatus("blau", "blau", false), "bezahl-gesperrt");
  assert.strictEqual(L.levelStatus("blau", "blau", true), "frei");
  assert.strictEqual(L.levelStatus("schwarz", "schwarz", false), "bezahl-gesperrt");
});

test("levelStatus: Gratislevel ist immer frei (Zugang egal)", () => {
  assert.strictEqual(L.levelStatus("gelb", "gelb", false), "frei");
  assert.strictEqual(L.levelStatus("gruen", "gruen", false), "frei");
});
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `node --test app/logic.test.js`
Expected: FAIL — `TypeError: L.istGratisLevel is not a function`.

- [ ] **Step 3: Minimale Implementierung in `logic.js`**

In `app/logic.js` nach der Zeile `var BESTEHENSGRENZE = 21;` (Zeile 6) einfügen:

```js
  var GRATIS_GUERTEL = ["gelb", "gruen"];
```

Direkt nach der Funktion `istFreigeschaltet` (endet Zeile 21 mit `}`) einfügen:

```js
  function istGratisLevel(guertel) {
    return GRATIS_GUERTEL.indexOf(guertel) >= 0;
  }

  function istBezahlLevel(guertel) {
    return GUERTEL.indexOf(guertel) >= 0 && !istGratisLevel(guertel);
  }

  function levelStatus(guertel, hoechster, hatZugang) {
    if (!istFreigeschaltet(guertel, hoechster)) return "guertel-gesperrt";
    if (istBezahlLevel(guertel) && !hatZugang) return "bezahl-gesperrt";
    return "frei";
  }
```

Im `api`-Objekt (beginnt Zeile 77 mit `var api = {`) nach der Zeile `istFreigeschaltet: istFreigeschaltet,` ergänzen:

```js
    GRATIS_GUERTEL: GRATIS_GUERTEL,
    istGratisLevel: istGratisLevel,
    istBezahlLevel: istBezahlLevel,
    levelStatus: levelStatus,
```

- [ ] **Step 4: Test laufen lassen, Erfolg bestätigen**

Run: `node --test app/logic.test.js`
Expected: PASS — alle Tests grün (bestehende + 4 neue).

- [ ] **Step 5: Commit**

```bash
git add app/logic.js app/logic.test.js
git commit -m "feat(gating): reine Level-Status-Logik (gratis/bezahl/levelStatus)"
```

---

## Task 2: Entitlement-Modul `entitlement.js`

**Files:**
- Create: `app/entitlement.js`
- Test: `app/entitlement.test.js`

- [ ] **Step 1: Failing test schreiben**

`app/entitlement.test.js` neu anlegen:

```js
const test = require("node:test");
const assert = require("node:assert");
const E = require("./entitlement.js");

function stubStore() {
  var m = {};
  return {
    getItem: function (k) { return k in m ? m[k] : null; },
    setItem: function (k, v) { m[k] = String(v); },
  };
}

test("leererStand: kein Zugang", () => {
  assert.deepStrictEqual(E.leererStand(), { aktiv: false });
  assert.strictEqual(E.hatZugang(E.leererStand()), false);
});

test("hatZugang: true nur bei aktiv === true", () => {
  assert.strictEqual(E.hatZugang({ aktiv: true }), true);
  assert.strictEqual(E.hatZugang({ aktiv: false }), false);
  assert.strictEqual(E.hatZugang(null), false);
  assert.strictEqual(E.hatZugang(undefined), false);
});

test("lade: leerer oder kaputter Speicher -> leererStand", () => {
  assert.deepStrictEqual(E.lade(stubStore()), { aktiv: false });
  assert.deepStrictEqual(E.lade({ getItem: function () { return "kaputt{"; } }), { aktiv: false });
});

test("entsperreStub -> speichert aktiv, lade liest es zurück", () => {
  var store = stubStore();
  var ent = E.entsperreStub(store);
  assert.deepStrictEqual(ent, { aktiv: true });
  assert.deepStrictEqual(E.lade(store), { aktiv: true });
  assert.strictEqual(E.hatZugang(E.lade(store)), true);
});

test("sperre -> setzt aktiv zurück", () => {
  var store = stubStore();
  E.entsperreStub(store);
  E.sperre(store);
  assert.deepStrictEqual(E.lade(store), { aktiv: false });
});
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `node --test app/entitlement.test.js`
Expected: FAIL — `Cannot find module './entitlement.js'`.

- [ ] **Step 3: `entitlement.js` implementieren**

`app/entitlement.js` neu anlegen:

```js
(function (root) {
  "use strict";

  var KEY = "hpp_entitlement";

  function leererStand() { return { aktiv: false }; }
  function hatZugang(ent) { return !!(ent && ent.aktiv); }

  function lade(storage) {
    try {
      var roh = JSON.parse(storage.getItem(KEY));
      if (roh && typeof roh.aktiv === "boolean") return roh;
    } catch (e) {}
    return leererStand();
  }
  function speichere(storage, ent) {
    try { storage.setItem(KEY, JSON.stringify(ent)); } catch (e) {}
  }

  // Plan-1-Stub: lokales Freischalten. Plan 3 (Stripe) ersetzt den Schreibpfad,
  // hatZugang/lade bleiben die stabile Schnittstelle.
  function entsperreStub(storage) {
    var ent = { aktiv: true };
    speichere(storage, ent);
    return ent;
  }
  function sperre(storage) {
    var ent = leererStand();
    speichere(storage, ent);
    return ent;
  }

  var api = {
    leererStand: leererStand, hatZugang: hatZugang,
    lade: lade, speichere: speichere,
    entsperreStub: entsperreStub, sperre: sperre,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.HPP_ENT = api;
})(typeof window !== "undefined" ? window : this);
```

- [ ] **Step 4: Test laufen lassen, Erfolg bestätigen**

Run: `node --test app/entitlement.test.js`
Expected: PASS — 5 Tests grün.

- [ ] **Step 5: Commit**

```bash
git add app/entitlement.js app/entitlement.test.js
git commit -m "feat(gating): entitlement.js — localStorage-Zugangsstatus (Stub)"
```

---

## Task 3: Entitlement in App laden + Script einbinden

**Files:**
- Modify: `app/index.html`
- Modify: `app/app.js`

- [ ] **Step 1: `entitlement.js` in `index.html` einbinden**

In `app/index.html` die Zeile `<script src="srs.js"></script>` (Zeile 13) ersetzen durch:

```html
  <script src="srs.js"></script>
  <script src="entitlement.js"></script>
```

(Reihenfolge: `entitlement.js` nach `srs.js`, vor `app.js`.)

- [ ] **Step 2: Entitlement in `app.js` laden**

In `app/app.js` nach der Funktion `srsSpeichern` (Zeile 35: `function srsSpeichern() { window.HPP_SRS.speichere(window.localStorage, srs); }`) einfügen:

```js
  var ent = window.HPP_ENT.lade(window.localStorage);
  function hatZugang() { return window.HPP_ENT.hatZugang(ent); }
```

- [ ] **Step 3: Bestehende Tests prüfen (nichts gebrochen)**

Run: `node --test app/logic.test.js app/srs.test.js app/entitlement.test.js`
Expected: PASS — alle Tests grün (DOM-Code wird hier nicht getestet; dient nur der Absicherung der Module).

- [ ] **Step 4: Commit**

```bash
git add app/index.html app/app.js
git commit -m "feat(gating): entitlement laden + entitlement.js einbinden"
```

---

## Task 4: Level-Status rendern + Paywall-Ansicht + Guards

**Files:**
- Modify: `app/app.js`

- [ ] **Step 1: Level-Liste in `zeigeGuertelauswahl` auf `levelStatus` umstellen**

In `app/app.js` den `L.GUERTEL.forEach(...)`-Block in `zeigeGuertelauswahl` (Zeilen 84–95) komplett ersetzen durch:

```js
    L.GUERTEL.forEach(function (g) {
      var status = L.levelStatus(g, hoechster, hatZugang());
      var badge = "", attr = "", cls = "";
      if (status === "frei") {
        attr = 'data-guertel="' + g + '"';
        if (state.modus === "ueben") {
          var n = window.HPP_SRS.anzahlFaellig(srs, g, heute);
          badge = '<span class="badge' + (n > 0 ? "" : " zero") + '">' + n + ' fällig</span>';
        }
      } else if (status === "bezahl-gesperrt") {
        cls = " paywall";
        attr = 'data-paywall="' + g + '"';
        badge = '<span class="lock">💎</span>';
      } else {
        cls = " locked";
        attr = "disabled";
        badge = '<span class="lock">🔒</span>';
      }
      html += '<button class="guertel' + cls + '" ' + attr + '>' +
        '<span class="punkt" style="background:var(--g-' + g + ')"></span>' +
        '<span class="gname">' + LABELS[g] + '</span>' + badge + '</button>';
    });
```

- [ ] **Step 2: Click-Handler für Paywall-Level ergänzen**

In `zeigeGuertelauswahl`, direkt nach dem bestehenden `[data-guertel]`-Handler-Block (endet Zeile 106 mit `});`), einfügen:

```js
    app.querySelectorAll("[data-paywall]").forEach(function (el) {
      el.addEventListener("click", function () {
        zeigePaywall(el.getAttribute("data-paywall"));
      });
    });
```

- [ ] **Step 3: `zeigePaywall`-Ansicht hinzufügen**

In `app/app.js` direkt vor der Funktion `starteValidierung` (Zeile 109) einfügen:

```js
  function zeigePaywall(guertel) {
    leeren();
    state.session = null;
    var html = '<div class="pay">' +
      '<div class="ov-top">' + homeButtonHtml(guertel) + '<h2 class="ov-title">Vollzugang freischalten</h2></div>' +
      '<p class="pay-lead">Level 1–2 (Gelb &amp; Grün) sind und bleiben kostenlos. ' +
      'Mit dem Vollzugang schaltest du <b>Level 3–5</b> (Blau, Braun, Originalprüfung), ' +
      'den vollständigen <b>Prüfungsmodus</b> und den geräteübergreifenden Fortschritt frei.</p>' +
      '<div class="pay-plans">' +
      '<div class="pay-plan"><div class="pay-price">0,99 €<span>/Monat</span></div><div class="pay-note">monatlich kündbar</div></div>' +
      '<div class="pay-plan"><div class="pay-price">9,99 €<span> einmalig</span></div><div class="pay-note">Lifetime-Zugang</div></div>' +
      '</div>' +
      '<button class="btn btn-primary pay-cta" id="pay-cta">Freischalten</button>' +
      '<p class="pay-demo">Demo: Die echte Zahlung folgt in einem späteren Schritt. „Freischalten" entsperrt vorerst nur lokal auf diesem Gerät.</p>' +
      '<button class="btn" id="pay-back">Zurück</button>' +
      '</div>';
    app.innerHTML = html;
    app.querySelector("#pay-cta").addEventListener("click", function () {
      ent = window.HPP_ENT.entsperreStub(window.localStorage);
      zeigeGuertelauswahl();
    });
    app.querySelector("#pay-back").addEventListener("click", zeigeGuertelauswahl);
    bindHome();
  }
```

- [ ] **Step 4: Defensiver Guard in `starteValidierung`**

In `starteValidierung` (Zeile 109) als erste Zeile der Funktion einfügen (vor `state.pruefung = {`):

```js
    if (L.istBezahlLevel(guertel) && !hatZugang()) { zeigePaywall(guertel); return; }
```

- [ ] **Step 5: Defensiver Guard in `zeigeDashboard`**

In `zeigeDashboard(level)` (Zeile 514) als erste Zeile der Funktion einfügen (vor `leeren();`):

```js
    if (L.istBezahlLevel(level) && !hatZugang()) { zeigePaywall(level); return; }
```

- [ ] **Step 6: Bestehende Tests prüfen (Module unverändert grün)**

Run: `node --test app/logic.test.js app/srs.test.js app/entitlement.test.js`
Expected: PASS — alle Tests grün.

- [ ] **Step 7: Commit**

```bash
git add app/app.js
git commit -m "feat(gating): Level-Status rendern, Paywall-Ansicht, Einstiegs-Guards"
```

---

## Task 5: Styles für Paywall

**Files:**
- Modify: `app/styles.css`

- [ ] **Step 1: CSS ergänzen**

Ans Ende von `app/styles.css` anhängen:

```css
/* Paywall / Freischalten */
.guertel.paywall { cursor: pointer; }
.guertel.paywall .lock { margin-left: auto; font-size: 18px; }
.pay { display: flex; flex-direction: column; flex: 1; min-height: 100vh; padding-top: 8px; }
.pay-lead { font-size: 15px; line-height: 1.5; margin: 16px 0 18px; }
.pay-plans { display: flex; gap: 12px; margin-bottom: 20px; }
.pay-plan { flex: 1; background: var(--card); border: 1.5px solid var(--line); border-radius: 14px; padding: 16px 14px; text-align: center; }
.pay-price { font-size: 22px; font-weight: 800; }
.pay-price span { font-size: 13px; font-weight: 600; color: var(--muted); }
.pay-note { font-size: 12px; color: var(--muted); margin-top: 4px; }
.pay-cta { width: 100%; margin-bottom: 10px; }
.pay-demo { font-size: 12px; color: var(--muted); text-align: center; margin: 0 0 18px; }
.pay #pay-back { margin-top: auto; }
```

- [ ] **Step 2: Commit**

```bash
git add app/styles.css
git commit -m "style(gating): Paywall-Ansicht und Bezahl-gesperrt-Level"
```

---

## Task 6: Verifikation im Browser

**Files:** keine Änderung (nur Prüfung)

- [ ] **Step 1: Alle Unit-Tests grün**

Run: `node --test app/logic.test.js app/srs.test.js app/entitlement.test.js`
Expected: PASS — alle Tests grün.

- [ ] **Step 2: Dev-Server starten und laden**

Über die preview_*-Tools den Server `hpp-app` starten (`python3 -m http.server 8123 --directory app`) und `http://localhost:8123/` öffnen.

**Cache-Falle (aus STATUS.md):** `http.server` schickt kein no-cache. Falls geänderte Dateien nicht durchschlagen, in `index.html` temporär `?v=2` an `logic.js`, `entitlement.js`, `app.js`, `styles.css` hängen, prüfen, **danach zurücksetzen** (committet ohne `?v=`).

- [ ] **Step 3: Frei/Gesperrt prüfen (frischer Zustand)**

Im Browser localStorage leeren (`localStorage.clear()` via preview_eval), neu laden. Erwartet auf der Levelauswahl:
- Gelb = frei (klickbar).
- Grün = gürtel-gesperrt 🔒 (noch nicht bestanden) — disabled.
- Blau/Braun/Schwarz = gürtel-gesperrt 🔒.

Setze zum Test alle Level gürtel-frei: `localStorage.setItem('hpp_progress', JSON.stringify({hoechsterGuertel:'schwarz', ergebnisse:[]}))` via preview_eval, neu laden. Erwartet:
- Gelb, Grün = frei.
- Blau, Braun, Schwarz = bezahl-gesperrt 💎 (klickbar).

- [ ] **Step 4: Paywall-Flow prüfen**

Auf Blau (💎) klicken → Paywall-Ansicht mit beiden Preisen (0,99 €/Monat, 9,99 € Lifetime) erscheint. „Freischalten" klicken → zurück zur Levelauswahl, Blau/Braun/Schwarz jetzt frei (kein 💎). preview_snapshot bestätigt.

- [ ] **Step 5: Prüfungsmodus-Guard prüfen**

localStorage zurücksetzen auf `hoechsterGuertel:'schwarz'` ohne Entitlement (`localStorage.removeItem('hpp_entitlement')`), neu laden. Auf Blau klicken (Modus „Prüfung") → Paywall statt Prüfung. Im Modus „Üben" auf Blau → ebenfalls Paywall (Guard in `zeigeDashboard`).

- [ ] **Step 6: Beweis sichern**

preview_screenshot von (a) Levelauswahl mit 💎-Bezahllevels und (b) der Paywall-Ansicht. Konsole (preview_console_logs) ohne Fehler.

---

## Self-Review (durchgeführt)

**1. Spec-Abdeckung:**
- Free-Schnitt Gelb/Grün gratis, Blau/Braun/Schwarz bezahlt (Spec §2) → Task 1 (`istGratisLevel`/`levelStatus`), Task 4 (Rendering).
- Prüfungsmodus nur bezahlt (Spec §2) → Task 4 Step 4 (Guard in `starteValidierung`).
- „Freischalten in der App" (Spec §4) → Task 4 Step 3 (`zeigePaywall`).
- Soft-Gating, Daten bleiben im Client, Entsperrung über Status (Spec §6) → Task 2 (`entitlement.js`), bewusst kein DRM.
- Preise 0,99 €/Monat + 9,99 € Lifetime (Spec §3) → Task 4 Step 3 (Paywall-Text).
- Nicht in Plan 1 (bewusst): Backend, Stripe, Magic-Link, echter Zahlungspfad, Sync (Spec §5–6) → Plan 2/3. Der Stub-Unlock ist klar als Demo markiert.

**2. Placeholder-Scan:** keine TBD/TODO; alle Code-Schritte vollständig.

**3. Typ-Konsistenz:** `hatZugang` ist überall ein Boolean-liefernder Aufruf (`app.js`-Helper) bzw. `HPP_ENT.hatZugang(ent)`; `levelStatus(guertel, hoechster, hatZugang)` nimmt den Boolean. `levelStatus`-Rückgaben (`"frei"`/`"guertel-gesperrt"`/`"bezahl-gesperrt"`) werden in Task 4 Step 1 exakt so verzweigt. Storage-Schlüssel `hpp_entitlement` konsistent in `entitlement.js`.
