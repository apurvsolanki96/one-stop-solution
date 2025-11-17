import os
from typing import List, Dict, Any

from openai import OpenAI

# Use OPENAI_API_KEY from environment (set this in Render)
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))


def openai_complete(
    prompt: str | None = None,
    *,
    messages: List[Dict[str, Any]] | None = None,
    model: str | None = None,
    temperature: float = 0.2,
    max_tokens: int | None = None,
    **kwargs: Any,
) -> str:
    """
    Backwards-compatible wrapper used by backend.ai.fallback_chain.

    It supports either:
      - openai_complete("some text...")
      - openai_complete(messages=[...])

    and returns the assistant's message content as a string.
    """

    if model is None:
        model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

    # If only a prompt string is passed, convert it to messages
    if messages is None:
        if prompt is None:
            raise ValueError("Either `prompt` or `messages` must be provided.")
        # If someone mistakenly passed a messages list as `prompt`, handle that too
        if isinstance(prompt, list):
            messages = prompt  # type: ignore[assignment]
        else:
            messages = [{"role": "user", "content": str(prompt)}]

    # Only forward safe kwargs to the OpenAI client
    extra: Dict[str, Any] = {}
    for key in (
        "top_p",
        "frequency_penalty",
        "presence_penalty",
        "response_format",
        "stop",
        "stream",
        "n",
        "seed",
    ):
        if key in kwargs:
            extra[key] = kwargs[key]

    resp = client.chat.completions.create(
        model=model,
        messages=messages,
        temperature=temperature,
        max_tokens=max_tokens,
        **extra,
    )

    return resp.choices[0].message.content or ""
