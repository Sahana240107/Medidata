"""
MediData FastAPI backend entry point.
"""
import os
from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import (
    auth,
    cases,
    search,
    chat,
    feed,
    experts,
    collaborations,
    cli_sync,
    research_datasets,
    hospitals
)

from app.hypothesis.falsification_engine.router import router as falsification_router
from app.hypothesis.verdict_engine.router import router as verdict_router

from app.db.qdrant_client import ensure_collection

app = FastAPI(
    title="MediData API",
    description="Privacy-preserving global medical discovery network.",
    version="0.1.0",
)


@app.on_event("startup")
def on_startup():
    # Make sure the Qdrant collection exists before any case gets created.
    ensure_collection()


# ─── CORS ────────────────────────────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",  # Vite development server
        "https://your-production-domain.com",  # Replace with actual domain
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Routers ─────────────────────────────────────────────────────────────────

app.include_router(auth.router)
app.include_router(cases.router)
app.include_router(search.router)
app.include_router(chat.router)
app.include_router(feed.router)
app.include_router(hospitals.router)
app.include_router(experts.router)
app.include_router(collaborations.router)
app.include_router(research_datasets.router)
app.include_router(cli_sync.router)
app.include_router(falsification_router)
app.include_router(verdict_router)


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "medidata-api",
    }