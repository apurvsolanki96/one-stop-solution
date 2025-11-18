# backend/routes/ai_routes.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Any, Dict, Optional
from backend.controllers.ai_controller import run_ai

router = APIRouter()


class AIRequest(BaseModel):
    notam: Optional[str] = ""


class AIResponse(BaseModel):
    status: str
    result: Optional[Any] = None
    error: Optional[str] = None


async def _call(action: str, payload: Dict[str, Any]) -> AIResponse:
    """
    Helper to call the controller and return a normalized AIResponse.
    """
    try:
        notam_text = (payload.get("notam") or "").strip()
        # run_ai returns raw result (string or structured JSON) depending on implementation
        result = run_ai(action, notam_text)
        return AIResponse(status="ok", result=result)
    except Exception as exc:
        # Catch and surface controller errors as 500 with message
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/ai-explain", response_model=AIResponse)
async def ai_explain(data: AIRequest):
    """
    Explain the NOTAM in plain language.
    """
    return await _call("explain", data.dict())


@router.post("/ai-simplify", response_model=AIResponse)
async def ai_simplify(data: AIRequest):
    """
    Simplify the NOTAM (short summary).
    """
    return await _call("simplify", data.dict())


@router.post("/ai-risk", response_model=AIResponse)
async def ai_risk(data: AIRequest):
    """
    Do a quick risk assessment for the NOTAM content.
    """
    return await _call("risk", data.dict())


@router.post("/ai-super", response_model=AIResponse)
async def ai_super(data: AIRequest):
    """
    A combined/advanced AI operation (super).
    """
    return await _call("super", data.dict())
