# backend/routes/memory_routes.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Any, Dict
from backend.utils import memory_engine

router = APIRouter()

class MemorySaveRequest(BaseModel):
    notam: str | None = None
    aviation: Dict[str, Any] | None = None

@router.get("/memory/get")
async def get_memory():
    return memory_engine.get_all()

@router.post("/memory/save")
async def save_memory(data: MemorySaveRequest):
    # convert Pydantic model to dict
    payload = data.dict()
    res = memory_engine.save_entry(payload)
    if "error" in res:
        raise HTTPException(status_code=400, detail=res["error"])
    return res

@router.post("/memory/clear")
async def clear_memory():
    return memory_engine.clear_memory()
