"""
Research chat agent: a bounded Groq tool-calling loop over the analytics
tool registry.

The model decides which tool(s) to call per question (no keyword routing),
per the system prompt's rules. This module just:
  1. runs the loop (capped at MAX_TOOL_ITERATIONS round-trips),
  2. executes whatever tools the model asks for via tool_registry.run_tool,
  3. collects every tool result into an "evidence" list so the caller can
     show a case-count / matched-cases panel alongside the prose answer,
  4. returns the final text reply once the model stops requesting tools.
"""

import json
import os
from dataclasses import dataclass, field
from typing import Optional

from groq import Groq, BadRequestError

from app.agents.prompts import RESEARCH_CHAT_SYSTEM_PROMPT
from app.core.constants import MAX_TOOL_ITERATIONS
from app.tools.tool_registry import TOOL_SPECS, run_tool

DEFAULT_MODEL = os.environ.get("GROQ_MODEL", "openai/gpt-oss-120b")
MAX_TOKENS = 1500


def _to_groq_tools(tool_specs: list) -> list:
    """
    Convert the Anthropic-style tool specs (name/description/input_schema)
    kept in tool_registry.py into the OpenAI-compatible function-calling
    format Groq's chat.completions API expects.
    """
    return [
        {
            "type": "function",
            "function": {
                "name": spec["name"],
                "description": spec["description"],
                "parameters": spec["input_schema"],
            },
        }
        for spec in tool_specs
    ]


GROQ_TOOLS = _to_groq_tools(TOOL_SPECS)


@dataclass
class ToolEvidence:
    tool_name: str
    tool_input: dict
    result: dict


@dataclass
class ChatAgentResult:
    reply: str
    evidence: list = field(default_factory=list)
    iterations_used: int = 0
    hit_iteration_cap: bool = False

    @property
    def total_case_count(self) -> Optional[int]:
        """Best-effort rollup of case counts across all tool calls this turn."""
        counts = [
            e.result.get("case_count")
            for e in self.evidence
            if isinstance(e.result, dict) and isinstance(e.result.get("case_count"), int)
        ]
        return max(counts) if counts else None

    @property
    def any_low_confidence(self) -> bool:
        return any(
            isinstance(e.result, dict) and e.result.get("low_confidence")
            for e in self.evidence
        )

    @property
    def matched_case_ids(self) -> list:
        """Case IDs surfaced by evidence_search calls, for the retrieved_case_ids column."""
        ids = []
        for e in self.evidence:
            if e.tool_name != "evidence_search" or not isinstance(e.result, dict):
                continue
            for case in e.result.get("matched_cases", []):
                if case.get("case_id"):
                    ids.append(case["case_id"])
        return ids


_client = None


def _get_client() -> Groq:
    global _client
    if _client is None:
        api_key = os.environ.get("GROQ_API_KEY")
        if not api_key:
            raise RuntimeError("GROQ_API_KEY must be set in the environment.")
        _client = Groq(api_key=api_key)
    return _client


def _create_completion(client: Groq, **kwargs) -> "object":
    """
    Wraps client.chat.completions.create with one retry for Groq's
    'tool call validation failed' 400s -- a known model-side failure mode
    where the model emits a malformed tool call, or tries to call a tool
    even when none were offered in the request. Rather than 500ing the
    request, we nudge the model to retry correctly in a clean turn.
    """
    try:
        return client.chat.completions.create(**kwargs)
    except BadRequestError as exc:
        body = getattr(exc, "body", None) or {}
        error_info = body.get("error", {}) if isinstance(body, dict) else {}
        if error_info.get("code") != "tool_use_failed":
            raise

        messages = list(kwargs["messages"])
        if kwargs.get("tools"):
            # Normal tool-call turn: the model's tool call was malformed
            # (bad arguments shape, name/args mixed together, etc).
            correction = (
                "Your previous tool call was malformed (arguments must be a "
                "single JSON object matching the tool's parameters, not an "
                "array, and must go in the 'arguments' field, not the tool "
                "name). Call the tool again with correctly formatted "
                "arguments."
            )
        else:
            # Iteration-cap fallback turn: tools were intentionally omitted
            # so the model would be forced to answer in plain text, but it
            # tried to call one anyway. Tell it plainly to stop.
            correction = (
                "You attempted to call a tool, but no tools are available "
                "this turn. Do not attempt any tool or function call. "
                "Answer now in plain text using only the tool results "
                "already gathered earlier in this conversation, and note "
                "if you couldn't fully answer."
            )
        messages.append({"role": "system", "content": correction})
        kwargs = {**kwargs, "messages": messages}
        return client.chat.completions.create(**kwargs)


def _system_message(content: str) -> dict:
    return {"role": "system", "content": content}


def run_chat_turn(history: list, user_message: str) -> ChatAgentResult:
    """
    history: prior turns as OpenAI-style message dicts, e.g.
        [{"role": "user", "content": "..."}, {"role": "assistant", "content": "..."}]
    user_message: the new user turn (plain text).

    Returns the final reply plus every tool result collected along the way.
    """
    client = _get_client()
    messages = (
        [_system_message(RESEARCH_CHAT_SYSTEM_PROMPT)]
        + list(history)
        + [{"role": "user", "content": user_message}]
    )
    evidence = []

    for iteration in range(1, MAX_TOOL_ITERATIONS + 1):
        response = _create_completion(
            client,
            model=DEFAULT_MODEL,
            max_tokens=MAX_TOKENS,
            messages=messages,
            tools=GROQ_TOOLS,
        )

        choice = response.choices[0]
        message = choice.message
        tool_calls = getattr(message, "tool_calls", None)

        if choice.finish_reason != "tool_calls" or not tool_calls:
            final_text = (message.content or "").strip()
            return ChatAgentResult(
                reply=final_text or "I don't have enough information from the dataset to answer that.",
                evidence=evidence,
                iterations_used=iteration,
            )

        # The model wants to call one or more tools -- run them all, append
        # results, and loop back so it can either call more tools or answer.
        messages.append({
            "role": "assistant",
            "content": message.content,
            "tool_calls": [
                {
                    "id": call.id,
                    "type": "function",
                    "function": {
                        "name": call.function.name,
                        "arguments": call.function.arguments,
                    },
                }
                for call in tool_calls
            ],
        })

        for call in tool_calls:
            try:
                tool_input = json.loads(call.function.arguments or "{}")
            except json.JSONDecodeError:
                tool_input = {}
            result = run_tool(call.function.name, tool_input)
            evidence.append(ToolEvidence(tool_name=call.function.name, tool_input=tool_input, result=result))
            messages.append({
                "role": "tool",
                "tool_call_id": call.id,
                "content": _to_tool_result_text(result),
            })

    # Hit the iteration cap without converging -- ask the model for a final
    # answer with tools omitted so it must respond in text now.
    capped_messages = list(messages)
    capped_messages[0] = _system_message(
        RESEARCH_CHAT_SYSTEM_PROMPT
        + "\n\nYou have reached the tool-call limit for this turn. Answer now using only the tool results already gathered, and note if you couldn't fully answer."
    )
    response = _create_completion(
        client,
        model=DEFAULT_MODEL,
        max_tokens=MAX_TOKENS,
        messages=capped_messages,
        tool_choice="none",
    )
    final_text = (response.choices[0].message.content or "").strip()
    return ChatAgentResult(
        reply=final_text or "I wasn't able to fully answer within the tool-call limit for this turn -- try narrowing the question.",
        evidence=evidence,
        iterations_used=MAX_TOOL_ITERATIONS,
        hit_iteration_cap=True,
    )


def _to_tool_result_text(result: dict) -> str:
    return json.dumps(result, default=str)
