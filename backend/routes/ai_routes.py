
from fastapi import APIRouter
from backend.controllers.ai_controller import run_ai

router = APIRouter()

@router.post("/ai-explain")
async def ai_explain(data: dict):
    return run_ai("explain", data.get("notam",""))

@router.post("/ai-simplify")
async def ai_simplify(data: dict):
    return run_ai("simplify", data.get("notam",""))

@router.post("/ai-risk")
async def ai_risk(data: dict):
    return run_ai("risk", data.get("notam",""))

@router.post("/ai-super")
async def ai_super(data: dict):
    return run_ai("super", data.get("notam",""))
