
# Batch 7E-6 — Soft Merge Engine (Parser + AI + Memory)

from backend.utils.fix_validator import validate_fix

def clean_ai_segments(ai_json):
    """Validate AI segments and return only safe ones."""
    safe=[]
    for seg in ai_json or []:
        p1 = seg.get("from","").upper()
        p2 = seg.get("to","").upper()
        if validate_fix(p1) and validate_fix(p2):
            safe.append(seg)
    return safe

def merge_segments(parser_json, ai_json, memory):
    """Merge parser + AI + Memory, removing duplicates."""
    merged=[]
    seen=set()

    # add parser first
    for seg in parser_json:
        key=f"{seg.get('route')}:{seg.get('segment')}"
        if key not in seen:
            merged.append(seg)
            seen.add(key)

    # add AI segments if valid
    for seg in ai_json:
        key=f"{seg.get('route')}:{seg.get('segment')}"
        if key not in seen:
            merged.append(seg)
            seen.add(key)

    # future: memory reinforcement

    return merged

def soft_merge(parser, ai, memory):
    """
    Full hybrid merge:
    Parser → AI → Memory
    """

    parser_json = parser.get("json",[])
    ai_json_raw = ai.get("json",[])
    ai_json = clean_ai_segments(ai_json_raw)

    conf = parser.get("confidence",0)

    # Strong parser
    if conf >= 0.75:
        return {
            "text": parser.get("text",""),
            "json": parser_json,
            "source": "parser-strong",
            "merged": False
        }

    # Soft merge
    merged_json = merge_segments(parser_json, ai_json, memory)

    return {
        "text": ai.get("text",""),
        "json": merged_json,
        "source": f"soft-merge (ai:{ai.get('source','ai')})",
        "merged": True
    }
