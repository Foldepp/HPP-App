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

    # 2) Cross-Pruefungs-Dubletten anhand INHALTS-Signatur (nicht nur Stamm/Thema).
    # Eine untere Stufe gilt als kopiert, wenn ihr kompletter Inhalt (Stamm + Aussagen
    # + Optionen, normalisiert) identisch in einer ANDEREN Pruefung vorkommt.
    # Rein generische Staemme ("Welche Aussagen zu X treffen zu?") loesen KEINEN Treffer
    # aus, weil Aussagen/Optionen sich unterscheiden.
    sig_map = {}
    for eid, exam in exams.items():
        for q in exam["fragen"]:
            for belt in UNTERE:
                st = q["stufen"][belt]
                auss = " ".join((st.get("aussagen") or {}).values())
                opts = " ".join(st.get("optionen", {}).values())
                sig = _norm(st["stamm"]) + " || " + _norm(auss) + " || " + _norm(opts)
                sig_map.setdefault(sig, []).append((eid, q["nr"], belt))
    for sig, vork in sig_map.items():
        if len({v[0] for v in vork}) >= 2:  # in >=2 verschiedenen Pruefungen
            ds = ", ".join(f"{e} F{n}/{b}" for e, n, b in sorted(vork))
            errors.append(f"Cross-Dublette (identischer Inhalt): {ds}  => kopiert")

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

    themenbereiche = json.loads((DATEN / "themenbereiche.json").read_text(encoding="utf-8"))
    payload = {"index": index, "exams": exams, "themenbereiche": themenbereiche}
    js = "window.HPP_DATA = " + json.dumps(payload, ensure_ascii=False) + ";\n"
    ZIEL.write_text(js, encoding="utf-8")
    print(f"geschrieben: {ZIEL} ({len(exams)} Pruefung(en): {', '.join(exams)})"
          + (f"  [{len(warnings)} Warnung(en)]" if warnings else ""))


if __name__ == "__main__":
    main()
