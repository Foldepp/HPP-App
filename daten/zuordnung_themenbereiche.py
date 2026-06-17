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
 "2025-03": {1:"sucht",2:"diagnostik",3:"recht",4:"sucht",5:"organisch",6:"therapie",
   7:"notfall",8:"organisch",9:"ess_sexual",10:"kjp",11:"diagnostik",12:"kjp",13:"therapie",
   14:"diagnostik",15:"therapie",16:"organisch",17:"recht",18:"ess_sexual",19:"therapie",
   20:"kjp",21:"angst",22:"therapie",23:"affektiv",24:"diagnostik",25:"angst",26:"therapie",
   27:"organisch",28:"therapie"},
 "2024-10": {1:"angst",2:"sucht",3:"sucht",4:"organisch",5:"kjp",6:"recht",7:"kjp",
   8:"organisch",9:"therapie",10:"organisch",11:"recht",12:"angst",13:"kjp",14:"affektiv",
   15:"notfall",16:"diagnostik",17:"angst",18:"psychosen",19:"therapie",20:"persoenlich",
   21:"angst",22:"organisch",23:"angst",24:"recht",25:"angst",26:"organisch",27:"recht",
   28:"therapie"},
}
DATEIEN = {"2026-03":"fragen_2026-03.json","2025-10":"fragen_2025-10.json",
           "2025-03":"fragen_2025-03.json","2024-10":"fragen_2024-10.json"}

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
