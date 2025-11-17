from fastapi import APIRouter
from pydantic import BaseModel
from backend.utils.parser_logic import parse_notam_advanced

router = APIRouter(prefix="/parse", tags=["Parser"])

class NOTAMInput(BaseModel):
    notam: str

@router.post("/")
def parse_route(data: NOTAMInput):
    """Advanced ICAO NOTAM parser endpoint"""
    try:
        output = parse_notam_advanced(data.notam)
        return {"output": output}
    except Exception as e:
        return {"error": f"Parser error: {str(e)}"}
