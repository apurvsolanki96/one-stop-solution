
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.routes.parse_route import router as parse_router
from backend.routes.ai_routes import router as ai_router
from backend.routes.memory_routes import router as memory_router

app = FastAPI()

origins = [
    "http://localhost",
    "http://localhost:*",
    "http://127.0.0.1:*",
    "https://*.github.io"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # NOTE: placeholder; dynamic wildcard matching requires regex support
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

app.include_router(parse_router)
app.include_router(ai_router)
app.include_router(memory_router)
