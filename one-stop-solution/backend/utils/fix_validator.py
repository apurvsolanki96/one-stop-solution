"""
fix_validator.py
Validates and normalizes FIX / NAVAID / WAYPOINT identifiers.
Used by parser, segment builder, route logic, and memory engine.
"""

import re
from backend.utils.memory_engine import memory_lookup_fix


# -------------------------
# ICAO FIX/NAVAID PATTERNS
# -------------------------
WAYPOINT_RE = re.compile(r"^[A-Z]{3,5}$")
NAVAID_RE = re.compile(r"^[A-Z]{2,3}(VOR|NDB|DME)?$", re.IGNORECASE)
AIRPORT_RE = re.compile(r"^[A-Z]{4}$")


def is_valid_fix(code: str) -> bool:
    """
    Valid waypoint/fix rules:
    - 3–5 letters (typical ICAO fix)
    - 2–3 letters + VOR/NDB/DME
    - 4 letter ICAO airport code
    """
    if not code:
        return False

    c = code.strip().upper()

    return (
        bool(WAYPOINT_RE.match(c))
        or bool(NAVAID_RE.match(c))
        or bool(AIRPORT_RE.match(c))
    )


def normalize_fix(code: str) -> str:
    """
    Normalizes common weird inputs:
    - Remove parentheses: (FIX) → FIX
    - Remove quotes: 'FIX' → FIX
    - Remove spaces
    - Uppercase
    """
    if not code:
        return ""

    c = (
        code.replace("'", "")
            .replace('"', "")
            .replace("(", "")
            .replace(")", "")
            .strip()
            .upper()
    )

    return c


def guess_fix_from_memory(bad_fix: str) -> str | None:
    """
    If fix is invalid, we try to recover it from memory.
    Memory learns from previous NOTAMs.
    Example:
      bad: 'MEVAX'
      memory: 'MAVAX'
    """
    try:
        correction = memory_lookup_fix(bad_fix)
        return correction
    except Exception:
        return None


def validate_fix(code: str) -> str | None:
    """
    Validates AND corrects fix names.
    Steps:
    1. Normalize basic formatting.
    2. Check if valid.
    3. If invalid → try memory correction.
    4. If still invalid → hard reject (return None).
    """
    c = normalize_fix(code)

    # Valid as-is
    if is_valid_fix(c):
        return c

    # Try memory-based correction
    mem = guess_fix_from_memory(c)
    if mem and is_valid_fix(mem):
        return mem

    # Example heuristic correction:
    # Some NOTAMs use xxxVOR or xxx NDB incorrectly.
    if c.endswith("VOR") or c.endswith("NDB") or c.endswith("DME"):
        cut = c.replace("VOR", "").replace("NDB", "").replace("DME", "")
        if is_valid_fix(cut):
            return cut

    # If not valid → None
    return None
