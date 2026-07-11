"""
Router-level tests for /chat. The auth dependency is overridden (no real
Supabase token needed) and chat_service.handle_chat_turn is monkeypatched
so these only exercise routing/serialization, not the agent or DB.
"""

from uuid import uuid4

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.deps.auth import get_current_user
from app.routers import chat as chat_router
from app.schemas.chat import ChatResponse


FAKE_USER = {"id": "user-1", "role": "doctor", "hospital_id": "hosp-1"}


@pytest.fixture
def client(monkeypatch):
    app = FastAPI()
    app.include_router(chat_router.router)
    app.dependency_overrides[get_current_user] = lambda: FAKE_USER
    return TestClient(app)


def test_post_chat_returns_agent_response(client, monkeypatch):
    fake_session_id = uuid4()

    def fake_handle_chat_turn(user, message, session_id):
        assert user == FAKE_USER
        assert message == "most common symptoms of AOSD?"
        return ChatResponse(
            session_id=fake_session_id,
            reply="Fever is most common.",
            case_count=12,
            low_confidence=False,
            confidence_score=90.0,
            evidence=[],
            retrieved_case_ids=[],
        )

    monkeypatch.setattr(chat_router, "handle_chat_turn", fake_handle_chat_turn)

    resp = client.post("/chat", json={"message": "most common symptoms of AOSD?"})

    assert resp.status_code == 200
    body = resp.json()
    assert body["reply"] == "Fever is most common."
    assert body["case_count"] == 12
    assert body["session_id"] == str(fake_session_id)


def test_post_chat_rejects_empty_message(client):
    resp = client.post("/chat", json={"message": ""})
    assert resp.status_code == 422


def test_post_chat_surfaces_config_error_as_503(client, monkeypatch):
    def fake_handle_chat_turn(user, message, session_id):
        raise RuntimeError("GROQ_API_KEY must be set in the environment.")

    monkeypatch.setattr(chat_router, "handle_chat_turn", fake_handle_chat_turn)

    resp = client.post("/chat", json={"message": "hello"})

    assert resp.status_code == 503
    assert "GROQ_API_KEY" in resp.json()["detail"]


def test_list_sessions_scopes_to_current_user(client, monkeypatch):
    captured = {}

    class FakeQuery:
        def select(self, *a, **kw):
            return self

        def eq(self, col, val):
            captured["user_id"] = val
            return self

        def order(self, *a, **kw):
            return self

        def execute(self):
            class R:
                data = [{"id": str(uuid4()), "title": "t", "created_at": "2026-01-01T00:00:00Z", "updated_at": "2026-01-01T00:00:00Z"}]
            return R()

    class FakeSupabase:
        def table(self, name):
            return FakeQuery()

    monkeypatch.setattr(chat_router, "get_supabase_admin", lambda: FakeSupabase())

    resp = client.get("/chat/sessions")

    assert resp.status_code == 200
    assert len(resp.json()) == 1
    assert captured["user_id"] == FAKE_USER["id"]
