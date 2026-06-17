#!/usr/bin/env python3
"""Erzeugt app/data.js (JS-Wrap) aus den JSON-Daten in daten/.
Reproduzierbar: bei neuen uebersetzten Pruefungen erneut ausfuehren.

Vor dem Schreiben laeuft eine Integritaets-Validierung:
- schwarz jeder Frage == Originalfrage in fragen_original.json (typ/stamm/optionen/loesung)
- gruen-Stamm != gelb-Stamm (Gruen darf nicht die Gelb-Tatsache wiederholen)
- jede Stufen-Loesung liegt in den Optionen
- KEINE Cross-Pruefungs-Dubletten: untere Stufen/thema einer Frage duerfen nicht
  aus einer anderen Pruefung kopiert sein (>=2 gleiche Felder => Korruption => Abbruch;
  genau 1 gleiches Feld => Warnung, z. B. generischer Fragestamm)
Bei ERRORs wird KEIN data.js geschrieben und mit Exitcode 1 abgebrochen.
"""
import json, re, sys
from pathlib import Path

_QUOTES = "„“”\"‚‘’`«»"

def _norm(s):
    """Vergleichsnormalisierung: Anführungszeichen-Stil und Whitespace ignorieren."""
    s = "".join(" " if c in _QUOTES else c for c in s)
    return re.sub(r"\s+", " ", s).strip()

ROOT = Path(__file__).resolve().parent.parent
DATEN = ROOT / "daten"
ZIEL = ROOT / "app" / "data.js"
STUFEN = ["gelb", "gruen", "blau", "braun", "schwarz"]
UNTERE = ["gelb", "gruen", "blau", "braun"]


def _felder(frage):
    """Vergleichsfelder fuer den Cross-Pruefungs-Dublettencheck."""
    s = frage["stufen"]
    return {
        "thema": (frage.get("thema") or "").strip(),
        "gelb": s["gelb"]["stamm"].strip(),
        "gruen": s["gruen"]["stamm"].strip(),
        "blau": s["blau"]["stamm"].strip(),
        "braun": s["braun"]["stamm"].strip(),
    }


def validate(exams):
    """Gibt (errors, warnings) zurueck."""
    errors, warnings = [], []

    # Originalquelle laden (Wahrheit fuer schwarz)
    orig_raw = json.loads((DATEN / "fragen_original.json").read_text(encoding="utf-8"))
    orig = {o["pruefung_id"]: {q["nr"]: q for q in o["fragen"]} for o in orig_raw}

    # 1) Pro-Frage-Checks
    for eid, exam in exams.items():
        pid = exam.get("pruefung_id")
        omap = orig.get(pid, {})
        for q in exam["fragen"]:
            nr = q["nr"]
            st = q["stufen"]
            # schwarz == Original
            o = omap.get(nr)
            if not o:
                warnings.append(f"{eid} F{nr}: kein Original (pruefung_id {pid}) gefunden")
            else:
                sw = st["schwarz"]
                # Kritisch: Typ/Lösung muessen exakt stimmen
                if sw["typ"] != o["typ"]:
                    errors.append(f"{eid} F{nr}: schwarz typ != Original")
                if sorted(sw["loesung"]) != sorted(o["loesung"] or []):
                    errors.append(f"{eid} F{nr}: schwarz loesung {sw['loesung']} != Original {o['loesung']}")
                # Texttreue: nach Normalisierung (Quotes/Whitespace) verbleibende Wortdiffs nur warnen
                if _norm(sw["stamm"]) != _norm(o["stamm"]):
                    warnings.append(f"{eid} F{nr}: schwarz-Stamm weicht inhaltlich vom Original ab")
                okeys = set(sw["optionen"]) | set(o["optionen"])
                for k in sorted(okeys):
                    if _norm(sw["optionen"].get(k, "")) != _norm(o["optionen"].get(k, "")):
                        warnings.append(f"{eid} F{nr}/Option {k}: schwarz-Text weicht inhaltlich vom Original ab")
            # gruen != gelb
            if st["gruen"]["stamm"].strip() == st["gelb"]["stamm"].strip():
                errors.append(f"{eid} F{nr}: gruen-Stamm == gelb-Stamm")
            # Loesungen gueltig
            for s in STUFEN:
                if not set(st[s]["loesung"]).issubset(set(st[s]["optionen"].keys())):
                    errors.append(f"{eid} F{nr}/{s}: Loesung nicht in Optionen")

    # 2) Cross-Pruefungs-Dubletten (untere Stufen/thema)
    # Map: Feldwert -> Liste von (eid, nr, feldname)
    seen = {}
    for eid, exam in exams.items():
        for q in exam["fragen"]:
            for fname, val in _felder(q).items():
                if val:
                    seen.setdefault(val, []).append((eid, q["nr"], fname))
    # Zaehle pro Frage-Paar (verschiedene Pruefungen) wie viele Felder kollidieren
    paar = {}  # (eidA,nrA,eidB,nrB) -> set(feldnamen)
    for val, vorkommen in seen.items():
        if len(vorkommen) < 2:
            continue
        for i in range(len(vorkommen)):
            for j in range(i + 1, len(vorkommen)):
                a, b = vorkommen[i], vorkommen[j]
                if a[0] == b[0]:
                    continue  # gleiche Pruefung -> egal
                key = tuple(sorted([(a[0], a[1]), (b[0], b[1])]))
                paar.setdefault(key, set()).add(a[2])
    for (qa, qb), felder in sorted(paar.items()):
        msg = (f"Cross-Dublette: {qa[0]} F{qa[1]} <-> {qb[0]} F{qb[1]} "
               f"in Feld(ern): {', '.join(sorted(felder))}")
        if len(felder) >= 2:
            errors.append(msg + "  => wahrscheinlich kopiert")
        else:
            warnings.append(msg + "  (evtl. generischer Stamm, bitte sichten)")

    return errors, warnings


def main():
    index = json.loads((DATEN / "index.json").read_text(encoding="utf-8"))
    exams = {}
    for exam in index["exams"]:
        if not exam.get("guertel_komplett"):
            continue
        daten = json.loads((DATEN / exam["datei"]).read_text(encoding="utf-8"))
        exams[exam["id"]] = daten

    errors, warnings = validate(exams)
    for w in warnings:
        print(f"WARNUNG: {w}")
    if errors:
        print(f"\nVALIDIERUNG FEHLGESCHLAGEN ({len(errors)} Fehler) — data.js NICHT geschrieben:")
        for e in errors:
            print(f"  FEHLER: {e}")
        sys.exit(1)

    payload = {"index": index, "exams": exams}
    js = "window.HPP_DATA = " + json.dumps(payload, ensure_ascii=False) + ";\n"
    ZIEL.write_text(js, encoding="utf-8")
    print(f"geschrieben: {ZIEL} ({len(exams)} Pruefung(en): {', '.join(exams)})"
          + (f"  [{len(warnings)} Warnung(en)]" if warnings else ""))


if __name__ == "__main__":
    main()
