"""
fallback_chain.py
Central intelligence chain that tries multiple AI engines + parser + memory
and merges results using confidence + soft_merge logic.
"""

import traceback

from backend.ai.openai_client import openai_complete
from backend.ai.copilot_client import copilot_complete
from backend.ai.offline_engine import offline_response
from backend.utils.memory_engine import memory_lookup, memory_learn
from backend.utils.soft_merge import soft_merge
from backend.utils.confidence_master import evaluate_confidence
from backend.parser.parser_logic import run_master_parser


# -----------------------------
# PRIORITY ORDER (Batch 9 Final)
# -----------------------------
# 1. OpenAI (primary)
# 2. OpenAI-mini (lite fallback)
# 3. Copilot
# 4. Offline template-based AI
# 5. Parser (deterministic)
# 6. Memory (learned corrections)
#
# Final output merges best sources using:
#   - scoring
#   - confidence weighting
#   - heuristics
# -----------------------------


async def intelligent_fallback(notam_text: str):
    """
    Executes the full fallback chain:
    AI Primary → Fallback AI → Offline → Parser → Memory → Merged result
    Returns:
        {
            "output": "...",
            "confidence": 0-1,
            "sources": ["openai", "parser", ...]
        }
    """
    sources_used = {}
    responses = {}

    # -----------------------------
    # 1. Try OpenAI (Primary)
    # -----------------------------
    try:
        ai1 = await openai_complete(notam_text)
        if ai1:
            responses["openai"] = ai1
            sources_used["openai"] = True
    except Exception:
        sources_used["openai"] = False

    # -----------------------------
    # 2. Try OpenAI-mini
    # -----------------------------
    try:
        ai2 = await openai_complete(notam_text, miniature=True)
        if ai2:
            responses["openai_mini"] = ai2
            sources_used["openai_mini"] = True
    except Exception:
        sources_used["openai_mini"] = False

    # -----------------------------
    # 3. Try Copilot
    # -----------------------------
    try:
        ai3 = await copilot_complete(notam_text)
        if ai3:
            responses["copilot"] = ai3
            sources_used["copilot"] = True
    except Exception:
        sources_used["copilot"] = False

    # -----------------------------
    # 4. Offline Template AI
    # -----------------------------
    try:
        offline = offline_response(notam_text)
        responses["offline"] = offline
        sources_used["offline"] = True
    except Exception:
        sources_used["offline"] = False

    # -----------------------------
    # 5. Deterministic Parser Engine
    # -----------------------------
    try:
        parser_out = run_master_parser(notam_text)
        if parser_out:
            responses["parser"] = parser_out
            sources_used["parser"] = True
    except Exception:
        traceback.print_exc()
        sources_used["parser"] = False

    # -----------------------------
    # 6. Memory Lookup (learned NOTAM patterns)
    # -----------------------------
    try:
        mem = memory_lookup(notam_text)
        if mem:
            responses["memory"] = mem
            sources_used["memory"] = True
    except Exception:
        sources_used["memory"] = False

    # -----------------------------
    # If nothing produced ANYTHING
    # -----------------------------
    if not responses:
        return {
            "output": "Unable to decode NOTAM. No system produced a result.",
            "confidence": 0.0,
            "sources": []
        }

    # -----------------------------
    # FINAL MERGE LOGIC
    # -----------------------------
    final = soft_merge(responses)

    # -----------------------------
    # CONFIDENCE SCORING
    # -----------------------------
    score = evaluate_confidence(final, responses)

    # -----------------------------
    # AUTO-LEARN IF HIGH CONFIDENCE
    # -----------------------------
    try:
        if score >= 0.85:
            memory_learn(notam_text, final)
    except Exception:
        pass

    return {
        "output": final,
        "confidence": score,
        "sources": list(responses.keys())
    }
