#!/usr/bin/env python3
"""Merge belt-part files -> fragen_<id>.json, render MD, verify. Usage: build_exam.py <pruefung_id> <titel>"""
import json, re, sys, glob, os

D = "/sessions/youthful-tender-pasteur/mnt/HPP-App/daten"
ROOT = "/sessions/youthful-tender-pasteur/mnt/HPP-App"
PID = sys.argv[1]          # z.B. 2025-10_Oktober
TITEL = sys.argv[2]        # z.B. "Heilpraktikerprüfung (Psychotherapie) – Oktober 2025"
SHORT = PID.split("_")[0]  # 2025-10
ORDER = ["gelb", "gruen", "blau", "braun", "schwarz"]

def load_lenient(path):
    raw = open(path, encoding="utf-8").read()
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        fixed = re.sub(r'„([^"„”]*)"', r'„\1”', raw)
        return json.loads(fixed)

parts = []
for f in sorted(glob.glob(os.path.join(D, "_belt_part_*.json"))):
    parts.extend(load_lenient(f))
parts.sort(key=lambda q: q["nr"])

exam = {"pruefung_id": PID, "titel": TITEL, "guertel": ORDER, "fragen": parts}
json.dump(exam, open(os.path.join(D, f"fragen_{SHORT}.json"), "w", encoding="utf-8"),
          ensure_ascii=False, indent=2)

# Verify gegen Original
orig = json.load(open(os.path.join(D, "fragen_original.json"), encoding="utf-8"))
o = [x for x in orig if x["pruefung_id"] == PID][0]
osol = {q["nr"]: sorted(q["loesung"] or []) for q in o["fragen"]}
prob = []
for q in parts:
    for k in ORDER:
        st = q["stufen"].get(k)
        if not st: prob.append((q["nr"], k, "fehlt")); continue
        if not set(st["loesung"]).issubset(set(st["optionen"].keys())):
            prob.append((q["nr"], k, "Lösung ungültig"))
    if sorted(q["stufen"]["schwarz"]["loesung"]) != osol.get(q["nr"]):
        prob.append((q["nr"], "schwarz", f"≠ Original {osol.get(q['nr'])}"))
    if q["stufen"]["gruen"]["stamm"].strip() == q["stufen"]["gelb"]["stamm"].strip():
        prob.append((q["nr"], "gruen", "Stamm == Gelb"))

# Render MD
EMO = {"gelb":"🟨 Gelb","gruen":"🟩 Grün","blau":"🟦 Blau","braun":"🟫 Braun","schwarz":"⬛ Schwarz"}
def rs(key, s):
    out=[f"**{EMO[key]}**  *( {s.get('typ','')} )*","",s.get("stamm","").strip()]
    if s.get("aussagen"):
        out.append("")
        for k,v in s["aussagen"].items(): out.append(f"{k}. {v}")
    out.append("")
    sol=set(s.get("loesung") or [])
    for k,v in s.get("optionen",{}).items(): out.append(f"- {k}) {v}{' ✅' if k in sol else ''}")
    out += ["", f"*Lösung: {', '.join(s.get('loesung') or [])}*"]
    return "\n".join(out)
md=[f"# Heilpraktikerprüfung Psychotherapie — {TITEL}",
    "## Komplett über alle fünf Gürtel (Gelb → Grün → Blau → Braun → Schwarz)","",
    "*Übersetzungs-Rezeptur v5. Schwarz = Originalfrage; übrige Stufen neu formuliert.*",""]
for q in parts:
    md += ["\n---\n", f"## Frage {q['nr']} — {q.get('thema','')}", f"*Wissenskern: {q.get('kern','')}*\n"]
    for k in ORDER:
        if k in q["stufen"]: md += [rs(k,q["stufen"][k]),""]
open(os.path.join(ROOT, f"Prüfung_{SHORT}_alle_Guertel.md"),"w",encoding="utf-8").write("\n".join(md))

print(f"Fragen: {len(parts)} | Datei: fragen_{SHORT}.json")
print("Probleme:", prob if prob else "KEINE (alle Schwarz=Original, alle Lösungen gültig, Grün≠Gelb)")
