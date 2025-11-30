# backend/ai/fallback_chain.py
import traceback
from backend.ai_providers.openai_client import generate_openai # Assuming direct wrapper or driver usage
from backend.ai_providers.gemini_client import generate_gemini # NEW
from backend.ai.copilot_client import copilot_complete
from backend.ai.offline_engine import offline_response
from backend.utils.memory_engine import memory_lookup, memory_learn
from backend.utils.soft_merge import soft_merge
from backend.utils.confidence_master import evaluate_confidence
from backend.parser.parser_logic import run_master_parser

async def intelligent_fallback(notam_text: str):
    """
    Priority: OpenAI -> Gemini -> Copilot -> Offline -> Parser -> Memory
    """
    responses = {}
    sources_used = []

    # 1. OpenAI (Primary)
    try:
        ai1 = generate_openai(notam_text) # Simplified call
        if ai1:
            responses["openai"] = ai1
            sources_used.append("openai")
    except Exception:
        pass

    # 2. Google Gemini (Redundancy Layer 1)
    if "openai" not in responses: # Only try if previous failed (or remove 'if' to run parallel)
        try:
            ai_gemini = await generate_gemini(notam_text)
            if ai_gemini:
                responses["gemini"] = ai_gemini
                sources_used.append("gemini")
        except Exception:
            pass

    # 3. Copilot (Redundancy Layer 2)
    if not responses:
        try:
            ai3 = await copilot_complete(notam_text)
            if ai3:
                responses["copilot"] = ai3
                sources_used.append("copilot")
        except Exception:
            pass

    # 4. Offline Template AI (Safety Net)
    try:
        offline = offline_response(notam_text)
        if offline: 
            responses["offline"] = offline
            sources_used.append("offline")
    except Exception:
        pass

    # 5. Deterministic Parser (Logic)
    try:
        parser_out = run_master_parser(notam_text)
        if parser_out:
            responses["parser"] = parser_out
            sources_used.append("parser")
    except Exception:
        pass

    # 6. Memory (History)
    try:
        mem = memory_lookup(notam_text)
        if mem:
            responses["memory"] = mem
            sources_used.append("memory")
    except Exception:
        pass

    if not responses:
        return {
            "output": "CRITICAL FAILURE: All AI and Offline systems failed.",
            "confidence": 0.0,
            "sources": []
        }

    # Merge Logic
    final = soft_merge(responses)
    score = evaluate_confidence(final, responses)

    # Auto-Learn
    if score >= 0.85:
        try:
            memory_learn(notam_text, final)
        except:
            pass

    return {
        "output": final,
        "confidence": score,
        "sources": sources_used
    }
