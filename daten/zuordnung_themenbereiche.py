#!/usr/bin/env python3
"""Schreibt das Feld `themenbereich` in jede Frage der guertel_komplett-Pruefungen.
Feste Zuordnung (siehe Spec/Brainstorm). Erneut ausfuehrbar (idempotent)."""
import json
from pathlib import Path

DATEN = Path(__file__).resolve().parent
GUELTIGE_IDS = {"diagnostik","affektiv","psychosen","angst","persoenlich","sucht",
                "organisch","kjp","ess_sexual","notfall","therapie","recht"}

ZUORDNUNG = {
 "2026-03": {1:"persoenlich",2:"diagnostik",3:"diagnostik",4:"diagnostik",5:"affektiv",
   6:"sucht",7:"psychosen",8:"affektiv",9:"diagnostik",10:"angst",11:"affektiv",12:"notfall",
   13:"diagnostik",14:"recht",15:"angst",16:"psychosen",17:"affektiv",18:"diagnostik",
   19:"notfall",20:"organisch",21:"persoenlich",22:"organisch",23:"diagnostik",24:"persoenlich",
   25:"diagnostik",26:"psychosen",27:"recht",28:"affektiv"},
 "2025-10": {1:"angst",2:"affektiv",3:"affektiv",4:"angst",5:"organisch",6:"therapie",
   7:"persoenlich",8:"kjp",9:"ess_sexual",10:"recht",11:"organisch",12:"organisch",
   13:"diagnostik",14:"notfall",15:"therapie",16:"recht",17:"psychosen",18:"sucht",19:"sucht",
   20:"therapie",21:"kjp",22:"therapie",23:"therapie",24:"therapie",25:"therapie",26:"angst",
   27:"angst",28:"organisch"},
}
DATEIEN = {"2026-03":"fragen_2026-03.json","2025-10":"fragen_2025-10.json"}

def main():
    for exam_id, datei in DATEIEN.items():
        pfad = DATEN / datei
        d = json.loads(pfad.read_text(encoding="utf-8"))
        zu = ZUORDNUNG[exam_id]
        for fr in d["fragen"]:
            b = zu[fr["nr"]]
            assert b in GUELTIGE_IDS, b
            fr["themenbereich"] = b
        pfad.write_text(json.dumps(d, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"{datei}: {len(d['fragen'])} Fragen zugeordnet")

if __name__ == "__main__":
    main()
