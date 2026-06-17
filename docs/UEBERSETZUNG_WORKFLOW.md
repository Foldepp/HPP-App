# Übersetzungs-Workflow: eine Prüfung über alle 5 Gürtel

Reproduzierbarer Ablauf, mit dem März 2026 und Oktober 2025 erstellt wurden. Genau so weitermachen, dann bleibt die Qualität gleich.

## Überblick

Pro Prüfung: 28 Originalfragen → je 5 Gürtelstufen (Gelb, Grün, Blau, Braun, Schwarz). Schwarz = Original 1:1. Die Arbeit wird auf **4 parallele Subagenten (Modell: Sonnet)** verteilt (je 7 Fragen), dann mit einem **Skript** gemerged, gerendert und verifiziert. Der Hauptchat generiert keine Fragen selbst (spart Tokens und hält den Kontext klein).

## Schritt 1 — 4 Subagenten starten (je 7 Fragen)

Quelle ist `daten/fragen_original.json` (enthält alle 44 Prüfungen). Für die Zielprüfung die `pruefung_id` heraussuchen (z. B. `2025-03_Maerz`). Vier Agenten mit Fragebereichen 1–7, 8–14, 15–21, 22–28 starten. Jeder schreibt nach `daten/_belt_part_1.json` … `_belt_part_4.json`.

**Exakter Subagenten-Prompt** (Platzhalter `<PID>`, `<VON>`, `<BIS>`, `<N>` ersetzen):

```
Du übersetzt HPP-Prüfungsfragen in ein Gürtel-Lernsystem. Präzise, medizinisch korrekt, Deutsch.

QUELLE: Lies /Users/cwick/projects/HPP-App/daten/fragen_original.json. Finde "pruefung_id" == "<PID>". Nimm Fragen nr <VON> bis <BIS>.

Erzeuge je Frage 5 Stufen zum selben Wissenskern (NICHT die Originalfrage kürzen, sondern je Stufe eine eigene Frage auf passendem Niveau):
- "gelb" (Einstieg): Einfachauswahl, 1 richtige aus 5. Prüft den Kern als Grundwissen. Distraktoren = echte, aber hier falsche Fachbegriffe.
- "gruen": Einfachauswahl, 5 Optionen, wobei die Optionen ganze AUSSAGEN sind. MUSS einen Unterscheidungs- oder Anwendungs-Dreh haben (zwei ähnliche Konzepte abgrenzen ODER auf einen kurzen Mini-Fall anwenden). Darf NIE nur dieselbe Tatsache wie "gelb" abfragen. Distraktoren = plausible Denkfehler/Halbwahrheiten.
- "blau": Aussagenkombination, 4 Aussagen, 5 Kombinations-Optionen (A–E). Fast Prüfungsniveau, subtile Distraktoren, volle Fachsprache.
- "braun": Volles Prüfungsformat (bis 5 Aussagen / 5 Kombinationen), neu formuliert, prüfungsecht, nur minimal weniger Fallstricke als das Original.
- "schwarz": ORIGINALFRAGE unverändert — typ, stamm, aussagen, optionen, loesung 1:1 aus der Quelle kopieren. Offensichtliche Extraktions-Artefakte in einer Option sauber abschneiden.

KORREKTHEIT: Jede Stufe hat genau eine eindeutig korrekte Lösung (Feld "loesung" = Liste von Buchstaben). Keine erfundenen medizinischen Fakten.

JSON-HINWEIS: Verwende in Texten KEINE geraden doppelten Anführungszeichen ("). Nutze typografische „ und ", sonst bricht das JSON.

AUSGABE: Schreibe ein JSON-Array nach /Users/cwick/projects/HPP-App/daten/_belt_part_<N>.json. Schema pro Frage:
{"nr":<int>,"thema":"...","kern":"...","stufen":{
 "gelb":{"typ":"Einfachauswahl","stamm":"...","aussagen":null,"optionen":{"A":"...","B":"...","C":"...","D":"...","E":"..."},"loesung":["A"]},
 "gruen":{"typ":"Einfachauswahl","stamm":"...","aussagen":null,"optionen":{...},"loesung":["B"]},
 "blau":{"typ":"Aussagenkombination","stamm":"...","aussagen":{"1":"...","2":"...","3":"...","4":"..."},"optionen":{...},"loesung":["B"]},
 "braun":{"typ":"Aussagenkombination","stamm":"...","aussagen":{"1":"...","...":"...","5":"..."},"optionen":{...},"loesung":["D"]},
 "schwarz":{"typ":"<original>","stamm":"<original>","aussagen":<original oder null>,"optionen":<original>,"loesung":<original>}}}

Gib am Ende NUR zurück: Anzahl verarbeiteter Fragen und Bestätigung, dass alle 5 Stufen befüllt sind. KEIN Fragentext.
```

## Schritt 2 — Mergen, rendern, verifizieren

Skript `daten/build_exam.py` ausführen (im Sandbox-Pfad). Es liest `_belt_part_*.json`, repariert defekte Anführungszeichen automatisch, schreibt `daten/fragen_<kurz-id>.json` und `Prüfung_<kurz-id>_alle_Guertel.md` und prüft:
- jede Stufe hat eine gültige Lösung (Buchstabe existiert in den Optionen),
- **Schwarz-Lösung == Original** (aus `fragen_original.json`),
- **Grün-Stamm ≠ Gelb-Stamm** (kein Wiederholen der Gelb-Tatsache).

```
python3 daten/build_exam.py "<PID>" "<Titel, z.B. März 2025>"
# Ausgabe muss enden mit: Probleme: KEINE ...
```

## Schritt 3 — Manifest + Stichprobe

- In `daten/index.json` die neue Prüfung zu `exams` hinzufügen (`id`, `titel`, `datei`, `guertel_komplett: true`).
- 2–3 Fragen im gerenderten `Prüfung_<id>_alle_Guertel.md` fachlich gegenlesen (v. a. Recht- und Fallfragen).

## Stolperfallen

- **Anführungszeichen:** Subagenten neigen dazu, gerade `"` als deutsches Schlusszeichen zu schreiben → JSON bricht. Der Hinweis im Prompt + die Auto-Reparatur in `build_exam.py` fangen das ab.
- **Nicht** das alte `merge_render.py` (nur im temporären Arbeitsbereich) verwenden — `build_exam.py` ist die parametrisierte, sichere Version.
- `_belt_part_*.json` sind Zwischendateien (in `.gitignore`); sie werden bei jeder Prüfung überschrieben.

## Modellwahl

- **Generierungs-Subagenten: Sonnet empfohlen.** Gute Qualität bei moderaten Kosten (~60–95k Tokens je Agent).
- **Haiku:** für die Fragengenerierung NICHT empfohlen — medizinische Genauigkeit und der Grün-Differenzierungs-Dreh leiden. Falls aus Kostengründen doch Haiku, dann zwingend stärkere Nachkontrolle (mehr Stichproben, ggf. ganze Lösungsschlüssel prüfen).
- **Orchestrierung (Hauptchat):** Sonnet reicht, weil Mergen/Verifizieren skriptbasiert ist. Die fachliche Stichprobe profitiert aber von einem stärkeren Modell.

## Fortschritt

Erledigt: 2026-03, 2025-10. Offen: die übrigen 42 Prüfungen aus `fragen_original.json` (sinnvoll von neu nach alt: 2025-03, 2024-10, 2024-03, …). Welche fertig sind, steht in `daten/index.json`.
