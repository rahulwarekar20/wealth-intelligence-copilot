"""
Deprecated: kept only for backwards compatibility. Use app.agents.llm_client.
This module never called Bedrock; it calls Groq. Safe to delete once
nothing imports it.
"""
from app.agents.llm_client import invoke_llm, LLMError, parse_json_response  # noqa: F401


def invoke_claude(system_prompt: str, user_prompt: str, max_tokens: int = 1024, use_haiku: bool = False) -> str:
    return invoke_llm(system_prompt, user_prompt, max_tokens=max_tokens, use_small_model=use_haiku)
