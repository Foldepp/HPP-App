# Design: Monetarisierung & kommerzielle Version — HPP-Prüfungstraining

**Datum:** 2026-06-18
**Status:** Entwurf (vom Nutzer in der Brainstorm-Sitzung bestätigt)
**Scope:** Geschäftsmodell, Freemium-Schnitt und die technische Gating-/Entitlement-Architektur,
die nötig ist, um aus der bisher kostenlosen Offline-App ein bezahltes Produkt zu machen.

## 1. Ziel & Leitgedanke

Die App soll kommerziell werden, **ohne ihre Reichweite zu opfern**. Erklärtes Nutzerziel:
niedrige Einstiegshürde → viele Nutzer, dann *ein paar* regelmäßige Einnahmen; langfristig soll
sich die App **als Prüfungstrainer in der Branche etablieren**.

Daraus folgt die zentrale Strategie-Entscheidung: **Reichweite kommt aus dem Gratis-Funnel und
der Inhaltsvollständigkeit — nicht aus dem Preis.** Der Preis ist bewusst ein No-Brainer; er
entscheidet nur, *wie* die zahlende Minderheit zahlt.

## 2. Geschäftsmodell & Free-Schnitt

**Gratis (ohne Login, wie heute über localStorage):**
- Level 1 (Gelb) + Level 2 (Grün) über **alle** verfügbaren Prüfungen.
- Voller Übungsmodus / SRS auf diesen beiden Stufen.

**Bezahlt:**
- Level 3–5 (Blau / Braun / Schwarz).
- Voller **Prüfungsmodus** (28er-Simulation, 60-Min-Timer, Auswertung 21/28).
- **Geräte-übergreifender Sync** des Fortschritts (Feature in Scope; die genaue Sync-/Merge-Mechanik
  wird in einer eigenen Sync-Spec festgelegt, siehe Abschnitt 8).

Die internen Schlüssel bleiben `gelb/gruen/blau/braun/schwarz`; der Schnitt liegt zwischen
`gruen` (frei) und `blau` (bezahlt).

## 3. Preise & Zahlung

- **0,99 €/Monat (Abo)** **oder** **9,99 € Lifetime (Einmalzahlung)**.
- Zahlungsabwickler: **Stripe direkt**. Ein *Merchant of Record* (Paddle/Lemon Squeezy) scheidet
  bei 0,99 € aus (≈5 % + 0,50 € Gebühr → über 50 % weg).
- **EU-Umsatzsteuer / OSS** wird selbst abgeführt — bewusst akzeptierter Mehraufwand des
  Abo-Modells.

**Bewusst akzeptierte Konsequenzen (Erwartungsmanagement, kein offener Punkt):**
- Bei 0,99 € frisst die Zahlungsgebühr (~0,25 € + Prozentsatz) einen großen Anteil; Umsatz pro
  Kunde ist niedrig. Für das Reichweiten-Ziel in Ordnung.
- Das Monatsabo wird das Lifetime dominieren (Break-even ~10 Monate, die meisten lernen kürzer).
  Lifetime ist eher „Trinkglas" als Haupteinnahme.

## 4. Freischalten in der App (UX)

- An jeder gesperrten Stufe ein **„Freischalten"-Button**.
- Klick → **In-App-Stripe-Checkout** (E-Mail + Zahlung) → sofortige Entsperrung. Kein Verlassen
  der App, kein externer Kundenbereich.
- Auswahl zwischen Abo (0,99 €/Monat) und Lifetime (9,99 €) im Checkout.

## 5. Identität & Geräte-Sync

- **Identität = E-Mail**, die Stripe beim Checkout ohnehin abfragt. Kein Passwort, kein separater
  Registrierungsschritt.
- **Neues Gerät:** „Zugang wiederherstellen" → E-Mail eingeben → Bestätigungslink/Code per Mail →
  Stufe entsperrt.
- **Abo-Status** wird serverseitig geprüft (aktiv / abgelaufen / gekündigt). Lifetime gilt dauerhaft.

## 6. Architektur (bleibt auf Vercel)

Die App bleibt im Kern eine statische Vanilla-JS-App. Neu hinzu kommt eine **minimale Backend-Schicht
auf Vercel**:

- **Vercel Serverless Functions** für die API-Endpunkte.
- **Vercel KV oder Postgres** als Entitlement-Speicher (`E-Mail → Status: aktiv-bis | lifetime`).
- **Stripe-Webhook-Endpoint:** empfängt Zahlungs-/Abo-Events und schreibt/aktualisiert das
  Entitlement.
- **Entitlement-Endpoint:** die App fragt beim Start bzw. nach Login „Darf diese E-Mail Level 3–5?".
- **E-Mail-Verifikation:** Endpoint zum Versenden + Einlösen des Bestätigungslinks/Codes für die
  Geräte-Wiederherstellung.

**Soft-Gating (bewusste Entscheidung):** Die Fragendaten (`data.js`) bleiben im Client; die
*Entsperrung* der Bezahlstufen kommt aus dem Server-Check. Bei 0,99 € lohnt sich kein DRM/keine
Verschlüsselung — etwas Piraterie wird akzeptiert zugunsten eines schnellen Launches.

**Leitplanke bleibt gewahrt:** Das Gratis-Tier braucht **kein** Backend und **kein** Login —
funktioniert weiter offline über localStorage. Erst beim Bezahlen entsteht serverseitiger Zustand.

## 7. Erfolgskriterien

- Gratis-Nutzer können Gelb/Grün über alle Prüfungen ohne Login/Konto nutzen (wie heute).
- Ein Nutzer kann Blau/Braun/Schwarz + Prüfungsmodus per In-App-Stripe-Checkout freischalten.
- Nach erfolgreicher Zahlung sind die Bezahlstufen sofort entsperrt.
- Auf einem zweiten Gerät stellt derselbe Nutzer per E-Mail seinen Zugang wieder her.
- Ein gekündigtes/abgelaufenes Abo verliert den Zugang zu den Bezahlstufen; Lifetime nicht.
- Die App ist weiterhin auf Vercel deploybar; das Gratis-Tier bleibt offline lauffähig.

## 8. Bewusst NICHT in dieser Spec (eigene Stränge)

- **Übersetzung der ~43 restlichen Prüfungen** über alle Gürtel (Daten-Track; der eigentliche
  inhaltliche Wert, aber separat von der Monetarisierungs-Technik).
- **Detail des Fortschritts-Syncs** (welche localStorage-Schlüssel — `hpp_progress`, `hpp_srs` —
  genau wie synchronisiert/gemergt werden) → eigene Sync-Spec.
- PWA / Dark Mode / eigene Domain (Produkt-Politur, separat).

## 9. Rechtliche Voraussetzungen (Blocker vor Go-Live, eigene Aufgabe)

Diese Spec baut die Technik. Vor dem kommerziellen Launch müssen parallel erstellt/geklärt werden:
- **Impressum** (§5 DDG/TMG), **Datenschutzerklärung** (DSGVO), **AGB**, **Widerrufsbelehrung**
  für digitale Produkte, Haftungs-Disclaimer.
- **Offene IP-Frage:** Sind die wortgetreuen amtsärztlichen Originalfragen (Stufe Schwarz)
  kommerziell reproduzierbar, und wer hält die Rechte? Kann den Verkauf der Schwarz-Stufe
  einschränken — vor Go-Live zu klären (ggf. Fachanwalt). Notfallplan: nur die Übersetzungs-Stufen
  verkaufen, Schwarz reduziert/als Referenz.

## 10. Offene Punkte für die Implementierungs-Planung

- Wahl Vercel KV vs. Postgres für den Entitlement-Speicher.
- Konkreter Stripe-Produkt-/Preis-Aufbau (ein Produkt mit zwei Preisen: Abo + Einmalzahlung).
- Mechanik des Bestätigungslinks (Magic Link vs. 6-stelliger Code) für die Geräte-Wiederherstellung.
- Verhalten bei abgelaufenem Abo im UI (Hinweis + Reaktivierung).
