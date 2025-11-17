from fastapi import APIRouter
from pydantic import BaseModel
from ai_providers.openai_client import generate_openai
from ai_providers.copilot_client import generate_copilot

router = APIRouter(prefix="/ai", tags=["AI"])

class NOTAMInput(BaseModel):
    notam: str


# ===============================================================
# OFFLINE MODEL (Simple Fallback)
# ===============================================================

def offline_model(prompt: str):
    summary = (
        "OFFLINE MODE ENGAGED — AI UNAVAILABLE\n"
        "This fallback is based on heuristic NOTAM pattern analysis.\n\n"
        "Input Provided:\n"
        f"{prompt}\n\n"
        "Possible Interpretation:\n"
        "- ATS route closure or operational restriction detected.\n"
        "- Review the FL band, segment identifiers, and effective times.\n"
        "- Cross-check original NOTAM for accuracy.\n"
    )
    return summary


# ===============================================================
# FALLBACK CHAIN: OpenAI → Copilot → Offline
# ===============================================================

def ai_fallback(prompt: str):

    # TRY OPENAI
    try:
        out = generate_openai(prompt)
        if out and len(out.strip()) > 0:
            return out, "OpenAI"
    except Exception:
        pass

    # TRY COPILOT
    try:
        out = generate_copilot(prompt)
        if out and len(out.strip()) > 0:
            return out, "Copilot"
    except Exception:
        pass

    # OFFLINE FALLBACK
    try:
        out = offline_model(prompt)
        return out, "Offline-Model"
    except:
        return "AI FAILURE: All providers unreachable.", "None"


# ===============================================================
# AI ENDPOINTS
# ===============================================================

@router.post("/")
def ai_auto(data: NOTAMInput):
    prompt = f"Process this NOTAM:\n\n{data.notam}"
    output, provider = ai_fallback(prompt)
    return {"output": output, "provider": provider}


@router.post("/explain")
def ai_explain(data: NOTAMInput):
    prompt = f"Explain this NOTAM in clear language:\n\n{data.notam}"
    output, provider = ai_fallback(prompt)
    return {"output": output, "provider": provider}


@router.post("/simplify")
def ai_simplify(data: NOTAMInput):
    prompt = f"Simplify this NOTAM without losing essential information:\n\n{data.notam}"
    output, provider = ai_fallback(prompt)
    return {"output": output, "provider": provider}


@router.post("/risk")
def ai_risk(data: NOTAMInput):
    prompt = (
        "Assess the operational risk of the following NOTAM and return "
        "risk level and reasons:\n\n"
        f"{data.notam}"
    )
    output, provider = ai_fallback(prompt)
    return {"output": output, "provider": provider}
