# Batch 7E-4 — Confidence Engine

def score_fl(fl_info: dict) -> float:
    """Score flight-level info."""
    score = 1.0
    if fl_info.get("adjusted"):
        score -= 0.15
    return max(score, 0.0)


def score_segments(segments: list[dict]) -> float:
    """Score how good the parsed segments are."""
    if not segments:
        return 0.0

    good = 0
    for s in segments:
        if len(s.get("from", "")) >= 3 and len(s.get("to", "")) >= 3:
            good += 1

    return good / len(segments)


def score_memory_usage(segments: list[dict]) -> float:
    """Placeholder: later can factor in memory usage quality."""
    return 0.1


def evaluate(segments: list[dict], fl_info: dict) -> float:
    """Combine all subscores into a single confidence score."""
    w_fl = 0.4
    w_seg = 0.5
    w_mem = 0.1

    fls = score_fl(fl_info)
    segs = score_segments(segments)
    mems = score_memory_usage(segments)

    return round(fls * w_fl + segs * w_seg + mems * w_mem, 3)


def score_output(result: str) -> float:
    """
    Simple compatibility wrapper used by parser_logic.

    Returns a confidence score between 0 and 1 based on the output text.
    """
    text = (result or "").strip()
    score = 0.0

    # Non-empty output
    if text:
        score += 0.4

    # Contains the JSON marker we expect from the model
    if "JSON:" in text:
        score += 0.4

    # Longer outputs are (very roughly) treated as more detailed
    if len(text) > 200:
        score += 0.2

    # Clamp to [0, 1]
    return max(0.0, min(score, 1.0))
