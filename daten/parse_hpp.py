#!/usr/bin/env python3
"""Deterministischer Parser: HPP-Prüfungs-Textdateien -> kompakte JSON.
Kein LLM, reine Regex/Heuristik. Token-schonend.
"""
import re, json, sys, glob, os

SRC_DIR = "/sessions/youthful-tender-pasteur/mnt/HPP-App/Schriftliche Prüfing"
OUT_DIR = "/sessions/youthful-tender-pasteur/mnt/HPP-App/daten"

NOISE = re.compile(
    r"^(?:\*\).*ohne Gewähr|www\.|Heilpraktikerprüfung \(beschränkt|©|Angaben alle ohne|"
    r"Seite \d+ von \d+).*", re.I)
QSTART = re.compile(r"^\s*(\d{1,2})\.\s*(Mehrfachauswahl|Aussagenkombination|Einfachauswahl)\b", re.I)
OPT = re.compile(r"^\s*([A-E])\)\s*(.*)")
STMT = re.compile(r"^\s*([1-9])\.\s+(.*)")
SOLLINE = re.compile(r"^\s*(\d{1,2})[\.\):]?\s+((?:[A-E])(?:\s*,\s*[A-E])*)\s*$")

def clean_lines(text):
    out = []
    for ln in text.splitlines():
        s = ln.strip()
        if not s or NOISE.match(s):
            continue
        out.append(s)
    return out

def split_solution(lines):
    """Trennt Fragenteil vom Lösungsschlüssel."""
    idx = None
    for i, ln in enumerate(lines):
        if re.search(r"L[öo]sungsschl[üu]ssel", ln, re.I) and not OPT.match(ln):
            idx = i
            break
    if idx is None:
        return lines, {}
    body = lines[:idx]
    sol = {}
    for ln in lines[idx:]:
        m = SOLLINE.match(ln)
        if m:
            sol[int(m.group(1))] = [x.strip() for x in m.group(2).split(",")]
    return body, sol

def parse_exam(path):
    text = open(path, encoding="utf-8").read()
    lines = clean_lines(text)
    body, sol = split_solution(lines)
    # Fragen segmentieren
    starts = [i for i, ln in enumerate(body) if QSTART.match(ln)]
    fragen = []
    for k, si in enumerate(starts):
        ei = starts[k+1] if k+1 < len(starts) else len(body)
        block = body[si:ei]
        m = QSTART.match(block[0])
        nr, typ = int(m.group(1)), m.group(2)
        rest = block[1:]
        # Optionen finden
        opt_idx = [j for j, ln in enumerate(rest) if OPT.match(ln)]
        stamm_end = opt_idx[0] if opt_idx else len(rest)
        # Aussagen (1..5) im Stamm-Bereich
        stamm_lines, aussagen = [], {}
        cur = None
        for ln in rest[:stamm_end]:
            sm = STMT.match(ln)
            if sm:
                cur = int(sm.group(1)); aussagen[cur] = sm.group(2)
            elif cur is not None:
                aussagen[cur] += " " + ln
            else:
                stamm_lines.append(ln)
        # Optionen einsammeln (A-E, mehrzeilig)
        optionen, curo = {}, None
        for ln in rest[stamm_end:]:
            om = OPT.match(ln)
            if om:
                curo = om.group(1); optionen[curo] = om.group(2)
            elif curo is not None:
                optionen[curo] += " " + ln
        fragen.append({
            "nr": nr, "typ": typ,
            "stamm": " ".join(stamm_lines).strip(),
            "aussagen": {str(k2): v for k2, v in sorted(aussagen.items())} or None,
            "optionen": optionen,
            "loesung": sol.get(nr),
        })
    return fragen

def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    files = sorted(glob.glob(os.path.join(SRC_DIR, "HPP_*.txt")))
    only = sys.argv[1] if len(sys.argv) > 1 else None
    all_exams, stats = [], []
    for f in files:
        base = os.path.basename(f)
        if only and only not in base:
            continue
        pid = base.replace("HPP_", "").replace(".txt", "")
        fragen = parse_exam(f)
        n = len(fragen)
        n_opt = sum(1 for q in fragen if len(q["optionen"]) >= 2)
        n_sol = sum(1 for q in fragen if q["loesung"])
        all_exams.append({"pruefung_id": pid, "quelle": base, "fragen": fragen})
        stats.append((base, n, n_opt, n_sol))
    out_path = os.path.join(OUT_DIR, "fragen_original.json" if not only else f"_probe_{only}.json")
    json.dump(all_exams, open(out_path, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    print(f"{'Datei':32} Fragen  m.Optionen  m.Lösung")
    for b, n, no, ns in stats:
        flag = "" if (n == 28 and no == 28 and ns == 28) else "  <-- prüfen"
        print(f"{b:32} {n:5}   {no:6}    {ns:6}{flag}")
    print(f"\nGespeichert: {out_path}")

if __name__ == "__main__":
    main()
