
# Batch 7E-2 — Q-line + E-line Extraction Engine

import re

def extract_qline(text):
    """
    Extracts FIR, coords, radius, FL from Q-line.
    Q)XXXX/XXXXX/..../RRR/BBBBB
    """
    qmatch = re.search(r'Q\)\s*([A-Z]{4})/([A-Z0-9]{4,5})/IV/[A-Z]{1,3}/E/(\d{1,3})/(\d{1,3})/?(\d{0,3})', text)
    if not qmatch:
        return {}

    return {
        "fir": qmatch.group(1),
        "code": qmatch.group(2),
        "fl_lower": int(qmatch.group(3)),
        "fl_upper": int(qmatch.group(4)),
        "radius": qmatch.group(5) if qmatch.group(5) else None
    }


def extract_e_line_routes(text):
    """
    Extract segments from E) lines:
    E) ATS RTE CLSD WI SEGMENTS: A123 ABC-DEF, B456 GHI-JKL.
    """
    block = ""
    capture = False
    lines = text.splitlines()

    for ln in lines:
        if re.search(r'ATS RTE CLSD', ln, re.IGNORECASE):
            capture = True
        if capture:
            block += " " + ln

    block = block.replace("\n"," ").strip()
    if not block:
        return []

    # Remove "E)" prefix if present
    block = re.sub(r'^E\)\s*', '', block, flags=re.IGNORECASE)

    # Extract segments like AWY PT1-PT2
    segs = re.findall(r'([A-Z0-9]+)\s+([A-Z0-9]{2,10})-([A-Z0-9]{2,10})', block)

    results=[]
    for route, p1, p2 in segs:
        results.append({
            "route": route,
            "from": p1,
            "to": p2
        })
    return results

def extract_e_text(text):
    """
    Raw E) line for AI fallback or soft merge
    """
    e_match = re.search(r'E\)([\s\S]+?)(?=F\)|G\)|$)', text)
    if not e_match:
        return ""
    return e_match.group(1).strip()
