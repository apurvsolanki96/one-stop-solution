#!/usr/bin/env python3
"""
Enhanced offline NOTAM parser (updated to handle user examples)

Features:
- Extracts ATS route closures and outputs standardized lines:
    <ROUTE> <POINT1>-<POINT2> FLxxx-FLxxx
- Priority for flight levels:
    1) inline AWY FL on route line
    2) F) and G) fields
    3) Q-line LLL/UUU
- Handles "FROM GND TO FLxxx", "FM FL000 TO FL167", "FROM FL000 TO FL301", "GND-FL999"
- Parses meters (e.g., 10,400M), ranges using "AND", "BTN ... AND ..."
- Converts meters→FL and caps by Q-line upper if present
- Treats SFC/GND as FL000
- Handles comma-separated AWY lists and multi-line lists
- Normalizes waypoint names like "NDB (BD)" -> "BD", "VOR 'JIG'" -> "JIG"
- Implements rule: "RAISED TO FLxxx" -> cap upper FL to (FLxxx - 5)
- Outputs JSON and plain lines; writes <file>.parsed.json when used on a file
"""

import re, sys, json
from math import floor

# ---------------------------
# Utilities
# ---------------------------
def meters_to_fl(meters):
    return int(round(meters / 30.48))

def feet_to_fl(feet):
    return int(round(feet / 100.0))

def fmt_fl(fl):
    if fl is None:
        return "UNK"
    return f"FL{int(fl):03d}"

def normalize_ident(s):
    if not s:
        return s
    t = s.strip().upper()
    # remove descriptors
    t = re.sub(r"VORDME|VOR|NDB|DME", "", t)
    # remove parentheses and quotes and punctuation except hyphen
    t = re.sub(r"[()\']", "", t)
    t = re.sub(r"[^A-Z0-9\-]", " ", t)
    t = re.sub(r"\s+", "", t)
    return t

# ---------------------------
# Extract Q-line (priority 3)
# ---------------------------
def extract_q_limits(text):
    # Common Q line: .../E/240/310/...
    m = re.search(r'\bQ\)[^/]*?/[^/]*?/[^/]*?/[^/]*?/(\d{1,3})/(\d{1,3})/', text)
    if m:
        return int(m.group(1)), int(m.group(2))
    m2 = re.search(r'\bQ\)[\s\S]*?/E/(\d{1,3})/(\d{1,3})', text)
    if m2:
        return int(m2.group(1)), int(m2.group(2))
    return None, None

# ---------------------------
# Extract F) and G) fields (priority 2)
# ---------------------------
def extract_f_g(text):
    f=None; g=None
    m_f = re.search(r'\bF\)\s*([^\n\r]+)', text)
    m_g = re.search(r'\bG\)\s*([^\n\r]+)', text)
    def parse_token(tok):
        if not tok: return None
        tok = tok.strip().upper()
        if tok in ("GND","SFC"):
            return 0
        mfl = re.search(r'FL\s*(\d{1,3})', tok)
        if mfl: return int(mfl.group(1))
        m_m = re.search(r'(\d{3,6})M\b', tok)
        if m_m: return meters_to_fl(int(m_m.group(1)))
        m_ft = re.search(r'(\d{3,6})FT\b', tok)
        if m_ft: return feet_to_fl(int(m_ft.group(1)))
        # bare digits
        m2 = re.search(r'\b(\d{1,3})\b', tok)
        if m2: return int(m2.group(1))
        return None
    if m_f: f = parse_token(m_f.group(1))
    if m_g: g = parse_token(m_g.group(1))
    return f,g

# ---------------------------
# Parse "RAISED TO FLxxx" special rule
# ---------------------------
def extract_raised_to(text):
    m = re.search(r'RAISED TO FL\s*(\d{1,3})', text, re.IGNORECASE)
    if m:
        return int(m.group(1))
    return None

# ---------------------------
# Find AWY/route segments - handles lists and multi-line comma separated entries
# ---------------------------
def find_segments(text):
    segs = []
    # normalize commas that separate items across lines
    # We will find patterns like "AWY L321 KUNKI/OBRAN," or lines listing AWYs multiple items separated by commas
    # First, split E) section or full text
    # Look for E) section
    e_section = text
    m_e = re.search(r'\bE\)([\s\S]+)$', text)
    if m_e:
        e_section = m_e.group(1)
    # split by lines, but also treat commas as separators inside E section
    # Replace sequences like 'AWY ' start markers preceded by comma with newline to split lists
    normalized = re.sub(r',\s*AWY', '\nAWY', e_section, flags=re.IGNORECASE)
    # Also replace commas followed by route codes or uppercase patterns with newline
    normalized = re.sub(r',\s*([A-Z]{1,3}\d{0,4}\b)', r'\n\1', normalized)
    lines = normalized.splitlines()
    # pattern for route code + pair e.g. L736 NEDRA-GOMED FL045-FL130
    route_re = re.compile(r'\b([A-Z]{1,2}(?:/[A-Z]{1,2})?\d{0,4})\b', re.IGNORECASE)
    pair_re = re.compile(r'([A-Z0-9\'\(\)\s\-]+?)\s*-\s*([A-Z0-9\'\(\)\s\-]+)', re.IGNORECASE)
    # Additional patterns for forms like "L736 NEDRA-GOMED FL045-FL130" or "L736  NEDRA-GOMED FL045-FL130"
    for ln in lines:
        ln2 = ln.strip()
        if not ln2:
            continue
        # sometimes list entries don't include explicit AWY token; try to find route + waypoint pair
        # remove leading list numbers "1." "2."
        ln2 = re.sub(r'^\d+\.\s*', '', ln2)
        # find route code (may be 'AWY L321' or 'L321' alone)
        rt = None
        m = re.search(r'\bAWY\s+([A-Z]{1,2}(?:/[A-Z]{1,2})?\d{1,4})', ln2, re.IGNORECASE)
        if m:
            rt = m.group(1).upper()
        else:
            m2 = route_re.search(ln2)
            if m2:
                rt = m2.group(1).upper()
        # find pair
        pair = pair_re.search(ln2)
        if pair:
            wp1 = normalize_ident(pair.group(1))
            wp2 = normalize_ident(pair.group(2))
        else:
            # sometimes format is "L321 KUNKI/OBRAN" with slash instead of hyphen
            mslash = re.search(r'([A-Z0-9]+)\s+([A-Z0-9]+)/([A-Z0-9]+)', ln2)
            if mslash:
                wp1 = normalize_ident(mslash.group(2))
                wp2 = normalize_ident(mslash.group(3))
            else:
                # also handle "BTN X AND Y" or "X TO Y"
                mbtn = re.search(r'BTN\s+([A-Z0-9\'\s]+)\s+AND\s+([A-Z0-9\'\s]+)', ln2, re.IGNORECASE)
                if mbtn:
                    wp1 = normalize_ident(mbtn.group(1))
                    wp2 = normalize_ident(mbtn.group(2))
                else:
                    mto = re.search(r'([A-Z0-9\'\s]+)\s+TO\s+([A-Z0-9\'\s]+)', ln2, re.IGNORECASE)
                    if mto:
                        # choose earlier tokens that look like idents
                        wp1 = normalize_ident(mto.group(1).split()[-1])
                        wp2 = normalize_ident(mto.group(2).split()[-1])
                    else:
                        # fallback: skip
                        continue
        # inline FL on same line?
        fl_low = fl_high = None
        # patterns: "FL045-FL130" or "FL045/FL130" or "FL000 TO FL167" or "FROM FL000 TO FL351"
        mfl = re.search(r'FL\s*(\d{1,3})\s*[-\/]\s*FL\s*(\d{1,3})', ln2, re.IGNORECASE)
        if mfl:
            fl_low = int(mfl.group(1)); fl_high = int(mfl.group(2))
        else:
            mfl2 = re.search(r'FROM\s+FL\s*(\d{1,3})\s+TO\s+FL\s*(\d{1,3})', ln2, re.IGNORECASE)
            if mfl2:
                fl_low = int(mfl2.group(1)); fl_high = int(mfl2.group(2))
            else:
                mfl3 = re.search(r'FM\s*FL\s*(\d{1,3})\s*TO\s*FL\s*(\d{1,3})', ln2, re.IGNORECASE)
                if mfl3:
                    fl_low = int(mfl3.group(1)); fl_high = int(mfl3.group(2))
        # meters inline: "AT 10,400M AND BELOW" or "BTN 6,300M AND 9,200M"
        meters = re.findall(r'(\d{1,3}(?:,\d{3})?)\s*M', ln2, re.IGNORECASE)
        meters = [int(m.replace(',', '')) for m in meters] if meters else []
        # feet inline
        feet = re.findall(r'(\d{1,6})\s*FT', ln2, re.IGNORECASE)
        feet = [int(f) for f in feet] if feet else []
        segs.append({
            "route": rt,
            "wp1": wp1,
            "wp2": wp2,
            "line_fl_low": fl_low,
            "line_fl_high": fl_high,
            "meters": meters,
            "feet": feet,
            "raw": ln2
        })
    return segs

# ---------------------------
# Determine FL for segment using priority rules
# ---------------------------
def choose_fl(seg, f_g, q_limits, raised_to=None):
    q_low, q_high = q_limits
    f_limit, g_limit = f_g
    # 1) AWY line FL
    if seg.get("line_fl_low") is not None and seg.get("line_fl_high") is not None:
        low = seg["line_fl_low"]; high = seg["line_fl_high"]
    # 2) F/G fields
    elif f_limit is not None or g_limit is not None:
        low = f_limit if f_limit is not None else (q_low if q_low is not None else 0)
        high = g_limit if g_limit is not None else (q_high if q_high is not None else low)
    # 3) Q-line and meters/feet conversions
    else:
        # if meters specified, convert them
        if seg.get("meters"):
            # heuristics: if two meters values given, use min as low, max as high. if single value and phrasing '...AND BELOW' assume low=0
            mlist = sorted(seg["meters"])
            if len(mlist) >= 2:
                low = meters_to_fl(mlist[0]); high = meters_to_fl(mlist[-1])
            else:
                # single meter value -> typically "AT X M AND BELOW" -> low = 0 ; high = converted value
                low = 0
                high = meters_to_fl(mlist[0])
        elif seg.get("feet"):
            flist = sorted(seg["feet"])
            if len(flist) >= 2:
                low = feet_to_fl(flist[0]); high = feet_to_fl(flist[-1])
            else:
                low = 0
                high = feet_to_fl(flist[0])
        else:
            # fallback to Q-line if present
            if q_low is not None and q_high is not None:
                low = q_low; high = q_high
            else:
                # unknown -> default to GND-FL999
                low = 0; high = 999
    # cap by Q-line upper if present
    if q_high is not None and high is not None:
        high = min(high, q_high)
        low = max(low, q_low) if q_low is not None else low
    # apply RAISED TO FLxxx rule: reduce upper by 5 FL if raised_to present
    if raised_to is not None and isinstance(raised_to, int):
        cap = raised_to - 5
        if high is not None:
            high = min(high, cap)
    return low, high

# ---------------------------
# Expand dual designators like 'L/UL851' -> ['L851','UL851']
# ---------------------------
def expand_route_variants(rt):
    if not rt:
        return []
    rt = rt.replace(" ", "")
    m = re.match(r'^([A-Z]{1,2})/([A-Z]{1,2})(\d{1,4})$', rt)
    if m:
        a,b,num = m.groups()
        return [f"{a}{num}", f"{b}{num}"]
    # if pattern like 'L/UL 851' we might get route= 'L/UL' and digits elsewhere, but our find_segments will usually capture digits in route token
    m2 = re.match(r'^([A-Z]{1,2}\d{1,4})$', rt)
    if m2:
        return [rt]
    # fallback return route token as-is
    return [rt]

# ---------------------------
# High-level parse function
# ---------------------------
def parse_notam(text):
    text = text.replace("\r\n", "\n")
    q_limits = extract_q_limits(text)
    f_g = extract_f_g(text)
    raised_to = extract_raised_to(text)
    segments = find_segments(text)
    outputs = []
    details = []
    for s in segments:
        rt = s.get("route")
        variants = expand_route_variants(rt)
        low, high = choose_fl(s, f_g, q_limits, raised_to=raised_to)
        for v in variants:
            out = f"{v} {s['wp1']}-{s['wp2']} {fmt_fl(low)}-{fmt_fl(high)}"
            outputs.append(out)
        details.append({
            "route_token": rt,
            "variants": variants,
            "wp1": s['wp1'],
            "wp2": s['wp2'],
            "low": low,
            "high": high,
            "raw": s['raw'],
            "meters": s.get("meters"),
            "feet": s.get("feet")
        })
    # deduplicate preserve order
    seen=set(); uniq=[]
    for o in outputs:
        if o not in seen:
            uniq.append(o); seen.add(o)
    return {
        "q_limits":{"low": q_limits[0], "high": q_limits[1]},
        "f_g":{"F": f_g[0], "G": f_g[1]},
        "raised_to": raised_to,
        "outputs": uniq,
        "details": details
    }

# ---------------------------
# CLI demo / file mode
# ---------------------------
if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python notam_parser.py <notam_file.txt>")
        print("Runs demo on built-in sample if no file provided.\n")
        demo = """A3088/25 NOTAMN
Q)LTAA/QANLC/IV/NBO/E/000/300/4216N03553E088
A)LTAA B)2507190700 C)2507201700
D)0700-1700
E)RNAV ROUTES-SEGMENTS AFFECTED DURING EXERCISE AS FOLLOWS:
1.AWY L/UL851 KUGOS-OLUPO SEGMENT CLSD.
2.AWY M/UM859 OSDIP-KARDE SEGMENT CLSD.
3.AWY N/UN644 SIN-KARDE SEGMENT CLSD.
4.AWY UM860 SIN-CRM SEGMENT CLSD.
5.AWY M/UM10 OLUPO-GOKPA SEGMENT CLSD. 
VERTICAL LIMITS: SFC-30000FT AMSL"""
        res = parse_notam(demo)
        print("Plain outputs:")
        for l in res["outputs"]:
            print(l)
        print("\nJSON:")
        print(json.dumps(res, indent=2))
        sys.exit(0)
    fn = sys.argv[1]
    with open(fn, 'r', encoding='utf-8') as f:
        txt = f.read()
    r = parse_notam(txt)
    for line in r["outputs"]:
        print(line)
    outfn = fn + ".parsed.json"
    with open(outfn, 'w', encoding='utf-8') as wf:
        json.dump(r, wf, indent=2)
    print(f"\nJSON written to {outfn}")
