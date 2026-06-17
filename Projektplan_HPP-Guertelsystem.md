# HPP-Prüfungstraining mit Gürtelsystem — Projektplan

*Stand: 17. Juni 2026*

## 1. Worum es geht

Eine Lern-App für die schriftliche amtsärztliche Überprüfung **Heilpraktiker für Psychotherapie (HPP)**. Kernidee: ein Gürtelsystem wie beim Karate. Der **schwarze Gürtel** bedeutet Original-Prüfungsfragen. Jeder niedrigere Gürtel zeigt **dieselbe Frage zum selben Thema**, nur sprachlich und inhaltlich vereinfacht. Aufbau, Themen und das Multiple-Choice-Verfahren bleiben über alle Stufen gleich — man wächst von „ganz leicht" bis zum Original hinauf.

## 2. Eckdaten der echten Prüfung (verifiziert)

Diese Rahmenbedingungen bestimmen den Aufbau der App, damit das Training prüfungsnah bleibt:

- **28 Multiple-Choice-Fragen**, Bearbeitungszeit 60 Minuten.
- **Bestehensgrenze: 21 von 28 richtig (75 %)** → Zulassung zum mündlichen Teil.
- **Termine:** 3. Mittwoch im März, 2. Mittwoch im Oktober.
- **Fragenformat:** überwiegend Aussagenkombinationen — ein Fragestamm, mehrere nummerierte Aussagen, fünf Antwortkombinationen (z. B. „nur 1, 2 und 4 sind richtig").
- **Themenfelder:** ICD-10-Störungsbilder, Psychopathologie, rechtliche Grundlagen (Heilpraktikergesetz, PsychThG, Betreuungs-/Unterbringungsrecht), Notfälle/Suizidalität, Diagnostik, Grundlagen der Psychotherapieverfahren.
- **Quellenlage:** Originalprüfungen vergangener Jahre sind öffentlich verfügbar (mehrere Schulen stellen Sammlungen mit Lösungsschlüssel bereit, teils zurück bis 2008).

## 3. Das Gürtelsystem — Vereinfachungs-Logik

Über alle Stufen bleibt **gleich**: das Thema, die Wissensaussage dahinter und das MC-Prinzip. **Verändert** werden nur Schwierigkeit und Form. Vorschlag für die Abstufung (an einer Frage testen wir das gleich, danach legen wir die endgültige Zahl fest):

*Revidiert (Stand 17.06.2026): Der frühere Weiß-Gurt entfällt (zu leicht), der Rot-Gurt entfällt ebenfalls. Alle Inhalte rutschen eine Stufe nach oben — der bisherige Gelb-Inhalt ist das neue Weiß. Es bleiben sechs Stufen:*

*Rezeptur v5 (Stand 17.06.2026): Weiß entfällt, Braun kommt als letzte Stufe vor Schwarz hinzu. Schwierigkeits-Hebel ist die **kognitive Tiefe**, nicht die Anzahl der Aussagen. Wir kürzen nicht die Originalfrage, sondern formulieren zu demselben Wissenskern auf jeder Stufe eine eigene, neue Frage auf passendem Niveau (echte Übersetzung, nicht Reduktion). Fünf Gürtel:*

| Gürtel | Kognitive Tiefe | Form / Distraktoren |
|---|---|---|
| **Gelb** | Einstieg: solides Grundwissen nötig (z. B. die echten Hauptsymptome kennen) | Single-Choice; Distraktoren sind echte, aber falsch zugeordnete Fachbegriffe |
| **Grün** | Verständnis/Anwendung — MUSS einen Unterscheidungs- oder Anwendungs-Dreh haben (zwei ähnliche Konzepte abgrenzen ODER auf einen Mini-Fall anwenden); darf NIE nur die Gelb-Tatsache wiederholen | Antwortoptionen sind ganze Aussagen; Distraktoren sind plausible Denkfehler/Halbwahrheiten |
| **Blau** | Fast Prüfungsniveau; feine Differenzierung, volle Fachsprache | Aussagenkombination mit subtilen Distraktoren |
| **Braun** | Prüfungsnah, neu formuliert — eine Stufe unter dem Original (minimal weniger Fallstricke) | volles Prüfungsformat (bis 5 Aussagen / 5 Kombinationen), prüfungsechte Distraktoren |
| **Schwarz** | **Original-Prüfungsfrage, unverändert** | Original |

Leitbild: Bei **Gelb** braucht es solides Grundwissen. **Grün** verlangt Verständnis und Differenzieren. **Blau** ist nahe an der Prüfung. **Braun** ist prüfungsecht (eine neu formulierte Frage auf Prüfungsniveau). **Schwarz** ist die echte, unveränderte Originalfrage. Format und Aussagenzahl dienen nur der Schwierigkeit — sie sind nicht selbst der Maßstab.

**Referenzbeispiel (echte Übersetzung), März 2026 Frage 5 „depressive Störungen":**
- Gelb: *„Welches zählt zu den drei Hauptsymptomen nach ICD-10?"* → alle Optionen sind echte Depressionssymptome, nur eines ist Hauptsymptom (Grundwissen nötig).
- Grün: Haupt- vs. Zusatzsymptom unterscheiden (z. B. „Appetit kann vermindert *und* gesteigert sein").
- Blau: Aussagenkombination, 4 Aussagen, subtile Distraktoren — nah am Original.
- Braun: volles Prüfungsformat (5 Aussagen), neu formuliert, prüfungsecht.
- Schwarz: Originalfrage (5 Aussagen, Lösung D).

## 4. Datenstruktur (Schritt 1 des Aufbaus)

Jede Frage wird einmal als Datensatz erfasst, der alle Gürtelstufen enthält. So bleibt der Bezug „eine Originalfrage → ihre vereinfachten Varianten" immer erhalten. Geplantes Format pro Frage (JSON):

```
{
  "id": "2024-03-07",          // Jahr-Monat-Fragennummer
  "thema": "Depressive Episode (ICD-10)",
  "themenfeld": "Affektive Störungen",
  "quelle": "Originalprüfung März 2024, Frage 7",
  "stufen": {
    "schwarz": { "frage": "...", "aussagen": [...], "optionen": [...], "loesung": "A", "erklaerung": "..." },
    "rot":     { ... },
    ...
    "weiss":   { ... }
  }
}
```

Vorteile: Eine App liest dieselbe Datei und blendet je nach Gürtel die passende Stufe ein; neue Prüfungsjahrgänge werden einfach als weitere Datensätze ergänzt.

## 5. App-Konzept (Schritt 2 des Aufbaus)

Eine einzelne HTML-Datei, offline lauffähig, kein Server nötig. Funktionen:

- **Quiz im Prüfungsmodus:** 28 Fragen, 60-Minuten-Timer, Auswertung gegen die 75-%-Grenze.
- **Gürtel-Fortschritt:** Wer eine Stufe besteht, schaltet die nächsthöhere frei. Aktueller Gürtel wird gespeichert.
- **Übungsmodus:** einzelne Themenfelder gezielt trainieren, mit Erklärung nach jeder Antwort.
- **Statistik:** Trefferquote je Themenfeld, um Schwächen sichtbar zu machen.

## 6. Ordnerstruktur

```
HPP-App/
├─ Projektplan_HPP-Guertelsystem.md      ← dieses Dokument
├─ originalfragen/                         ← Roh-PDFs/Texte der echten Prüfungen
│   ├─ 2024-03/
│   ├─ 2024-10/
│   └─ ...
├─ daten/
│   └─ fragen.json                         ← aufbereitete Fragen über alle Stufen
└─ app/
    └─ index.html                          ← die Lern-App
```

## 7. Schrittfolge

1. **Originalfragen sammeln** — ich recherchiere die öffentlich verfügbaren Jahrgänge; du ergänzt, was dir noch fehlt. Ablage in `originalfragen/`.
2. **Eine Frage komplett durchstufen** — als Muster (siehe Beispiel unten), damit die Vereinfachungs-Logik sitzt.
3. **Datenstruktur festzurren** — `fragen.json`-Schema final, Gürtelanzahl festlegen.
4. **Fragenbestand aufbereiten** — Originalfragen erfassen und je Stufe vereinfachen.
5. **App bauen** — `index.html` mit Quiz-, Gürtel- und Übungsmodus.
6. **Testen** — Prüfungsmodus, Bestehenslogik, Fortschritt verifizieren.

## 8. Beispiel: eine Frage über alle Gürtel

Thema: **Hauptsymptome (Kernsymptome) der depressiven Episode nach ICD-10**. Das gesuchte Wissen ist auf jeder Stufe dasselbe: die drei Kernsymptome sind *gedrückte Stimmung*, *Interessen-/Freudverlust* und *Antriebsminderung/erhöhte Ermüdbarkeit*.

---

**⬜ Weiß** — *Was ist ein typisches Zeichen einer Depression?*
a) gute, fröhliche Stimmung
b) anhaltend traurige, gedrückte Stimmung ✅

---

**🟨 Gelb** — *Welches Gefühl gehört typischerweise zu einer Depression?*
a) gedrückte, niedergeschlagene Stimmung ✅
b) ständige Hochstimmung
c) gesteigerte Tatkraft

---

**🟧 Orange** — *Bei einer Depression verliert ein Mensch oft die Freude an Dingen. Wie nennt man das?*
a) Interessenverlust / Freudlosigkeit ✅
b) gesteigerter Antrieb
c) Größenideen
d) Realitätsverlust
*(Hinweis: gemeint ist, dass nichts mehr Freude macht.)*

---

**🟩 Grün** — *Welches Symptom zählt zu den Kernsymptomen einer depressiven Episode?*
a) Verminderter Antrieb und erhöhte Ermüdbarkeit ✅
b) Ideenflucht
c) Logorrhö
d) Vermindertes Schlafbedürfnis
e) Gesteigertes Selbstwertgefühl

---

**🟦 Blau** — *Welche Aussagen treffen auf die Kernsymptome einer Depression zu?*
1. Gedrückte Stimmung
2. Interessen- und Freudverlust
3. Vermindertes Schlafbedürfnis

A: nur 1 und 2 ✅
B: nur 1 und 3
C: nur 2 und 3
D: alle drei

---

**🟫 Braun** — *Welche der folgenden Symptome zählen nach ICD-10 zu den Hauptsymptomen einer depressiven Episode?*
1. Gedrückte, depressive Stimmung
2. Interessenverlust und Freudlosigkeit
3. Vermindertes Selbstwertgefühl
4. Verminderter Antrieb / erhöhte Ermüdbarkeit

A: nur 1, 2 und 4 ✅
B: nur 1, 3 und 4
C: nur 2, 3 und 4
D: alle sind richtig
E: nur 1 und 2

---

**🟥 Rot** — *Welche der folgenden Symptome zählen nach ICD-10 zu den Hauptsymptomen (Kernsymptomen) einer depressiven Episode?*
1. Gedrückte, depressive Stimmung
2. Interessenverlust und Freudlosigkeit
3. Vermindertes Selbstwertgefühl
4. Verminderter Antrieb / erhöhte Ermüdbarkeit
5. Früherwachen / Schlafstörung

A: nur 1, 2 und 4 sind richtig ✅
B: nur 1, 3 und 5
C: nur 2, 4 und 5
D: nur 1, 2, 3 und 4
E: alle sind richtig

---

**⬛ Schwarz** — *Original-Prüfungsfrage (unverändert, Beispiel im echten Prüfungsstil):*
Identisch zur roten Stufe in Wortlaut und Struktur — auf dieser Stufe stammt die Frage **wörtlich aus einer echten Prüfung**, mit Original-Distraktoren und Original-Schlüssel. (Hier eingesetzt, sobald die echten Jahrgänge im Ordner liegen.)

**Erklärung (für alle Stufen):** Die drei Hauptsymptome sind gedrückte Stimmung, Interessen-/Freudverlust und Antriebsminderung/erhöhte Ermüdbarkeit. *Vermindertes Selbstwertgefühl* und *Schlafstörungen* sind Zusatzsymptome, keine Kernsymptome — deshalb sind sie auf den höheren Stufen die anspruchsvollen Distraktoren.

---

So wandert dieselbe Wissensfrage von „traurig statt fröhlich" (Weiß) bis zur vollständigen Aussagenkombination im Prüfungsstil (Schwarz).
