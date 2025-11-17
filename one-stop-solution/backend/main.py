"""
main.py — One Stop Solution (Flightscape)
Unified FastAPI backend for:
- AI (OpenAI / Copilot / Offline)
- Parser engine (Batch 7–9)
- Memory learning
- Fallback chain (Batch 9)
- Merging + confidence
"""

import uvicorn
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

# Routers
from backend.ai.ai import router as ai_router
from backend.parser.parser import router as parser_router
from backend.memory import router as memory_router

# Master engine
from backend.ai.fallback_chain import intelligent_fallback

# Utilities
from backend.utils.normalize import normalize_notam_full


app = FastAPI(
    title="One Stop Solution – NOTAM AI Engine",
    version="1.0.0",
    description="Flightscape full AI + Parser unified NOTAM decoding engine"
)

# -----------------------------------------------------
#  CORS
# -----------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# -----------------------------------------------------
#  HEALTH CHECK
# -----------------------------------------------------
@app.get("/health")
async def health():
    return {"status": "OK", "system": "One Stop Solution"}


# -----------------------------------------------------
#  UNIVERSAL ENDPOINT — Batch 9 Final
#  /process-notam   → AI + Parser + Memory + Merge + Confidence
# -----------------------------------------------------
@app.post("/process-notam")
async def process_notam(payload: dict):
    """
    Unified NOTAM processor endpoint.
    Steps:
    1. Normalize NOTAM (whitespace, case, line breaks)
    2. Run fallback chain (AI + parser + memory)
    3. Return final merged version + confidence + sources
    """
    raw = payload.get("notam", "")
    if not raw:
        return {"error": "No NOTAM provided"}

    clean = normalize_notam_full(raw)
    result = await intelligent_fallback(clean)

    return {
        "input": raw,
        "normalized": clean,
        "output": result["output"],
        "confidence": result["confidence"],
        "sources": result["sources"]
    }


# -----------------------------------------------------
#  INCLUDE ROUTERS (Individual tools)
# -----------------------------------------------------
app.include_router(ai_router, prefix="/ai", tags=["AI"])
app.include_router(parser_router, prefix="/parser", tags=["Parser"])
app.include_router(memory_router, prefix="/memory", tags=["Memory"])


# -----------------------------------------------------
#  GLOBAL ERROR HANDLER
# -----------------------------------------------------
@app.exception_handler(Exception)
async def global_ex_handler(request: Request, exc: Exception):
    return {
        "error": "Internal server error",
        "detail": str(exc),
        "path": request.url.path
    }


# -----------------------------------------------------
#  LOCAL DEVELOPMENT ENTRYPOINT
# -----------------------------------------------------
if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
