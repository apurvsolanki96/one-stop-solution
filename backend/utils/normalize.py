
# Batch 8.1 — Input Normalization Engine
# Cleans NOTAM text, splits sections, prepares for parsing.

import re

SECTION_KEYS = ["Q)", "A)", "B)", "C)", "D)", "E)", "F)", "G)"]

def clean_raw_notam(text):
    """Basic normalization: whitespace, uppercase, remove zero-width chars."""
    if not text:
        return ""
    t = text.replace("\u200B"," ").replace("\uFEFF"," ").replace("\u00A0"," ")
    t = t.replace("\r","\n")
    t = re.sub(r'\n+', '\n', t)
    t = re.sub(r'[ \t]+', ' ', t)
    return t.strip().upper()

def split_sections(text):
    """
    Splits NOTAM into dictionary:
    { "Q": "...", "A": "...", "E": "..." }
    """
    out = {k.replace(")",""): "" for k in SECTION_KEYS}
    lines = text.split("\n")

    current = None
    for ln in lines:
        for key in SECTION_KEYS:
            if ln.startswith(key):
                current = key.replace(")","")
                out[current] = ln[len(key):].strip()
                break
        else:
            if current:
                out[current] += " " + ln.strip()

    # Final cleanup
    for k in out:
        out[k] = out[k].strip()

    return out

def normalize_notam(text):
    """Full normalization pipeline."""
    cleaned = clean_raw_notam(text)
    sections = split_sections(cleaned)
    return cleaned, sections
