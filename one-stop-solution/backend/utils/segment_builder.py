
# Batch 7E-3 — Segment Builder Engine
# Handles:
# - Route normalization
# - Suspicious fix detection
# - Memory-assisted fix repair
# - Online validation (only if required)
# - Duplicate elimination

import re
from backend.utils.fix_validator import validate_fix
from backend.utils.memory_engine import memory_lookup

def is_suspicious_fix(fix):
    if not fix:
        return True
    if len(fix) < 3 or len(fix) > 7:
        return True
    if not fix.isalnum():
        return True
    if not fix[0].isalpha():
        return True
    if fix.upper() in ["SFC","TO","AND","WI"]:
        return True
    return False

def normalize_route_name(r):
    r=r.upper()
    if r.startswith(("U","W")) and len(r)>1:
        return r  # leave UW/AW etc.
    return r

def build_segments(raw_segments, fl_info):
    output=[]
    seen=set()

    for seg in raw_segments:
        rte = normalize_route_name(seg.get("route",""))
        p1  = seg.get("from","").upper()
        p2  = seg.get("to","").upper()

        # Memory repair if suspicious
        if is_suspicious_fix(p1):
            mem=memory_lookup(p1)
            if mem: p1=mem
        if is_suspicious_fix(p2):
            mem=memory_lookup(p2)
            if mem: p2=mem

        # Validate only if suspicious
        if is_suspicious_fix(p1):
            fixed = validate_fix(p1)
            if fixed: p1=fixed
        if is_suspicious_fix(p2):
            fixed = validate_fix(p2)
            if fixed: p2=fixed

        if not p1 or not p2: 
            continue

        key=f"{rte}:{p1}-{p2}"
        if key in seen:
            continue
        seen.add(key)

        fl_string=f"FL{fl_info['fl_lower']:03d}-FL{fl_info['fl_upper_final']:03d}"

        output.append({
            "route": rte,
            "from": p1,
            "to": p2,
            "segment": f"{p1}-{p2}",
            "fl": fl_string
        })
    return output
