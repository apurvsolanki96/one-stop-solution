import re
from utils.fl_utils import extract_flight_levels
from utils.similarity import find_similar_memory
from utils.confidence import score_output
from utils.memory_engine import save_memory_entry

# Core full hybrid parser engine (compact version)

def normalize_text(t):
    t = t.replace("\n", " ")
    t = re.sub(r"\s+", " ", t)
    return t.strip()

def extract_segments(text):
    text = normalize_text(text)
    segs = []

    # Patterns like A28 TELVO-MUT
    p1 = re.findall(r"\b([A-Z][A-Z0-9]{1,4})\s+([A-Z0-9]{3,5})[-–]([A-Z0-9]{3,5})\b", text)
    for r, a, b in p1:
        segs.append((r, a, b))

    # Lists like A909 KEKAL-BODBA-ABDAN
    p2 = re.findall(r"\b([A-Z][A-Z0-9]{1,4})\s+([A-Z0-9\-–\s]{5,40})", text)
    for route, chain in p2:
        pts = re.split(r"[-–]\s*", chain)
        pts = [p.strip() for p in pts if len(p.strip())>=3]
        for i in range(len(pts)-1):
            segs.append((route, pts[i].upper(), pts[i+1].upper()))

    return segs

def parse_notam_advanced(notam):
    norm = normalize_text(notam)

    # 1) Extract FL band
    fl_min, fl_max = extract_flight_levels(norm)

    # 2) Try rule-based extraction
    segments = extract_segments(norm)

    if len(segments) == 0:
        # 3) Try memory fallback
        mem = find_similar_memory(norm)
        if mem:
            return mem

        # 4) AI fallback handled in router, return empty trigger
        return ""

    # Build aviation text
    lines = []
    json_list = []
    for rte, a, b in segments:
        line = f"{rte} {a}-{b} {fl_min}-{fl_max}"
        lines.append(line)
        json_list.append({
            "route": rte,
            "from": a,
            "to": b,
            "fl_min": fl_min,
            "fl_max": fl_max
        })

    aviation = "\n".join(lines)
    result = aviation + "\n\nJSON:\n" + str(json_list)

    # Score + store in memory
    sc = score_output(result)
    if sc >= 0.5:
        save_memory_entry(notam, aviation)

    return result
