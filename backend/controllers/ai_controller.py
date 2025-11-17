
# Batch 7B - AI Controller (Medium Skeleton)

from backend.ai.prompt_router import build_prompt
from backend.ai.openai_driver import run_primary_ai
from backend.ai.copilot_driver import run_copilot
from backend.ai.offline_engine import offline_explain, offline_simplify, offline_risk, offline_super

"""
AI Controller manages:
1. Prompt construction
2. OpenAI primary call
3. Copilot fallback
4. Offline fallback
5. Hybrid output structuring
"""

def run_ai(task: str, notam: str):
    prompt = build_prompt(task, notam)

    # Primary AI
    primary = run_primary_ai(prompt)
    if primary:
        return {"text": primary, "json": [], "source": "openai"}

    # Copilot fallback
    cop = run_copilot(prompt)
    if cop:
        return {"text": cop, "json": [], "source": "copilot"}

    # Offline fallback
    if task == "explain":
        return {"text": offline_explain(notam), "json": [], "source": "offline"}

    if task == "simplify":
        return {"text": offline_simplify(notam), "json": [], "source": "offline"}

    if task == "risk":
        return {"text": offline_risk(notam), "json": [], "source": "offline"}

    if task == "super":
        return {"text": "Offline model cannot fully decode NOTAM", "json": offline_super(notam), "source": "offline"}

    return {"text": "Unknown task", "json": [], "source": "error"}
