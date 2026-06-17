# App-Spezifikation

Lern-App für die HPP-Prüfung mit Gürtelsystem. Deutsch, offline lauffähig.

## Ansichten

### 1. Start / Gürtelauswahl
- Zeigt die fünf Gürtel (Gelb, Grün, Blau, Braun, Schwarz) mit dem aktuellen Fortschritt.
- Freigeschaltete Gürtel sind anwählbar; höhere Gürtel sind gesperrt, bis der vorige bestanden ist.
- Auswahl der Prüfung (aktuell nur März 2026; Liste kommt aus `daten/index.json`).
- Einstieg in **Prüfungsmodus** oder **Übungsmodus**.

### 2. Prüfungsmodus
- 28 Fragen der gewählten Prüfung auf der gewählten Gürtelstufe.
- **60-Minuten-Timer**, sichtbar; bei Ablauf automatische Auswertung.
- Pro Frage: Fragestamm, ggf. nummerierte Aussagen, Optionen A–E. Auswahl je nach Typ:
  - Einfachauswahl: eine Option.
  - Mehrfachauswahl: genau zwei Optionen (Hinweis anzeigen).
  - Aussagenkombination: eine Kombinations-Option.
- Navigation vor/zurück, Übersicht offener Fragen.
- **Auswertung:** richtige Anzahl, Bestehen ab 21/28 (75 %). Bestehen schaltet den nächsten Gürtel frei.
- Nach der Auswertung: Durchsicht aller Fragen mit korrekter Lösung und (falls vorhanden) Erklärung.

### 3. Übungsmodus
- Einzelne Fragen ohne Zeitdruck, optional nach Themenfeld gefiltert (`thema`).
- Sofortiges Feedback nach jeder Antwort: richtig/falsch, korrekte Lösung, Wissenskern (`kern`) als Erklärung.

### 4. Statistik
- Trefferquote gesamt und je Themenfeld.
- Verlauf der bestandenen Gürtel.

## Verhalten / Logik

- **Auswertung:** gewählte Buchstaben-Menge muss exakt `loesung` entsprechen (siehe DATENSCHEMA.md).
- **Fortschritt** in `localStorage`: aktueller/höchster Gürtel, Statistik pro Themenfeld, letzte Ergebnisse.
- **Gürtel-Freischaltung:** Reihenfolge `gelb → gruen → blau → braun → schwarz`. Gelb ist von Beginn an frei.
- Robust gegenüber Prüfungen ohne vollständige Gürtel (nur in `index.json` mit `guertel_komplett: true` für den Prüfungsmodus über alle Stufen anbieten).

## Nicht-Ziele (vorerst)
- Kein Login, kein Server, keine Cloud-Synchronisierung.
- Komplette Übersetzung aller 44 Prüfungen ist ein separater Daten-Schritt, nicht Teil des App-Baus.

## Vorschlag erste Ausbaustufe
1. Daten laden + Gürtelauswahl + eine Frage rendern (alle drei Fragetypen korrekt darstellen).
2. Prüfungsmodus mit Timer und Auswertung (21/28).
3. localStorage-Fortschritt + Gürtel-Freischaltung.
4. Übungsmodus + Statistik.
