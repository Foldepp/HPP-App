# Design: PWA „HPP Training" (installierbar + offline)

**Datum:** 2026-06-23
**Status:** Entwurf (in Brainstorm-Sitzung bestätigt)
**Scope:** Die bestehende Web-App zu einer installierbaren Progressive Web App machen — App-Icon
auf dem Home-Bildschirm, Standalone-Start, Free-Tier offline lauffähig.

## 1. Ziel

Der Nutzer soll die App vom Home-Bildschirm wie eine native App starten und unterwegs auch ohne
Netz im Free-Tier (Gelb/Grün) lernen können. Kein App-Store, keine Build-Kette — reine Erweiterung
der statischen Vanilla-App.

## 2. Entscheidungen

- **Name:** `name` = „HPP-Prüfungstraining", `short_name` = „HPP Training" (Home-Bildschirm).
- **Icon:** Motiv „Gürtel-Streifen" — gerundetes Quadrat, fünf horizontale Bänder in den Stufenfarben
  (`#f2c200` Gelb, `#3aa655` Grün, `#2b6cb0` Blau, `#8b5e3c` Braun, `#26303a` Schwarz) auf hellem Grund.
- **Farben:** `background_color` und `theme_color` = `#f7f6f3` (App-Hintergrund, nahtloser Look).
- **Anzeige:** `display` = `standalone`, `start_url` = `/`.
- **Offline-Umfang:** App-Shell + Daten (Free-Tier voll offline). `/api/*` nie cachen.

## 3. Komponenten

### 3.1 Manifest — `app/manifest.webmanifest`
Gültiges JSON mit: `name`, `short_name`, `start_url:"/"`, `display:"standalone"`,
`background_color:"#f7f6f3"`, `theme_color:"#f7f6f3"`, `icons` (mindestens 192×192 und 512×512,
`purpose:"any maskable"`), `lang:"de"`.

### 3.2 Icons (in `app/`)
- Quell-SVG `icon.svg` (Gürtel-Streifen-Motiv, zentriert mit Sicherheitsrand für „maskable").
- Generierte PNGs (einmal erzeugt, committet): `icon-192.png`, `icon-512.png` (Manifest, maskable)
  und `apple-touch-icon.png` (180×180) — Letzteres nötig, weil iOS das Manifest fürs Home-Icon
  ignoriert und stattdessen `apple-touch-icon` nutzt. Maskable-Sicherheitszone: wichtiges Motiv
  innerhalb der zentralen ~80 %.

### 3.3 Service Worker — `app/sw.js`
- **Precache (install):** App-Shell — `/`, `index.html`, `styles.css`, `data.js`, `logic.js`,
  `srs.js`, `entitlement.js`, `app.js`, `manifest.webmanifest`, die Icons.
- **Fetch-Strategie:** Für **Navigations- und Shell-Requests cache-first** (Cache → sonst Netz →
  Cache aktualisieren). Für **`/api/*` network-only** (kein Abfangen, kein Cachen) — der
  Entitlement-/Login-Pfad muss immer live sein; `entitlement.js` behält bei Netzfehler ohnehin den Cache.
- **Versionierung:** Konstante `CACHE_NAME` mit Versionsnummer; beim `activate` alte Caches löschen.
  Code-Update = Version hochzählen → Nutzer bekommen frische Dateien. Ersetzt die alte
  `http.server`-Cache-Falle (kein `?v=`-Trick mehr nötig).

### 3.4 `index.html`
Ergänzen: `<link rel="manifest" href="manifest.webmanifest">`, `<meta name="theme-color" content="#f7f6f3">`,
`<link rel="apple-touch-icon" href="apple-touch-icon.png">`, `<meta name="apple-mobile-web-app-capable" content="yes">`,
`<meta name="apple-mobile-web-app-title" content="HPP Training">`, sowie eine Service-Worker-Registrierung
(`navigator.serviceWorker.register("/sw.js")`, defensiv mit Feature-Check).

## 4. Erfolgskriterien

- Manifest wird vom Browser erkannt; App ist „installierbar" (Chrome DevTools/Lighthouse „Installable").
- Auf iOS via „Zum Home-Bildschirm" erscheint das Gürtel-Icon und „HPP Training", Start im Standalone-Look.
- Nach einmaligem Laden funktioniert das **Free-Tier offline** (Flugmodus → App neu starten → Gelb/Grün
  nutzbar).
- `/api/*`-Aufrufe werden nicht vom Service Worker gecacht (Login/Entitlement bleiben live).
- Ein Code-Update (neue `CACHE_NAME`-Version) liefert nach Reload die neuen Dateien aus.

## 5. Verifikation / Tests

- **Unit:** `manifest.webmanifest` ist valides JSON und enthält die Pflichtfelder (`node:test`).
- **Browser (Koordinator):** App laden, DevTools → Application → Manifest erkannt, Service Worker
  registriert/aktiv; Offline-Reload des Free-Tiers; Icon-Vorschau. Auf Produktion deployen und
  „Installierbar" prüfen.

## 6. Bewusst NICHT in Scope

Push-Notifications, Background-Sync, App-Store-Pakete (Capacitor/TWA), Offline-Caching der
Bezahl-Inhalte/API. Reine Installierbarkeit + Free-Tier-Offline.

## 7. Offen für die Plan-Phase

- Konkretes Werkzeug zur PNG-Generierung aus dem Quell-SVG (vorhandenes CLI prüfen: `rsvg-convert` /
  ImageMagick `magick` / `sips`; sonst einmaliges Node-Skript mit Encoder). Die erzeugten PNGs werden
  committet, damit kein Build nötig ist.
- Genaue Liste der Precache-URLs an die tatsächlichen Dateinamen angleichen.
