# Datenschema

## `daten/fragen_original.json`

Array aller 44 Prüfungen (nur Originalfragen). Quelle für die Schwarz-Stufe und für künftige Übersetzungen.

```json
[
  {
    "pruefung_id": "2026-03_Maerz",
    "quelle": "HPP_2026-03_Maerz.txt",
    "fragen": [
      {
        "nr": 1,
        "typ": "Mehrfachauswahl",            // oder "Einfachauswahl" / "Aussagenkombination"
        "stamm": "Welche der folgenden Aussagen ...",
        "aussagen": { "1": "...", "2": "..." }, // null, wenn keine nummerierten Aussagen
        "optionen": { "A": "...", "B": "...", "C": "...", "D": "...", "E": "..." },
        "loesung": ["A"]                       // Liste; bei Mehrfachauswahl z. B. ["B","C"]
      }
    ]
  }
]
```

## `daten/fragen_2026-03.json`

Eine Prüfung, vollständig über alle fünf Gürtel.

```json
{
  "pruefung_id": "2026-03_Maerz",
  "titel": "Heilpraktikerprüfung (Psychotherapie) – 18. März 2026",
  "guertel": ["gelb", "gruen", "blau", "braun", "schwarz"],
  "fragen": [
    {
      "nr": 1,
      "thema": "Paranoide Persönlichkeitsstörung",
      "kern": "Der in einem Satz getestete Wissenskern (gilt für alle Stufen).",
      "stufen": {
        "gelb":   { "typ": "Einfachauswahl", "stamm": "...", "aussagen": null, "optionen": { "A": "..." }, "loesung": ["B"] },
        "gruen":  { "typ": "Einfachauswahl", "stamm": "...", "aussagen": null, "optionen": { "...": "..." }, "loesung": ["C"] },
        "blau":   { "typ": "Aussagenkombination", "stamm": "...", "aussagen": { "1": "...", "4": "..." }, "optionen": { "...": "..." }, "loesung": ["B"] },
        "braun":  { "typ": "Aussagenkombination", "stamm": "...", "aussagen": { "1": "...", "5": "..." }, "optionen": { "...": "..." }, "loesung": ["A"] },
        "schwarz":{ "typ": "Mehrfachauswahl", "stamm": "<Original>", "aussagen": { "...": "..." }, "optionen": { "...": "..." }, "loesung": ["A"] }
      }
    }
  ]
}
```

## `daten/index.json` (Manifest)

Listet, welche Prüfungen mit Gürtelübersetzung verfügbar sind. Die App liest zuerst dieses Manifest.

```json
{
  "guertel": ["gelb", "gruen", "blau", "braun", "schwarz"],
  "exams": [
    { "id": "2026-03", "titel": "März 2026", "datei": "fragen_2026-03.json", "guertel_komplett": true }
  ]
}
```

## Auswertungsregel

Eine Frage gilt als **richtig**, wenn die vom Nutzer gewählte Menge an Buchstaben **exakt** der `loesung`-Liste entspricht. Das gilt auch für Mehrfachauswahl (zwei richtige) und Aussagenkombination (eine Kombinations-Option). Teilpunkte gibt es nicht (wie in der echten Prüfung).
