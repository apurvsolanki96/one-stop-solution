"""
Stub implementation of a Copilot completion client.

Your code in `backend.ai.fallback_chain` imports `copilot_complete`
from here. For now, we provide a simple placeholder implementation so
the backend can start even if Copilot is not actually configured.
"""


def copilot_complete(
    prompt: str | None = None,
    *,
    messages=None,
    model: str | None = None,
    temperature: float = 0.2,
    max_tokens: int | None = None,
    **kwargs,
) -> str:
    """
    Compatibility wrapper. Mirrors the signature of `openai_complete`
    but just returns a placeholder string for now.

    If you later want real GitHub Copilot integration, you can replace
    this function with actual API calls.
    """

    # Very simple behaviour so that, if it ever gets called, your code
    # still gets a string back instead of crashing.
    if messages:
        src = " / ".join(str(m.get("content", "")) for m in messages)
    else:
        src = prompt or ""

    return (
        "Copilot provider is not enabled on this deployment. "
        "Original prompt: " + src[:200]
    )
