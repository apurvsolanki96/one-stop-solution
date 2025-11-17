
import re

def offline_explain(notam):
    return "Offline explanation: Basic NOTAM summary."

def offline_simplify(notam):
    return "Offline simplified version of NOTAM."

def offline_risk(notam):
    return "RISK: Medium\nReason: Offline fallback engine cannot compute detailed risk."

def offline_super(notam):
    # Minimal structure for emergency fallback
    return {
        "routes": [],
        "segments": [],
        "fl_min": "UNKNOWN",
        "fl_max": "UNKNOWN",
        "explanation": "Offline fallback."
    }
