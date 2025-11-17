
# Batch 8.2 — FL Master Engine
# Handles:
# - Extract FL from E-line
# - Extract FL from F/G
# - Extract FL from Q-line
# - Convert FT/M/AMSL/AGL
# - Clamp against Q-line (final defense)

import re

def extract_q_fl(qline):
    """Extract FL from Q-line, format: .... /E/XXX/YYY/"""
    if not qline:
        return None, None
    m = re.search(r"/E/(\d{3})/(\d{3})/", qline)
    if m:
        return int(m.group(1)), int(m.group(2))
    return None, None

def meters_to_fl(m_val):
    ft = m_val * 3.28084
    return int(round(ft / 100))

def feet_to_fl(ft_val):
    return int(round(ft_val / 100))

def parse_alt_string(text):
    """
    Detect FT, M, AMSL, AGL, UNL, SFC
    Returns altitude in FL units.
    """
    t = text.upper()

    # Unlimited
    if "UNL" in t or "UNLIMITED" in t:
        return 999  # very high FL

    # Surface
    if "SFC" in t:
        return 0

    # Feet
    m = re.search(r"(\d{2,5})\s*FT", t)
    if m:
        return feet_to_fl(int(m.group(1)))

    # Meters
    m = re.search(r"(\d{2,5})\s*M", t)
    if m:
        return meters_to_fl(int(m.group(1)))

    # Direct FL
    m = re.search(r"FL(\d{2,3})", t)
    if m:
        return int(m.group(1))

    return None

def extract_inline_fl(eline):
    """Search inline E-line for altitudes."""
    if not eline:
        return None, None

    lower = None
    upper = None

    # patterns like "SFC TO FL230" or "SFC TO 2200M"
    m = re.search(r"(SFC|FL\d+|\d+ ?FT|\d+ ?M).*?TO.*?(FL\d+|\d+ ?FT|\d+ ?M|UNL)", eline)
    if m:
        lower = parse_alt_string(m.group(1))
        upper = parse_alt_string(m.group(2))

    return lower, upper

def extract_fg_fl(fline, gline):
    """Extract numeric values from F) and G) lines."""
    def num(x):
        if not x:
            return None
        # F/G often give raw numbers: 000, 230, etc.
        m = re.search(r"(\d{1,3})", x)
        if m:
            v = int(m.group(1))
            return v
        return None

    f_val = num(fline)
    g_val = num(gline)

    return f_val, g_val

def combine_fl(inline, fg, qline):
    """
    Apply priority:
    1. Inline
    2. F/G
    3. Q-line
    Then clamp to Q-line.
    """
    inline_low, inline_high = inline
    fg_low, fg_high = fg
    q_low, q_high = extract_q_fl(qline)

    # Determine base values
    low = inline_low or fg_low or q_low or 0
    high = inline_high or fg_high or q_high or 999

    original_low = low
    original_high = high
    adjusted = False
    reason = None

    # Clamp against Q-line
    if q_low is not None and low < q_low:
        low = q_low
        adjusted = True
        reason = "clamped-lower-to-q"

    if q_high is not None and high > q_high:
        high = q_high
        adjusted = True
        reason = "clamped-upper-to-q"

    return {
        "fl_lower": low,
        "fl_upper_final": high,
        "inline_source_low": inline_low,
        "inline_source_high": inline_high,
        "fg_source_low": fg_low,
        "fg_source_high": fg_high,
        "q_low": q_low,
        "q_high": q_high,
        "adjusted": adjusted,
        "reason": reason,
        "original_low": original_low,
        "original_high": original_high
    }

def fl_master(eline, fline, gline, qline):
    inline = extract_inline_fl(eline)
    fg = extract_fg_fl(fline, gline)
    return combine_fl(inline, fg, qline)
