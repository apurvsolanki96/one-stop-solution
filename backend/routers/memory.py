from fastapi import APIRouter
from pydantic import BaseModel
from backend.utils.memory_engine import save_memory_entry

router = APIRouter(prefix="/memory", tags=["Memory"])

class MemoryInput(BaseModel):
    notam: str
    result: str

@router.post("/save")
def save_memory(data: MemoryInput):
    """Save a NOTAM + parsed/AI result into persistent local memory."""
    try:
        save_memory_entry(data.notam, data.result)
        return {"status": "saved", "message": "Memory stored successfully"}
    except Exception as e:
        return {"error": f"Memory save error: {str(e)}"}
