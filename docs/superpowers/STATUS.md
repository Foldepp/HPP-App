# Projektstatus / Übergabe — HPP-Prüfungstraining

**Stand:** 2026-06-18 · Branch `main` (Remote: github.com/Foldepp/HPP-App)
Diese Datei ist die Wiederaufnahme-Notiz: was steht, wie es gebaut ist, was offen ist.

**Live:** Auf Vercel deployed → https://hpp-app-one.vercel.app (Projekt `hpp-app`, statisch aus
`app/`, Config in `vercel.json`). Deploy-Protection aus. Redeploy via `vercel --prod` (kein Git-Auto-Deploy:
Repo liegt unter Org `Foldepp`, Vercel-Account `cwick6116`).

## Was fertig & verifiziert ist

**Paket A — Prüfungsmodus-Grundlage** (Spec/Plan: `docs/superpowers/{specs,plans}/2026-06-17-*`)
- Prüfungsmodus: 28 Fragen, 60-Min-Timer, Auswertung 21/28, Gürtel-Freischaltung, Durchsicht.
- Home-Button (🏠 oben links, gürtelfarbiger Ring) mit Rückfrage nur bei laufender Prüfung.
- Zufällige Antwort-Reihenfolge, **pro Versuch konstant**, Anzeige A–E, intern Original-Buchstaben.
- Level-Labels statt Gürtelfarben-Namen: **Level 1–4 + Originalprüfung** (Farben bleiben visuell).
  Interne Schlüssel weiterhin `gelb/gruen/blau/braun/schwarz`.

**Paket B — Übungsmodus / SRS** (Spec/Plan: `docs/superpowers/{specs,plans}/2026-06-17-paket-b-*`)
- Startseite: Umschalter **Prüfung / Üben**. Üben + Level → Level-Dashboard.
- Fehlergetriebenes Spaced-Repetition: Karte = Frage je Stufe (`examId|nr|level`), **level-gepoolt
  über alle `guertel_komplett`-Prüfungen**. Streak 0→4, Abstände **2/4/8 Tage**, gemeistert nach
  **4× richtig** in Folge (Karte fliegt raus). Tagesplan = heute fällige Karten.
- Dashboard: Hero „N heute fällig" → Üben; „Alle Fragen durchgehen"; 12 **Themenbereiche**
  (scrollbar, je mit Fällig-Zahl + Trefferquote).
- Karten-Screen: kein Timer, „Prüfen" → Sofort-Feedback (wächst **nach unten**, ✓/✗-Markierung,
  Wissenskern aus `frage.kern`, „kommt … wieder · Streak x/4"), Lapse-Wiedervorlage (max 3),
  „Weiter". Home bricht Session ab.
- **Prüfungsfehler** seeden automatisch fällige Übungskarten (morgen fällig).
- **A1-Härtung:** nur Fragen **mit** `themenbereich` werden gepoolt (Schutz vor unfertigen Daten).

**Paket C — Monetarisierung Plan 1: Freemium-Gating (Frontend)** (Spec: `docs/superpowers/specs/2026-06-18-monetarisierung-design.md`, Plan: `docs/superpowers/plans/2026-06-18-freemium-gating-frontend.md`)
- **Free-Schnitt:** Level 1–2 (Gelb/Grün) gratis; Level 3–5 (Blau/Braun/Schwarz) + Prüfungsmodus
  hinter Paywall. Reine Logik in `logic.js` (`istGratisLevel`/`istBezahlLevel`/`levelStatus` →
  `frei`/`guertel-gesperrt`/`bezahl-gesperrt`; Gürtel-Sperre vor Bezahl-Sperre).
- **`entitlement.js`** (neues UMD-Modul, localStorage `hpp_entitlement`): `lade`/`hatZugang` = stabile
  Leseschnittstelle, `entsperreStub` = isolierter Schreibpfad (Plan 3/Stripe ersetzt nur diesen).
- **Paywall-Ansicht** (`zeigePaywall` in `app.js`) mit 0,99 €/Monat + 9,99 € Lifetime; „Freischalten"
  ist bewusst ein **lokaler Demo-Stub** (kein echtes Bezahlen). Defensive Guards in `starteValidierung`
  + `zeigeDashboard`. Live im Browser verifiziert (3 Zustände, Entsperrung, Reset, keine Konsolenfehler).
- **Geschäftsmodell-Spec (Spec §1–10):** Modell C — 0,99 €/Monat + 9,99 € Lifetime, Stripe direkt
  (kein MoR), Soft-Gating, Identität = E-Mail, Magic Link, Postgres/Neon.

**Plan 2a — Backend (Identität/Magic-Link/Entitlement)** (Spec: `2026-06-18-backend-entitlement-design.md`,
Plan: `2026-06-18-plan2a-backend.md`) — **code-seitig fertig, end-to-end gegen echtes Neon+Resend verifiziert, auf `main`.**
- Node/CommonJS-Backend unter `api/` (Vercel Functions). `package.json` + Deps (`@neondatabase/serverless`,
  `resend`); `vercel.json` `installCommand: "npm install"`.
- `api/_lib/`: `auth.js` (Token/Hash/`zugangAktiv`/`magicLinkGueltig`, getestet), `http.js`
  (Bearer/E-Mail, getestet), `db.js` (Neon, 9 Funktionen), `mail.js` (Resend), `schema.sql` (3 Tabellen).
- Endpunkte: `POST /api/auth/request` (immer 200, keine Enumeration), `GET /api/auth/verify`
  (Session + Mini-HTML→localStorage `hpp_session`, **atomare Single-Use-Einlösung**), `GET /api/entitlement`
  (Bearer-Session → `{hatZugang,kind,activeUntil}`), `POST /api/admin/grant` (per `ADMIN_SECRET`),
  `POST /api/auth/logout`. Token nur als Hash gespeichert.
- **Neon-DB live** (Projekt „HPP Trainer", Frankfurt, Schema eingespielt). **Resend** Key gültig.
  Lokale Secrets in `.env` (gitignored): `DATABASE_URL`, `RESEND_API_KEY`, `MAIL_FROM`, `ADMIN_SECRET`, `APP_URL`.
- **Noch offen:** Task 11 = Prod-Deploy (Vercel-Env setzen + `vercel --prod` + Smoke) — bewusst zurückgestellt,
  weil die Endpunkte erst mit **Plan 2b (Frontend-Integration: async `entitlement.js` + Login-UI)** sichtbar
  werden. Plan 3 (Stripe) danach. Rechtstexte (Impressum/DSGVO/AGB/Widerruf) + IP-Frage = Go-Live-Blocker, separater Strang.

**Tests:** `npm test` (= `node --test app/*.test.js api/_lib/*.test.js`) → 39 grün. Endpunkte sind
integrationsgeprüft (kein Unit-Test; reine Helfer sind getestet).
**Daten:** 4 Prüfungen `guertel_komplett` (2026-03, 2025-10, 2025-03, 2024-10), 112 Fragen, alle mit
gültigem `themenbereich`, alle Schwarz-Lösungen == `fragen_original.json`, 0 inhaltsbasierte
Cross-Prüfungs-Dubletten.

## Dateien (App, alles in `app/`, Vanilla JS, kein Build)

- `index.html` lädt `styles.css`, `data.js`, `logic.js`, `srs.js`, `entitlement.js`, `app.js` (genau diese Reihenfolge).
- `entitlement.js` — UMD-Persistenz des Bezahl-Zugangs (`hpp_entitlement`), getestet. Plan-1-Stub.
- `logic.js` — reine, getestete Funktionen (Auswertung, Mischen, SRS-Streak/Fälligkeit). UMD.
- `srs.js` — localStorage-Persistenz `hpp_srs` (Karten, Stats, fällige, Trefferquote). UMD, getestet.
- `app.js` — alle Views/State: Gürtelauswahl+Umschalter, Prüfung, Übersicht, Auswertung, Durchsicht,
  Übungs-Dashboard, Session-Engine, Karten-Screen, Prüfungs-Seeding.
- `data.js` — **generiert** aus `daten/` via `python3 daten/build_data.py` (nie von Hand editieren).
- localStorage-Schlüssel: `hpp_progress` (Gürtel/Ergebnisse), `hpp_srs` (Übungskarten/Stats).

## Daten-Pipeline (`daten/`)

- `build_data.py` → `app/data.js`. Enthält **inhaltsbasierten** Cross-Prüfungs-Dublettencheck
  (Stamm + Aussagen + Optionen). **Wichtig:** rein stammbasierte Vergleiche erzeugen bei generischen
  Formulierungen („Welche der folgenden Aussagen zu X sind richtig?") Fehlalarme — Inhalt vergleichen.
- `themenbereiche.json` — die 12 Bereiche (id+label). `zuordnung_themenbereiche.py` schreibt
  `themenbereich` je Frage (feste Zuordnung; bei neuer Prüfung dort ergänzen, dann build).
- Quelle der Wahrheit für Stufe „schwarz": `fragen_original.json` (44 Originalprüfungen). Schwarz nie ändern.
- Neue Prüfung übersetzen = Cowork-/Datenaufgabe nach Rezeptur v5 (`Projektplan_HPP-Guertelsystem.md`).

## Verifikation / Vorschau

- Dev-Server: `.claude/launch.json` Name **`hpp-app`** (`python3 -m http.server 8123 --directory app`).
  Über die preview_*-Tools starten/prüfen.
- **Browser-Cache-Falle:** `http.server` schickt kein no-cache; der Browser cached pro URL inkl.
  Query. Nach Code-Änderung in `index.html` einen Cache-Bust-Token an die geänderten Dateien hängen
  (`app.js?v=…`), prüfen, danach **zurücksetzen** (index.html muss ohne `?v=` committet sein).

## Offen / optional (keine Blocker)

- **Braun==Schwarz** bei 2025-03 F9 & F14: Level 4 inhaltlich identisch zum Original (kosmetisch;
  Rezeptur v5 will Braun „eine Stufe unter Original, neu formuliert"). Cowork-Nachtrag möglich.
- **Prüfungsmodus spielt nur `2026-03`** (`EXAM` hardcodiert). Auswahl mehrerer Prüfungen im
  Prüfungsmodus ist ein späteres Feature (Üben poolt bereits alle).
- **Dark Mode** (per CSS-Variablen vorbereitet, noch nicht gebaut).
- Kleinere App.js-Hygiene aus dem finalen Review (z. B. doppeltes `heute()` vs `L.heuteIso()`,
  `state.pruefung` nach Abgabe nicht genullt) — nachweislich harmlos, bewusst nicht angefasst.
- Restliche ~40 Original-Prüfungen noch nicht über alle Gürtel übersetzt (Daten-Pipeline).

## Arbeitsweise (Konventionen dieser Zusammenarbeit)

- Pläne werden **subagent-getrieben** ausgeführt (frischer Subagent pro Task, Reviews dazwischen).
- Beim Brainstorming wird der **Visual Companion** proaktiv genutzt (keine Erlaubnis-Nachfrage).
- Neue Features: erst Brainstorm → Spec → Plan → Umsetzung (superpowers-Flow).
