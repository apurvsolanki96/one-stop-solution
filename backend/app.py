
# Batch 7D - FastAPI Application

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
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

# Routers
app.include_router(parse_router)
app.include_router(ai_router)
app.include_router(memory_router)

@app.get("/health")
async def health_check():
    return {"status":"ok","service":"one-stop-solution-backend"}

