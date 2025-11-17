
# Batch 8.4 — Confidence Integration Engine
# Connects route_extract + confidence scoring

from backend.utils.route_extract import process_eline
from backend.utils.confidence import evaluate

def master_confidence(eline, fline, gline, qline):
    segments, fl_info = process_eline(eline, fline, gline, qline)
    score = evaluate(segments, fl_info)
    return {
        "segments": segments,
        "fl_info": fl_info,
        "confidence": score
    }
