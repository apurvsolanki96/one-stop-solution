
# Batch 7E‑1 — Full FL Utility Engine
# Implements:
# 1. FL priority: Line > F/G > Q-line
# 2. Meter → Feet → FL (ROUND UP)
# 3. Q-line ceiling clamp (final override)
# 4. FL structure output with adjustment metadata

import re
import math

def meters_to_feet(m):
    return m * 3.28084

def feet_to_fl(ft):
    return math.ceil(ft / 100)  # ROUND UP as per user choice

def extract_fl_from_FG(text):
    """
    Extracts F) lower and G) upper lines.
    Returns tuple: (lower, upper) or (None, None)
    """
    f_match = re.search(r'F\)\s*([A-Z0-9]{2,6})', text)
    g_match = re.search(r'G\)\s*([A-Z0-9]{2,6})', text)

    def normalize(val):
        if not val:
            return None
        if val.upper().startswith("FL"):
            return int(val.upper().replace("FL",""))
        if val.endswith("M"):
            try:
                meters = int(val[:-1])
                ft = meters_to_feet(meters)
                return feet_to_fl(ft)
            except:
                return None
        if val.isdigit():
            return int(val)
        return None

    return normalize(f_match.group(1) if f_match else None), normalize(g_match.group(1) if g_match else None)


def extract_fl_from_inline(text):
    """
    Detect inline forms like:
    - SFC TO FL230
    - 2500M-7500M
    """
    # FL inline
    m = re.search(r'FL(\d{2,3})\s*[-TOto]+\s*FL(\d{2,3})', text, re.IGNORECASE)
    if m:
        return int(m.group(1)), int(m.group(2))

    # meters inline
    m2 = re.search(r'(\d{3,5})M[-TOto]+(\d{3,5})M', text)
    if m2:
        lo_m = int(m2.group(1))
        hi_m = int(m2.group(2))
        lo_ft = meters_to_feet(lo_m)
        hi_ft = meters_to_feet(hi_m)
        return feet_to_fl(lo_ft), feet_to_fl(hi_ft)

    return None, None


def extract_fl_from_qline(text):
    """
    Q-line FL extraction: ... /E/xxx/yyy/ ...
    """
    m = re.search(r'/E/(\d{1,3})/(\d{1,3})/', text)
    if m:
        return int(m.group(1)), int(m.group(2))
    return None, None


def extract_fl(text):
    """
    MASTER FL extraction system.
    Priority:
    1) Inline FL (SFC-XXXX)
    2) F/G lines
    3) Q-line fallback
    Then apply Q-line ceiling clamp.
    """

    # Step 1: Inline
    inline_lo, inline_hi = extract_fl_from_inline(text)

    # Step 2: FG lines
    fg_lo, fg_hi = extract_fl_from_FG(text)

    # Step 3: Q-line fallback
    q_lo, q_hi = extract_fl_from_qline(text)

    # Build chosen FL
    chosen_lo = inline_lo or fg_lo or q_lo
    chosen_hi = inline_hi or fg_hi or q_hi

    # Safety: defaults
    if chosen_lo is None:
        chosen_lo = 0
    if chosen_hi is None:
        chosen_hi = 999  # very high if undefined

    # Apply Q-line ceiling clamp
    final_hi = chosen_hi
    was_adjusted = False

    if q_hi is not None and chosen_hi > q_hi:
        final_hi = q_hi
        was_adjusted = True

    return {
        "fl_lower": chosen_lo,
        "fl_upper_raw": chosen_hi,
        "fl_upper_final": final_hi,
        "qline_upper": q_hi,
        "adjusted": was_adjusted
    }
