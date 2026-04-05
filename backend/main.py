"""
Explainable GNN Imbalance Studio — FastAPI Backend
===================================================
Entry point. Mounts all route modules, configures CORS, reads env.
"""

import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

MOCK_MODE = os.getenv("MOCK_MODE", "true").lower() == "true"


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown lifecycle."""
    # Always initialize DB tables — routes persist results to SQL in both modes
    from db.database import init_db
    await init_db()
    if MOCK_MODE:
        print("[backend] Running in MOCK MODE — SQLite DB initialized, Redis optional")
    else:
        print("[backend] Running in REAL MODE — DB + Redis initialized")
    yield
    print("[backend] Shutting down")


app = FastAPI(
    title="GNN Imbalance Studio API",
    version="1.0.0",
    description="Backend for the Explainable GNN-Based Node Classification Imbalance Benchmark",
    lifespan=lifespan,
)

# ── CORS ────────────────────────────────────────────────────────────────────
origins = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in origins],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Mount Routes ────────────────────────────────────────────────────────────
from routes.datasets import router as datasets_router
from routes.train import router as train_router
from routes.explain import router as explain_router
from routes.balance import router as balance_router

app.include_router(datasets_router, tags=["Datasets"])
app.include_router(train_router, tags=["Training"])
app.include_router(explain_router, tags=["Explainability"])
app.include_router(balance_router, tags=["Balancing"])


@app.get("/api/health")
async def health_check():
    return {
        "status": "success",
        "message": "API is running",
        "data": {
            "mock_mode": MOCK_MODE,
            "version": "1.0.0",
        },
    }


if __name__ == "__main__":
    import uvicorn

    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run("main:app", host=host, port=port, reload=True)
