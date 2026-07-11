"""
Tests for the research chat agent loop, with the Groq client mocked
out entirely -- these test the loop's control flow (tool_calls -> run tool ->
feed result back -> repeat until finish_reason != 'tool_calls', and the
iteration cap), not the model's actual behavior.
"""

from types import SimpleNamespace

import pytest

from app.agents import research_chat_agent as agent


def _tool_call(name, arguments, id_="tool_1"):
    return SimpleNamespace(
        id=id_,
        function=SimpleNamespace(name=name, arguments=arguments if isinstance(arguments, str) else __import__("json").dumps(arguments)),
    )


def _message(content=None, tool_calls=None):
    return SimpleNamespace(content=content, tool_calls=tool_calls)


def _response(finish_reason, message):
    choice = SimpleNamespace(finish_reason=finish_reason, message=message)
    return SimpleNamespace(choices=[choice])


class FakeCompletions:
    """Returns each response in `queue` in order, one per .create() call."""

    def __init__(self, queue):
        self.queue = list(queue)
        self.calls = []

    def create(self, **kwargs):
        self.calls.append(kwargs)
        return self.queue.pop(0)


class FakeChat:
    def __init__(self, queue):
        self.completions = FakeCompletions(queue)


class FakeClient:
    def __init__(self, queue):
        self.chat = FakeChat(queue)


@pytest.fixture(autouse=True)
def fake_run_tool(monkeypatch):
    """Stub out the actual tool execution so these tests don't touch data_access."""
    monkeypatch.setattr(
        agent, "run_tool", lambda name, input_: {"case_count": 12, "low_confidence": False, "fake": True}
    )


def _install_fake_client(monkeypatch, queue):
    fake = FakeClient(queue)
    monkeypatch.setattr(agent, "_client", fake)
    monkeypatch.setattr(agent, "_get_client", lambda: fake)
    return fake


def test_answers_directly_when_no_tool_needed(monkeypatch):
    queue = [_response("stop", _message(content="Hello, how can I help?"))]
    _install_fake_client(monkeypatch, queue)

    result = agent.run_chat_turn(history=[], user_message="hi")

    assert result.reply == "Hello, how can I help?"
    assert result.evidence == []
    assert result.iterations_used == 1


def test_calls_tool_then_answers(monkeypatch):
    queue = [
        _response(
            "tool_calls",
            _message(tool_calls=[_tool_call("symptom_frequency", {"disease": "AOSD"})]),
        ),
        _response("stop", _message(content="Based on 12 cases, fever is most common.")),
    ]
    fake = _install_fake_client(monkeypatch, queue)

    result = agent.run_chat_turn(history=[], user_message="most common symptoms of AOSD?")

    assert result.reply == "Based on 12 cases, fever is most common."
    assert len(result.evidence) == 1
    assert result.evidence[0].tool_name == "symptom_frequency"
    assert result.total_case_count == 12
    assert result.any_low_confidence is False
    # second call should have included the tool result as a "tool" message
    second_call_messages = fake.chat.completions.calls[1]["messages"]
    assert second_call_messages[-1]["role"] == "tool"
    assert second_call_messages[-1]["tool_call_id"] == "tool_1"


def test_stops_at_iteration_cap_and_forces_text_answer(monkeypatch):
    # Model keeps requesting tools forever -> loop should hit MAX_TOOL_ITERATIONS
    # then make one final call without tools to force a text answer.
    from app.core.constants import MAX_TOOL_ITERATIONS

    tool_use_response = _response(
        "tool_calls",
        _message(tool_calls=[_tool_call("symptom_frequency", {"disease": "AOSD"})]),
    )
    queue = [tool_use_response for _ in range(MAX_TOOL_ITERATIONS)] + [
        _response("stop", _message(content="Here's what I found so far."))
    ]
    fake = _install_fake_client(monkeypatch, queue)

    result = agent.run_chat_turn(history=[], user_message="loop forever")

    assert result.hit_iteration_cap is True
    assert result.reply == "Here's what I found so far."
    assert len(result.evidence) == MAX_TOOL_ITERATIONS
    # final forced call should not include the `tools` kwarg
    final_call_kwargs = fake.chat.completions.calls[-1]
    assert "tools" not in final_call_kwargs


def test_matched_case_ids_collected_from_evidence_search(monkeypatch):
    def fake_run_tool(name, input_):
        if name == "evidence_search":
            return {
                "case_count": 2,
                "matched_cases": [{"case_id": "abc"}, {"case_id": "def"}],
            }
        return {"case_count": 1}

    monkeypatch.setattr(agent, "run_tool", fake_run_tool)

    queue = [
        _response(
            "tool_calls",
            _message(tool_calls=[_tool_call("evidence_search", {"query_text": "fever, rash"})]),
        ),
        _response("stop", _message(content="Possible diagnoses...")),
    ]
    _install_fake_client(monkeypatch, queue)

    result = agent.run_chat_turn(history=[], user_message="why is this AOSD?")

    assert result.matched_case_ids == ["abc", "def"]
