
from fastapi import APIRouter
from backend.utils import memory_engine

router = APIRouter()

@router.get("/memory/get")
async def get_memory():
    return memory_engine.get_all()

@router.post("/memory/save")
async def save_memory(data: dict):
    return memory_engine.save_entry(data)

@router.post("/memory/clear")
async def clear_memory():
    return memory_engine.clear_memory()
