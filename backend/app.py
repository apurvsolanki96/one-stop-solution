# backend/app.py
# Batch 7D - FastAPI Application

import os
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, RedirectResponse

from backend.routes.parse_route import router as parse_router
from backend.routes.ai_routes import router as ai_router
from backend.routes.memory_routes import router as memory_router

app = FastAPI(title="One Stop Solution Backend")

# Dynamic CORS
origins = [
    "http://localhost",
    "http://localhost:*",
    "http://127.0.0.1:*",
    "https://*.github.io"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Placeholder: wildcard; regex matching implemented later
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

# Routers (API)
app.include_router(parse_router)
app.include_router(ai_router)
app.include_router(memory_router)


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "one-stop-solution-backend"}


# --- Static docs mounting (robust) -----------------------------------------
# Resolve repo root relative to this file: backend/ -> repo_root
REPO_ROOT = Path(__file__).resolve().parents[1]   # parent of backend/
DOCS_DIR = REPO_ROOT / "docs"

# Only mount if the docs directory exists inside the container
if DOCS_DIR.exists() and DOCS_DIR.is_dir():
    # Mount at root so index.html is served at "/"
    app.mount("/", StaticFiles(directory=str(DOCS_DIR), html=True), name="docs_static")
else:
    # Log a clear message (uvicorn will show this in Render logs)
    import logging
    logging.getLogger("uvicorn").warning(f"Docs directory not found at {DOCS_DIR}. Static UI will not be mounted.")

    # Optionally provide a fallback root route (simple message)
    @app.get("/", include_in_schema=False)
    async def root_fallback():
        return {"detail": "UI not available on this deployment. /health is available."}
