
# Batch 8.5 — AI Soft-Merge Integration Controller
# Connects:
# - confidence_master (parser confidence)
# - soft_merge (parser + AI merge)
# - memory_engine (reinforcement)
# - OpenAI call handled in ai_controller.py

from backend.utils.confidence_master import master_confidence
from backend.utils.soft_merge import soft_merge
from backend.utils.memory_engine import save_entry, get_all

def final_parser_pipeline(eline, fline, gline, qline, ai_payload):
    """
    Runs full parser → confidence → AI merge pipeline.
    ai_payload = { "text": "...", "json": [...], "source": "openai" }
    """

    # Step 1: parser + confidence
    parsed = master_confidence(eline, fline, gline, qline)

    # Step 2: retrieve memory snapshot
    memory_snapshot = get_all()

    # Step 3: merge AI + parser
    merged = soft_merge(
        parser = {
            "text": "",   # parser text not implemented yet until Batch 8.6
            "json": parsed["segments"],
            "confidence": parsed["confidence"]
        },
        ai = ai_payload,
        memory = memory_snapshot
    )

    return {
        "segments": merged["json"],
        "fl": parsed["fl_info"],
        "confidence": parsed["confidence"],
        "source": merged["source"],
        "merged": merged["merged"],
        "text": merged["text"]
    }
