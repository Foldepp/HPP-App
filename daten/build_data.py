#!/usr/bin/env python3
"""Erzeugt app/data.js (JS-Wrap) aus den JSON-Daten in daten/.
Reproduzierbar: bei neuen uebersetzten Pruefungen erneut ausfuehren.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATEN = ROOT / "daten"
ZIEL = ROOT / "app" / "data.js"

def main():
    index = json.loads((DATEN / "index.json").read_text(encoding="utf-8"))
    exams = {}
    for exam in index["exams"]:
        if not exam.get("guertel_komplett"):
            continue
        daten = json.loads((DATEN / exam["datei"]).read_text(encoding="utf-8"))
        exams[exam["id"]] = daten
    payload = {"index": index, "exams": exams}
    js = "window.HPP_DATA = " + json.dumps(payload, ensure_ascii=False) + ";\n"
    ZIEL.write_text(js, encoding="utf-8")
    print(f"geschrieben: {ZIEL} ({len(exams)} Pruefung(en): {', '.join(exams)})")

if __name__ == "__main__":
    main()
