# CLAUDE.md — HPP-Prüfungstraining mit Gürtelsystem

Diese Datei ist der zentrale Kontext für Claude Code. Sie beschreibt **was** wir bauen, **welche Daten** vorhanden sind und **welche Regeln** gelten.

## 1. Projektziel

Eine Lern-App für die schriftliche amtsärztliche Überprüfung **Heilpraktiker für Psychotherapie (HPP)**. Kernidee: ein **Gürtelsystem wie beim Karate**. Dieselbe Prüfungsfrage existiert auf mehreren Schwierigkeitsstufen; man arbeitet sich von leicht bis zum Original hoch.

Der ausführliche fachliche Plan steht in `Projektplan_HPP-Guertelsystem.md` (immer dort die aktuelle Gürtel-Rezeptur nachschlagen).

## 2. Eckdaten der echten Prüfung

- **28 Multiple-Choice-Fragen**, 60 Minuten.
- **Bestehensgrenze: 21 von 28 richtig (75 %)**.
- Drei Fragetypen:
  - **Einfachauswahl** — genau eine richtige Antwort (A–E).
  - **Mehrfachauswahl** — „Wählen Sie zwei Antworten!" (zwei richtige).
  - **Aussagenkombination** — nummerierte Aussagen (1–5) + Antwortkombinationen (A–E, z. B. „nur 1 und 4").

## 3. Das Gürtelsystem (Rezeptur v5 — finaler Stand)

Fünf Stufen, aufsteigend: **Gelb → Grün → Blau → Braun → Schwarz**.

| Gürtel | Kognitive Tiefe | Form |
|---|---|---|
| **Gelb** | Einstieg: solides Grundwissen; einen Begriff/Fakt kennen | Einfachauswahl; Distraktoren = echte, aber falsch zugeordnete Fachbegriffe |
| **Grün** | Verstehen/Anwenden; MUSS Unterscheidungs- oder Anwendungs-Dreh haben (zwei Konzepte abgrenzen ODER Mini-Fall); nie nur die Gelb-Tatsache | Einfachauswahl; Optionen sind ganze Aussagen; Distraktoren = plausible Denkfehler |
| **Blau** | Fast Prüfungsniveau; feine Differenzierung | Aussagenkombination, 4 Aussagen, subtile Distraktoren |
| **Braun** | Prüfungsecht, neu formuliert; eine Stufe unter dem Original | Volles Prüfungsformat (bis 5 Aussagen / 5 Kombinationen) |
| **Schwarz** | **Original-Prüfungsfrage, unverändert** | Original |

Wichtig: Die niedrigeren Gürtel sind **echte Übersetzungen** desselben Wissenskerns — NICHT die gekürzte Originalfrage. Schwarz ist immer die wortgetreue Originalfrage.

## 4. Daten

```
Schriftliche Prüfing/   44 Original-Prüfungen 2004–2026 als Rohtext (HPP_YYYY-MM_*.txt)
daten/
  fragen_original.json  alle 44 Prüfungen, strukturiert (nur Originalfragen = Schwarz)
  fragen_2026-03.json   EINE Prüfung komplett über alle 5 Gürtel (Pilot)
  index.json            Manifest: welche Prüfungen mit Gürteln verfügbar sind
  parse_hpp.py          Skript: Rohtext -> fragen_original.json (reproduzierbar)
docs/
  APP_SPEC.md           Feature-Spezifikation der App
  DATENSCHEMA.md        JSON-Struktur im Detail
app/                    HIER die Web-App bauen (Ziel: app/index.html)
```

Datenstand: **1 von 44 Prüfungen** ist über alle Gürtel übersetzt (`fragen_2026-03.json`). Die übrigen 43 liegen als Original in `fragen_original.json` und werden später nach derselben Rezeptur übersetzt. Die App muss damit umgehen, dass nur ein Teil der Prüfungen voll übersetzt ist (siehe `daten/index.json`).

Schema-Details in `docs/DATENSCHEMA.md`. Kurz: `fragen_2026-03.json` → `fragen[].stufen.{gelb,gruen,blau,braun,schwarz}`, jede Stufe mit `typ`, `stamm`, `aussagen` (oder null), `optionen` (A–E), `loesung` (Liste von Buchstaben).

## 5. Was zu bauen ist (App)

Details in `docs/APP_SPEC.md`. Kurzfassung:
- **Prüfungsmodus:** 28 Fragen einer Stufe, 60-Minuten-Timer, Auswertung gegen 21/28.
- **Gürtel-Fortschritt:** bestandene Stufe schaltet die nächste frei; aktueller Gürtel wird gespeichert.
- **Übungsmodus:** einzelne Fragen/Themen üben, Erklärung + Lösung nach jeder Antwort.
- **Statistik:** Trefferquote je Themenfeld.

## 6. Technische Leitplanken

- **Offline lauffähig, kein Pflicht-Backend.** Vanilla HTML/CSS/JS bevorzugt (keine schweren Frameworks), damit es ohne Build-Kette läuft.
- **Fortschritt** über `localStorage` speichern (aktueller Gürtel, Statistik).
- **Datenladen:** Beim Öffnen per `file://` kann `fetch` auf lokale JSON scheitern. Lösung: entweder die JSON in eine JS-Datei wrappen (`window.HPP_DATA = …`) ODER zum Entwickeln lokal serven (`python3 -m http.server` im Projektordner). Im Zweifel die JS-Wrap-Variante wählen, damit die App per Doppelklick startet.
- **Sprache der Oberfläche: Deutsch.**
- **Korrektheit ist kritisch:** Lösungen niemals raten/ändern. Schwarz-Stufe = Original; bei Diskrepanz `fragen_original.json` als Quelle nehmen.

## 7. Konventionen

- Antwortauswertung: Eine Antwort ist richtig, wenn die gewählte Buchstaben-Menge exakt der `loesung`-Liste entspricht (auch bei Mehrfachauswahl / Aussagenkombination).
- Gürtel-Reihenfolge im Code: `["gelb","gruen","blau","braun","schwarz"]`.
- Keine echten Personen-/Patientendaten erfinden, die über den Prüfungsstil hinausgehen.

## 8. Aktueller Stand / nächster Schritt

Erledigt: Datenbeschaffung (44 Prüfungen), Parsing, Pilot-Übersetzung März 2026 über alle Gürtel, Verifikation der Lösungen.
Nächster Schritt für Claude Code: **App-Grundgerüst in `app/index.html`** mit Gürtelauswahl + Quiz für eine Prüfung (`fragen_2026-03.json`), dann Prüfungsmodus mit Timer und Auswertung.
