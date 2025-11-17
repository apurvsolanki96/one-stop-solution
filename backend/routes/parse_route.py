
from fastapi import APIRouter
from backend.controllers.parser_controller import process_notam

router = APIRouter()

@router.post("/parse")
async def parse_notam(data: dict):
    notam = data.get("notam","").strip()
    if not notam:
        return {"text":"No NOTAM provided","json":[],"confidence":0,"source":"error"}

    result = process_notam(notam)

    return {
        "text": result.get("text",""),
        "json": result.get("json",[]),
        "confidence": result.get("confidence",0),
        "source": result.get("source","parser")
    }
