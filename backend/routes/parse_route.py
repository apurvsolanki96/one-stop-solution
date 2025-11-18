# backend/routes/parse_route.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Any, Dict, Optional
from backend.controllers.parser_controller import process_notam

router = APIRouter()


class ParseRequest(BaseModel):
    notam: Optional[str] = ""


def _normalize_result(result: Any) -> Dict[str, Any]:
    """
    Ensure the returned structure contains:
      - text: str
      - json: list (structured data)
      - confidence: numeric
      - source: str (default 'parser')
    Accepts result that is:
      - dict-like with keys 'text','json','confidence'
      - or a string (interpreted as text)
      - or other; fallback to safe defaults
    """
    if result is None:
        return {"text": "", "json": [], "confidence": 0, "source": "parser"}

    # If controller returned a dict-like structure, use keys if present
    if isinstance(result, dict):
        return {
            "text": result.get("text", "") or "",
            "json": result.get("json", []) or [],
            "confidence": result.get("confidence", 0) or 0,
            "source": result.get("source", "parser") or "parser",
        }

    # If controller returned a string, treat as plain text
    if isinstance(result, str):
        return {"text": result, "json": [], "confidence": 0, "source": "parser"}

    # Unknown type: convert to string text and keep defaults for others
    try:
        return {"text": str(result), "json": [], "confidence": 0, "source": "parser"}
    except Exception:
        return {"text": "", "json": [], "confidence": 0, "source": "parser"}


@router.post("/parse")
async def parse_notam(data: ParseRequest):
    """
    Primary parser endpoint (legacy route).
    Expects JSON: { "notam": "..." }.
    """
    notam = (data.notam or "").strip()
    if not notam:
        # Mirror your existing behavior: return structured error-like object
        return {"text": "No NOTAM provided", "json": [], "confidence": 0, "source": "error"}

    try:
        result = process_notam(notam)
        return _normalize_result(result)
    except Exception as exc:
        # Surface server-side error; client will see 500 and error detail
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/process-notam")
async def process_notam_alias(data: ParseRequest):
    """
    Alias endpoint used by frontend code (keeps compatibility with UI).
    Calls the same parser implementation as /parse.
    """
    notam = (data.notam or "").strip()
    if not notam:
        return {"text": "No NOTAM provided", "json": [], "confidence": 0, "source": "error"}

    try:
        result = process_notam(notam)
        return _normalize_result(result)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
