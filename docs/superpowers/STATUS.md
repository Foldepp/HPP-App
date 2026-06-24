# Projektstatus / Übergabe — HPP-Prüfungstraining

**Stand:** 2026-06-24 · Branch `main` (Remote: github.com/Foldepp/HPP-App)
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

**Plan 2b — Frontend-Integration** (Plan: `2026-06-18-plan2b-frontend-integration.md`) — **code-seitig fertig, auf `main`, Wiring im Browser verifiziert.**
- `entitlement.js` async (s. o.) ersetzt den Plan-1-Stub; `app.js`: Startfluss refresht den Zugang im
  Hintergrund (nur bei Session) und frischt die Auswahl auf; **Paywall mit Magic-Link-Login** (E-Mail →
  `anfordern`), Kauf-Button **deaktiviert bis Plan 3**, **Abmelden** bei Session. `state.view`-Guard gegen Stör-Render.
- Browser-verifiziert: Free-Tier ohne Login/ohne API-Call; Cache-first-Unlock (HTTP-Fehler behält Cache);
  Login ruft `POST /api/auth/request`; Fehlerzustand; Logout löscht Session+Cache. Happy-Path gegen echte
  API ist über Plan-2a-Integrationstest belegt; voller Browser-E2E kommt mit dem Prod-Deploy.
- **Prod-Deploy erledigt:** Alle 5 Vercel-Production-Env-Variablen gesetzt (`DATABASE_URL`,
  `RESEND_API_KEY`, `MAIL_FROM`, `ADMIN_SECRET`, `APP_URL=https://hpp-app-one.vercel.app`), `vercel --prod`
  deployed, **Prod-E2E grün** (request 200 · entitlement ohne Token false · Admin-Grant 200 · danach true).
  Die Live-API läuft gegen dieselbe Neon-DB. **Lokales Dev für API+Frontend: `vercel dev`** (launch.json
  `hpp-vercel`); Static-Server `hpp-app` (8123) zeigt nur das Free-Tier (API-Calls 404).
- **Nächstes:** Plan 3 (Stripe — ersetzt den Admin-Grant-Schreibpfad, `hatZugang()` bleibt). Go-Live-Blocker
  separat: Rechtstexte (Impressum/DSGVO/AGB/Widerruf) + IP-Frage zu Originalfragen. `vercel`-CLI liegt unter
  `/Users/cwick/.npm-global/bin/vercel` (nicht immer im PATH der Shell — ggf. absoluter Pfad).

**PWA (Spec/Plan `2026-06-23-pwa*`)** — **fertig + live.** `app/manifest.webmanifest` (name „HPP-Prüfungstraining",
short_name „HPP Training", standalone), App-Icon „Gürtel-Streifen" (`icon.svg` → committete PNGs 192/512 maskable
+ `apple-touch-icon.png` 180, erzeugt via `qlmanage`+`sips`), Service Worker `app/sw.js` (App-Shell cache-first,
`/api/*` network-only, Cache `hpp-v1` mit Versions-Cleanup), index.html mit Manifest/Theme/Apple-Meta + SW-Registrierung.
Installierbar (iOS „Zum Home-Bildschirm"); Free-Tier offline (alle 12 Shell-Dateien im Cache).
**`data.js` wird network-first ausgeliefert** (neue Fragen kommen automatisch an, Cache nur Offline-Fallback);
übrige Shell cache-first. **Bei Code-Änderungen an der Shell `CACHE_NAME` in `sw.js` hochzählen** (aktuell `hpp-v3`).

**Dark Mode (Spec `2026-06-24-darkmode-design.md`, Plan `2026-06-24-darkmode.md`) — fertig + live (2026-06-24).**
3-Zustands-Umschalter **Auto → Hell → Dunkel** (Knopf in `.kopf`, Icons ☀️/🌙/🌗), Default `auto` folgt
`prefers-color-scheme`. Speicherung in `localStorage hpp_theme`. Reine Logik in `logic.js`
(`themaAufgeloest(pref, systemDark)`, `naechstesThema(aktuell)` Zyklus, getestet). DOM-Controller
**`app/theme.js`** (`window.HPP_THEME = {pref, anwenden, umschalten}`): löst „auto" via `matchMedia` auf,
setzt `data-theme="light|dark"` auf `<html>` + `theme-color`-Meta (`#f7f6f3`/`#15181c`), `matchMedia`-Listener
nur bei `pref==="auto"`. **Kein Flackern:** winziges Inline-Skript im `<head>` vor dem Stylesheet setzt
`data-theme` vor dem Paint. CSS: helle Palette in `:root`, dunkle in `:root[data-theme="dark"]`,
plus **`color-scheme` light/dark** (themt native Form-Controls — sonst weißes Login-Feld im Dark Mode).
**Hardcoded-Farben-Audit:** 15 Stellen auf neue Variablen umgestellt (`--soft-bg --warn-soft --chip-bg
--ltr-ink --hero-leer-bg --punkt-ring`); Gürtel-Markenfarben bleiben unverändert. Hell-Werte byte-identisch
außer `.badge.zero` (#efede8→#ece9e3, laut Spec gewollt). theme.js in SW-SHELL, `CACHE_NAME` → `hpp-v3`.
Browser-verifiziert (Hell+Dunkel auf Auswahl/Prüfung/Paywall, Toggle-Zyklus, Persistenz, No-Flicker, keine
Inseln, keine Konsolenfehler). Hinweis: Preview-`colorScheme`-Emulation feuert **kein** `matchMedia`-`change`
(CDP-Limitierung) — Auto-Follow ist code-verifiziert, greift bei echtem OS-Wechsel.

**Bugfix Übungsmodus (2026-06-23):** „Jetzt üben" spielte nur die heute fälligen SRS-Karten → fühlte sich
repetitiv an. Neu: `L.baueUebenSession(faellige, alle, 20, idFn)` füllt fällige Karten mit frischen,
ungesehenen auf Ziel 20 auf (SRS bleibt, mehr Abwechslung). Themen-Kacheln unverändert. Außerdem behoben:
SW lieferte `data.js` cache-first → veralteter, kleinerer Fragensatz (15 statt 23 Prüfungen); jetzt network-first.

**Tests:** `npm test` (= `node --test app/*.test.js api/_lib/*.test.js`) → **49 grün**. Backend-Endpunkte sind
integrationsgeprüft (reine Helfer + entitlement.js + Manifest + baueUebenSession sind unit-getestet).
**Daten:** 4 Prüfungen `guertel_komplett` (2026-03, 2025-10, 2025-03, 2024-10), 112 Fragen, alle mit
gültigem `themenbereich`, alle Schwarz-Lösungen == `fragen_original.json`, 0 inhaltsbasierte
Cross-Prüfungs-Dubletten.

## Dateien (App, alles in `app/`, Vanilla JS, kein Build)

- `index.html` lädt `styles.css`, `data.js`, `logic.js`, `srs.js`, `entitlement.js`, `app.js` (genau diese Reihenfolge).
- `entitlement.js` — UMD, **async (Plan 2b)**: `lade` (Cache `hpp_entitlement` = `{hatZugang,kind,activeUntil}`,
  instant/offline), `refresh(storage,fetchFn)` (→ `GET /api/entitlement`, hält Cache bei Netz-/HTTP-Fehler),
  `anfordern(email,fetchFn)`, `abmelden(storage,fetchFn)`, `ladeSession` (`hpp_session`). `hatZugang(ent)` sync (Render). Getestet (10).
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
- ~~**Dark Mode**~~ — **fertig + live (2026-06-24)**, siehe unten.
- Kleinere App.js-Hygiene aus dem finalen Review (z. B. doppeltes `heute()` vs `L.heuteIso()`,
  `state.pruefung` nach Abgabe nicht genullt) — nachweislich harmlos, bewusst nicht angefasst.
- Restliche ~40 Original-Prüfungen noch nicht über alle Gürtel übersetzt (Daten-Pipeline).

## Arbeitsweise (Konventionen dieser Zusammenarbeit)

- Pläne werden **subagent-getrieben** ausgeführt (frischer Subagent pro Task, Reviews dazwischen).
- Beim Brainstorming wird der **Visual Companion** proaktiv genutzt (keine Erlaubnis-Nachfrage).
- Neue Features: erst Brainstorm → Spec → Plan → Umsetzung (superpowers-Flow).
