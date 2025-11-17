
# Batch 8.3 — E‑Line Route Extraction + Segment Builder Integration
# Connects: normalize → fl_master → segment_builder

import re
from backend.utils.segment_builder import build_segments
from backend.utils.fl_master import fl_master

def extract_raw_segments(eline):
    """
    Pull raw route segments from E-line.
    Examples handled:
    - A909 KEKAL-BODBA-ABDAN
    - A846 MAVAX-ABDAN
    - 1-AWY A/UA28 TELVO-MUT CLSD
    - 2-AWY W/UW75 AZBUL-SELVI CLSD
    """
    if not eline:
        return []

    e = eline.upper()

    # Match routes like A909 XXX-YYY-... or AWY A/UA28 ...
    pattern = r'(A|B|G|R|W|UA|UB|UG|UR|UW)?\s?([A-Z]{1,3}\d{1,4})\s+([A-Z0-9\-\s]+)'
    results = []

    for m in re.finditer(pattern, e):
        route_prefix = m.group(1) or ""
        route_number = m.group(2)
        route = (route_prefix + route_number).replace(" ", "")
        seg_text = m.group(3).strip()

        # Break into FIX pairs
        fixes = [f.strip() for f in re.split(r'-', seg_text) if f.strip()]

        for i in range(len(fixes)-1):
            results.append({
                "route": route,
                "from": fixes[i],
                "to": fixes[i+1]
            })

    return results

def process_eline(eline, fline, gline, qline):
    """
    Master E-line processor → FL → segment builder
    Returns final segments + fl_info
    """
    # Step 1: FL extraction
    fl_info = fl_master(eline, fline, gline, qline)

    # Step 2: Extract raw segments
    raw = extract_raw_segments(eline)

    # Step 3: Build validated, normalized segments
    segments = build_segments(raw, fl_info)

    return segments, fl_info
