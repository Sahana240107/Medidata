"""
MediData FastAPI backend entry point.
"""
import os
from dotenv import load_dotenv

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import auth

load_dotenv()
app = FastAPI(
    title="MediData API",
    description="Privacy-preserving global medical discovery network.",
    version="0.1.0",
)

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


@app.get("/health")
def health():
    return {"status": "ok", "service": "medidata-api"}