# Design: Dark Mode

**Datum:** 2026-06-24
**Status:** Entwurf — in Brainstorm-Sitzung bis zur Palette bestätigt; **nächster Schritt: writing-plans → subagent-getriebene Umsetzung.**
**Kontext:** Die App nutzt durchgängig CSS-Variablen (`:root` in `app/styles.css`), Dark Mode ist daher
v. a. eine zweite Palette + Auslöser + ein Audit der noch hartkodierten Farben.

## 1. Auslöser (vom Nutzer entschieden: „System + manueller Override")
- `localStorage hpp_theme` = `auto | hell | dunkel`. Default **`auto`** folgt `prefers-color-scheme`.
- Ein JS-Theme-Modul löst „auto" via `matchMedia('(prefers-color-scheme: dark)')` auf und setzt
  `data-theme="dark"` bzw. `"light"` auf `<html>`. Bei „auto" auf System-Wechsel reagieren (matchMedia-Listener);
  bei „hell"/„dunkel" fest.
- **Kein Flackern:** winziges Inline-Skript im `<head>` (vor dem CSS-Paint) liest `hpp_theme` und setzt
  `data-theme` sofort.

## 2. CSS-Struktur
- Helle Variablen bleiben in `:root`. Dunkle Overrides in `:root[data-theme="dark"]`.
- Das JS löst „auto" immer zu `data-theme="dark|light"` auf → CSS braucht **keine** `@media`-Dopplung.
- **Hardcoded-Farben-Audit (wichtig):** Diese Stellen in `app/styles.css` sind noch hartkodiert und
  müssen auf neue Variablen umgestellt werden, sonst bleiben helle Inseln im Dark Mode:
  - `#faf9f6` (`.aussagen`, `.rev-kern`) → `--soft-bg`
  - `#fdf0ea` (`.fb.bad`, `.ex-opt.falschgewaehlt`, `.erg-badge.fail`) → `--warn-soft`
  - `#ece9e3` (`.seg`, `.th-chip`), `#efede8` (`.badge.zero`) → `--chip-bg`
  - `#5a6772` (`.ex-opt .ltr` Textfarbe) → `--ltr-ink`
  - `#5a7184` (`.hero-leer`) → `--hero-leer-bg`
  - Gürtel-Punkt-Ring `inset 0 0 0 2px rgba(0,0,0,.08)` → Variable, im Dark `rgba(255,255,255,.15)`

## 3. Dunkle Palette (aus dem bestätigten Mockup)
Gürtelfarben (`--g-gelb/gruen/blau/braun/schwarz`) bleiben unverändert (Marke).
```
--bg: #15181c;  --card: #1e2429;  --ink: #e8eaed;  --muted: #93a0ad;
--line: #2c343b;  --accent: #3aa655;  --accent-soft: #1b3524;
--warn: #e2683a;  --warn-soft: #3a2018;  --ink-soft: #2a3138;
--soft-bg: #1a1f24;  --chip-bg: #252c33;  --ltr-ink: #c2ccd6;  --hero-leer-bg: #2c3946;
```
(Werte sind Startpunkt; im Browser final gegenchecken — Kontrast/Lesbarkeit.)

## 4. Umschalter-UI
Kleiner Knopf in der Levelauswahl-Kopfzeile (`.kopf`), der **Auto → Hell → Dunkel** durchschaltet
(Icon/Label, z. B. ☀️/🌙/„Auto"), Wahl sofort wirksam + in `hpp_theme` gespeichert.

## 5. PWA-Statusleiste
`<meta name="theme-color">` passend zum aktiven Modus setzen (hell `#f7f6f3` / dunkel `#15181c`),
beim Umschalten aktualisieren.

## 6. Tests / Verifikation
- **Unit (`node:test`, in `logic.js`):** reine Theme-Logik —
  `themaAufgeloest(pref, systemDark)` → `"hell"|"dunkel"` und `naechstesThema(aktuell)` (Zyklus
  auto→hell→dunkel→auto).
- **Browser (Koordinator):** beide Modi prüfen (preview unterstützt `colorScheme`-Emulation), alle
  Screens (Auswahl, Prüfung, Übersicht, Auswertung, Durchsicht, Dashboard, Karte, Paywall) auf helle
  Inseln durchsehen; Toggle + Persistenz; kein Flackern beim Laden.

## 7. Bewusst NICHT in Scope
Zeitgesteuertes Auto-Umschalten in der App selbst (macht das OS), pro-Element-Themes, mehrere
Farbschemata.

## 8. Resume-Hinweis (für neuen Chat)
Design abgenommen bis Palette. **Nächste Schritte:** `superpowers:writing-plans` → Plan →
subagent-getriebene Umsetzung (eigener Branch, zweistufiges Review), dann Browser-Verifikation + Deploy
(`vercel --prod`, ggf. `CACHE_NAME` in `app/sw.js` hochzählen wegen Shell-Änderung). Tests-Stand vorher: 47 grün.
