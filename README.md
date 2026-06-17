# HPP-Prüfungstraining mit Gürtelsystem

Lern-App für die schriftliche Überprüfung **Heilpraktiker für Psychotherapie**. Dieselbe Prüfungsfrage auf fünf Schwierigkeitsstufen (Karate-Gürtelsystem): von **Gelb** (Grundwissen) bis **Schwarz** (Original-Prüfungsfrage).

## Projektstruktur

| Pfad | Inhalt |
|---|---|
| `CLAUDE.md` | Zentraler Kontext für Claude Code (hier zuerst lesen) |
| `Projektplan_HPP-Guertelsystem.md` | Fachlicher Plan + Gürtel-Rezeptur (v5) |
| `Schriftliche Prüfing/` | 44 Original-Prüfungen 2004–2026 als Rohtext |
| `daten/` | Strukturierte Fragen (JSON), Manifest, Parser |
| `docs/` | App-Spezifikation und Datenschema |
| `app/` | Die Web-App (wird hier gebaut) |

## Stand

- 44 Original-Prüfungen beschafft und strukturiert (`daten/fragen_original.json`).
- 1 Prüfung (März 2026) komplett über alle fünf Gürtel übersetzt und geprüft (`daten/fragen_2026-03.json`).
- App noch zu bauen — Spezifikation in `docs/APP_SPEC.md`.

## Entwicklung starten (Claude Code)

1. `CLAUDE.md` und `docs/APP_SPEC.md` lesen.
2. App-Gerüst in `app/index.html` anlegen (Gürtelauswahl + Quiz für eine Prüfung).
3. Lokal testen, z. B. `python3 -m http.server` im Projektordner, dann `http://localhost:8000/app/`.

## Hinweis

Die Lösungen stammen aus den veröffentlichten Original-Prüfungen (Angaben ohne Gewähr). Die Gürtel-Übersetzungen sind didaktische Eigenformulierungen zum selben Wissenskern.
