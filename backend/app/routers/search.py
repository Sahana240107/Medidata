"""
Search router.

POST /search  -> run a free-text case search across the global network.

This is a structured data view, not a chat endpoint: the query is parsed
for intent/entities (best-effort, via Groq), then everything returned is
computed directly from Qdrant + Supabase — no generated prose, nothing to
hallucinate.
"""

from fastapi import APIRouter, Depends

from app.deps.auth import get_current_user
from app.schemas.search import SearchRequest, SearchResponse
from app.services import search_service

router = APIRouter(prefix="/search", tags=["search"])


@router.post("", response_model=SearchResponse)
async def search_cases(body: SearchRequest, user: dict = Depends(get_current_user)):
    return await search_service.run_search(body, current_user=user)