"""
MediData FastAPI backend entry point.
"""
import os
from dotenv import load_dotenv

load_dotenv()
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import auth, cases, search, hospitals, viz, discovery, cli_sync
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
        "https://your-production-domain.com",  # replace with actual domain
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Routers ─────────────────────────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(cases.router)
app.include_router(search.router)
app.include_router(hospitals.router)
app.include_router(viz.router)
app.include_router(discovery.router)
app.include_router(cli_sync.router)


@app.get("/health")
def health():
    return {"status": "ok", "service": "medidata-api"}