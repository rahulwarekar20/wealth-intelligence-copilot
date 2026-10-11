import json
import logging
import re
import time
import httpx
from app.core.config import settings

logger = logging.getLogger("wealth-copilot.llm")

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = "openai/gpt-oss-20b"
GROQ_MODEL_LARGE = "openai/gpt-oss-120b"


class LLMError(Exception):
    """Raised when the LLM provider fails or returns an unusable response."""


class EmptyLLMResponse(LLMError):
    """The model returned no content (usually its reasoning used up the token budget)."""


# Short rate-limit waits are absorbed by retrying; longer ones fail fast with a clear message
MAX_RATE_LIMIT_WAIT_SECONDS = 4.0
_RETRY_IN = re.compile(r"try again in ([0-9.]+)(ms|s)")


def _rate_limit_wait(response: httpx.Response) -> float:
    header = response.headers.get("retry-after")
    if header:
        try:
            return float(header)
        except ValueError:
            pass
    m = _RETRY_IN.search(response.text)
    if m:
        value = float(m.group(1))
        return value / 1000 if m.group(2) == "ms" else value
    return MAX_RATE_LIMIT_WAIT_SECONDS + 1


def invoke_llm(
    system_prompt: str,
    user_prompt: str,
    max_tokens: int = 1024,
    use_small_model: bool = False,
    reasoning_effort: str = "low",
) -> str:
    """
    Calls the Groq chat completions API and returns the response text.
    use_small_model=True uses the smaller/faster model.
    reasoning_effort ("low" | "medium" | "high") controls the models' hidden
    reasoning; "low" is much faster and uses far fewer tokens.
    Raises LLMError on HTTP errors, rate limits or malformed responses
    so callers never mistake a failure for a real answer.
    """
    model = GROQ_MODEL if use_small_model else GROQ_MODEL_LARGE

    headers = {
        "Authorization": f"Bearer {settings.GROQ_API_KEY}",
        "Content-Type": "application/json"
    }

    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        "max_tokens": max_tokens,
        "temperature": 0.1,
        "reasoning_effort": reasoning_effort,
    }

    for attempt in range(3):
        try:
            response = httpx.post(GROQ_URL, headers=headers, json=payload, timeout=30.0)
        except httpx.HTTPError as e:
            raise LLMError(f"LLM request failed: {e}") from e

        if response.status_code == 429 and attempt < 2:
            wait = _rate_limit_wait(response)
            if wait <= MAX_RATE_LIMIT_WAIT_SECONDS:
                logger.info("LLM rate limited; retrying in %.1fs", wait)
                time.sleep(wait + 0.2)
                continue
        break

    if response.status_code != 200:
        logger.warning("LLM returned HTTP %s: %s", response.status_code, response.text[:300])
        if response.status_code == 429:
            raise LLMError("The AI service is busy (rate limit reached). Please try again in a minute.")
        raise LLMError(f"The AI service returned an error (HTTP {response.status_code}).")

    try:
        content = response.json()["choices"][0]["message"]["content"]
    except (ValueError, KeyError, IndexError, TypeError) as e:
        raise LLMError("The AI service returned a malformed response.") from e

    if not content or not content.strip():
        raise EmptyLLMResponse("The AI service returned an empty response.")
    return content


def invoke_llm_json(
    system_prompt: str,
    user_prompt: str,
    max_tokens: int = 1024,
    use_small_model: bool = False,
    retries: int = 1,
    reasoning_effort: str = "low",
) -> dict:
    """
    Calls the LLM and parses its JSON answer. The models are reasoning models whose
    hidden reasoning shares the token budget, so an empty or unparseable (often
    truncated) answer is retried once with double the budget. Raises LLMError / ValueError.
    """
    last_error: Exception = ValueError("No response")
    for attempt in range(retries + 1):
        try:
            response = invoke_llm(system_prompt, user_prompt, max_tokens=max_tokens * (2 ** attempt),
                                  use_small_model=use_small_model, reasoning_effort=reasoning_effort)
            return parse_json_response(response)
        except (EmptyLLMResponse, ValueError) as e:
            last_error = e
            logger.warning("Unusable LLM answer (attempt %d): %s", attempt + 1, e)
    raise last_error


def parse_json_response(response: str) -> dict:
    """
    Extracts the JSON object from an LLM response, tolerating markdown
    code fences and surrounding prose. Raises ValueError if none is found.
    """
    clean = response.strip().replace("```json", "").replace("```", "").strip()
    start = clean.find("{")
    end = clean.rfind("}") + 1
    if start < 0 or end <= start:
        raise ValueError("No JSON object found in LLM response")
    result = json.loads(clean[start:end])
    if not isinstance(result, dict):
        raise ValueError("LLM response JSON is not an object")
    return result
