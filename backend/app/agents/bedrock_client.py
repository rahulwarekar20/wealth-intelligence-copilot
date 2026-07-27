import httpx
import json
from app.core.config import settings

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = "llama-3.1-8b-instant"
GROQ_MODEL_LARGE = "llama-3.3-70b-versatile"


def invoke_claude(
    system_prompt: str,
    user_prompt: str,
    max_tokens: int = 1024,
    use_haiku: bool = False
) -> str:
    """
    Calls Groq API for fast free inference.
    use_haiku=True uses smaller/faster model
    use_haiku=False uses larger model for composer
    Same interface as Bedrock version -- swap back easily.
    """
    model = GROQ_MODEL if use_haiku else GROQ_MODEL_LARGE

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
        "temperature": 0.1
    }

    try:
        response = httpx.post(
            GROQ_URL,
            headers=headers,
            json=payload,
            timeout=30.0
        )
        result = response.json()
        return result["choices"][0]["message"]["content"]
    except Exception as e:
        return f'{{"error": "{str(e)}"}}'