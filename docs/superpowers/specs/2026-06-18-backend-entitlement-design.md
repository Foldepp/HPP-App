# Design: Backend — Identität, Magic-Link & Entitlement (Monetarisierung Plan 2)

**Datum:** 2026-06-18
**Status:** Entwurf (in Brainstorm-Sitzung bestätigt; Entscheidungen vom Nutzer delegiert)
**Übergeordnete Spec:** `docs/superpowers/specs/2026-06-18-monetarisierung-design.md` (Modell C,
Soft-Gating, E-Mail-Identität, Magic Link, Neon/Postgres).
**Vorgänger:** Plan 1 (`2026-06-18-freemium-gating-frontend.md`) — Frontend-Gating gegen lokalen
`entitlement.js`-Stub. Plan 2 ersetzt den Stub durch echte Server-Abfragen.
**Nachfolger:** Plan 3 (Stripe) — schreibt echte Entitlements; ersetzt nur den Admin-Grant-Schreibpfad.

## 1. Ziel & Scope

Backend bauen, das **Identität (per Magic-Link), einen Entitlement-Speicher (Neon Postgres) und eine
Zugangs-Prüfung** bereitstellt, und das Frontend so umbauen, dass der Bezahl-Zugang serverseitig
statt lokal entschieden wird. **Ohne Stripe** — Entitlements entstehen in Plan 2 über einen
geschützten **Admin-Grant** (testbar; später für Freigaben an Tester/Support nützlich).

**In Scope:** Schema, Auth-Endpunkte (request/verify/logout), Entitlement-Endpoint, Admin-Grant,
Resend-Mailversand, async-Umbau von `entitlement.js`, Login-UI in der Paywall.
**Nicht in Scope (bewusst):** Stripe/Bezahlung (Plan 3); Fortschritts-Sync zwischen Geräten
(spätere Sync-Spec); Rechtstexte + IP-Frage (separater Go-Live-Strang); eigene Absender-Domain
(erst zum Launch — Test läuft über Resends Test-Domain an die eigene Adresse).

## 2. Architektur-Entscheidungen

- **E-Mail-Dienst: Resend.** Gratis-Tier, entwicklerfreundlich, gute Vercel-Integration. Test über
  Resend-Test-Domain (nur an eigene verifizierte Adresse); eigene Domain erst beim Launch.
- **Token-/Session-Modell: opake Zufalls-Tokens in der DB (nicht JWT).** Beim Verify wird ein
  langlebiger Token erzeugt, als **Hash** in `sessions` gespeichert, ans Gerät gegeben. Jede Prüfung
  schlägt den Token-Hash nach. Gewählt, weil **persistenter Login + Widerrufbarkeit** ("überall
  abmelden" = Session-Zeile löschen) genau das ist, was opake DB-Tokens billig liefern; JWTs
  Hauptvorteil (kein DB-Lookup) ist bei dieser Last irrelevant und kollidiert mit Widerrufbarkeit.
- **Login-Persistenz: dauerhaft** — eingeloggt bis aktiver Logout oder Speicher-Löschung. Der
  Abo-Status (`entitlement`) wird davon getrennt bei jedem Start frisch geprüft.
- **Bleibt auf Vercel:** Serverless Functions unter `api/`, Neon als verwaltetes Postgres.
- **Neon-Zugriff** über `@neondatabase/serverless` (HTTP-Treiber, passt zu Serverless Functions).

## 3. Datenmodell (Neon Postgres)

Token werden **nur als Hash** (SHA-256) gespeichert, nie im Klartext.

- `entitlements`
  - `email` text PRIMARY KEY
  - `kind` text NOT NULL CHECK (`kind` IN ('abo','lifetime'))
  - `active_until` timestamptz NULL  (NULL = lifetime / unbegrenzt)
  - `updated_at` timestamptz NOT NULL DEFAULT now()
  - Zugang aktiv ⇔ `kind = 'lifetime'` ODER `active_until > now()`.
- `magic_links`
  - `token_hash` text PRIMARY KEY
  - `email` text NOT NULL
  - `expires_at` timestamptz NOT NULL  (~15 Minuten nach Erstellung)
  - `used_at` timestamptz NULL  (gesetzt beim Einlösen → Einmal-Gebrauch)
- `sessions`
  - `token_hash` text PRIMARY KEY
  - `email` text NOT NULL
  - `created_at` timestamptz NOT NULL DEFAULT now()
  - `last_seen_at` timestamptz NOT NULL DEFAULT now()

Schema als versioniertes SQL im Repo (`api/_db/schema.sql`), einmalig gegen Neon eingespielt.

## 4. API-Endpunkte (Vercel Serverless Functions, `api/`)

Handler bleiben dünn und rufen reine Helfer (Abschnitt 6). JSON-Antworten.

- `POST /api/auth/request` — Body `{ email }`. Legt `magic_links`-Eintrag an (Roh-Token erzeugt,
  Hash gespeichert), sendet via Resend eine Mail mit Link `${APP_URL}/api/auth/verify?token=<roh>`.
  **Antwortet immer `200 {ok:true}`** (keine E-Mail-Enumeration), auch bei unbekannter Adresse.
- `GET /api/auth/verify?token=…` — validiert: existiert, `used_at IS NULL`, `expires_at > now()`.
  Wenn gültig: `used_at` setzen, neue Session anlegen (Roh-Session-Token erzeugen, Hash speichern).
  Liefert eine **minimale HTML-Seite**, die den Roh-Session-Token in `localStorage` (`hpp_session`)
  schreibt und auf `/` weiterleitet — so landet der Token **nicht** in URL/History. Bei ungültig:
  HTML mit Hinweis "Link abgelaufen/ungültig — neu anfordern".
- `GET /api/entitlement` — Session-Token im Header `Authorization: Bearer <token>`. Schlägt Session
  nach (Hash) → E-Mail → Entitlement. Antwort `{ hatZugang: bool, kind: string|null,
  activeUntil: string|null }`. Aktualisiert `last_seen_at`. Ohne/ungültige Session: `{hatZugang:false}`.
- `POST /api/auth/logout` — Header `Authorization: Bearer <token>`. Löscht die Session-Zeile.
  Antwort `{ok:true}`.
- `POST /api/admin/grant` — Header `Authorization: Bearer <ADMIN_SECRET>`. Body
  `{ email, kind, activeUntil? }`. Upsert in `entitlements`. Für Tests + manuelle Freigaben.
  Falscher/kein Secret → `401`.

## 5. Frontend-Integration

Der zentrale Umbau: heute prüft `app.js` `hatZugang()` **synchron** gegen den lokalen Stub.

- **`entitlement.js` wird async-fähig**, behält aber die **synchrone Lese-Schnittstelle `hatZugang(ent)`
  aus Plan 1** (Aufrufer in `app.js` bleiben unverändert). Neu:
  - Persistenz: `hpp_session` (Token) + `hpp_entitlement` (gecachter letzter Server-Stand
    `{hatZugang, kind, activeUntil}`) in localStorage.
  - `lade(storage)` liest den **gecachten** Stand → sofortiges Rendern + Free-Tier offline.
  - `refresh()` (async): ruft `GET /api/entitlement` mit dem Session-Token, schreibt den Cache,
    gibt den neuen Stand zurück. Bei Netzfehler: Cache behalten (Free-Tier bleibt nutzbar).
  - `anfordern(email)` → `POST /api/auth/request`; `abmelden()` → `POST /api/auth/logout` +
    Cache/Session leeren; `entsperreStub` aus Plan 1 entfällt.
- **Startfluss in `app.js`:** sofort mit Cache rendern; danach `refresh()` im Hintergrund; bei
  geänderten Zugang neu rendern. Beim Laden mit frischer Session (nach Verify-Redirect) ebenso.
- **Paywall-UI:** „Schon Zugang? Anmelden" → E-Mail-Feld → `anfordern(email)` → „Schau in dein
  Postfach". Der eigentliche **Kauf-Button bleibt deaktiviert mit Hinweis „kommt bald"** bis Plan 3.
  Zusätzlich „Abmelden" sichtbar, wenn eingeloggt.

## 6. Reine, getestete Logik (Muster wie `logic.js`)

Als pure Funktionen mit `node:test`, getrennt von den Vercel-Handlern:
- `hashToken(roh)` → SHA-256-Hex (Node `crypto`).
- `zugangAktiv(kind, activeUntil, nowIso)` → bool (lifetime ODER activeUntil > now). Server-Logik;
  bewusst anders benannt als die Frontend-Lesefunktion `hatZugang(ent)` aus `entitlement.js`.
- `magicLinkGueltig(eintrag, nowIso)` → bool (existiert, nicht genutzt, nicht abgelaufen).
- `tokenErzeugen()` → kryptografisch sicherer Zufalls-Token (Node `crypto.randomBytes`).
Die DB-/HTTP-Handler rufen diese Helfer; getestet wird die Logik, nicht der Netzpfad.

## 7. Secrets / Konfiguration (Vercel Env)

`DATABASE_URL` (Neon), `RESEND_API_KEY`, `ADMIN_SECRET`, `APP_URL`. Lokal über `.env` (gitignored),
in Vercel über Project-Env. Keine Secrets im Repo.

## 8. Sicherheit

- Token (Magic-Link **und** Session) nur als Hash gespeichert.
- Magic-Links kurzlebig (~15 Min) + einmalig (`used_at`).
- Keine E-Mail-Enumeration (request antwortet immer gleich).
- Session-Token kryptografisch zufällig, ausreichend lang.
- Admin-Grant nur mit `ADMIN_SECRET`.
- HTTPS via Vercel; gleiche Origin → kein CORS nötig.
- Einfaches Rate-Limit auf `/api/auth/request` wünschenswert (Detail in Plan-Phase).

## 9. Erfolgskriterien

- Nutzer fordert per E-Mail einen Magic-Link an, klickt ihn, ist danach **dauerhaft** auf dem Gerät
  eingeloggt (Session in `localStorage`).
- `GET /api/entitlement` liefert für eine per Admin-Grant freigeschaltete E-Mail `hatZugang:true`,
  sonst `false`; ein abgelaufenes `abo` (`active_until` in der Vergangenheit) → `false`, Lifetime → `true`.
- Frontend: gecachter Stand rendert sofort, Server-Refresh aktualisiert; Bezahlstufen genau dann frei,
  wenn der Server Zugang bestätigt. Free-Tier funktioniert weiter **ohne Login und offline**.
- „Abmelden" entfernt Session + Cache → Bezahlstufen wieder gesperrt (Rückfall auf Free-Tier).
- Magic-Link ist nach einmaligem Gebrauch und nach Ablauf ungültig.

## 10. Scope-Schnitt für die Plan-Phase

Eine Spec, zwei Task-Blöcke:
- **2a — Backend:** Schema, `@neondatabase/serverless`-Anbindung, reine Helfer (Abschnitt 6) mit Tests,
  die fünf Endpunkte, Resend-Versand. Eigenständig testbar (curl + Admin-Grant), unabhängig vom Frontend.
- **2b — Frontend-Integration:** async-`entitlement.js`, Startfluss-Umbau in `app.js`, Login-/Abmelden-UI
  in der Paywall.

**Bewusst NICHT:** Stripe (Plan 3), Fortschritts-Sync, Rechtstexte/IP-Frage, eigene Absender-Domain.

## 11. Offene Punkte für die Implementierungs-Planung

- Genaue Magic-Link-TTL und Session-Inaktivitäts-Politik (Default: TTL 15 Min; Session ohne
  Inaktivitäts-Ablauf, nur Logout).
- Form des Rate-Limits auf `/api/auth/request` (z. B. pro IP/E-Mail, einfacher Zähler).
- Resend-Absender für die Testphase (Test-Domain + eigene Adresse) vs. Launch-Domain.
- Aufräumen abgelaufener `magic_links`/`sessions` (Lazy beim Zugriff vs. periodisch).
