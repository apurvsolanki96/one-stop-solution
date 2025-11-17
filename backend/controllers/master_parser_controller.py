
# Batch 8.6 — MASTER PARSER CONTROLLER
# Full NOTAM → Output pipeline

from backend.utils.normalize import normalize_notam
from backend.controllers.ai_merge_controller import final_parser_pipeline

def master_parser(notam_text, ai_payload):
    """
    notam_text: raw NOTAM string
    ai_payload: {text:"...", json:[...], source:"openai"} from ai_controller
    """

    cleaned, sections = normalize_notam(notam_text)

    eline = sections.get("E","")
    fline = sections.get("F","")
    gline = sections.get("G","")
    qline = sections.get("Q","")

    result = final_parser_pipeline(
        eline=eline,
        fline=fline,
        gline=gline,
        qline=qline,
        ai_payload=ai_payload
    )

    return {
        "cleaned": cleaned,
        "sections": sections,
        "final": result
    }
