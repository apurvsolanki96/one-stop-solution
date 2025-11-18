
import re

def offline_explain(notam):
    return "Offline explanation: Basic NOTAM summary."

def offline_simplify(notam):
    return "Offline simplified version of NOTAM."

def offline_risk(notam):
    return "RISK: Medium\nReason: Offline fallback engine cannot compute detailed risk."

def offline_super(notam):
    # Minimal structure for emergency fallback
    return {
        "routes": [],
        "segments": [],
        "fl_min": "UNKNOWN",
        "fl_max": "UNKNOWN",
        "explanation": "Offline fallback."
    }
def offline_response(
    prompt: str | None = None,
    *,
    messages=None,
    **kwargs,
) -> str:
    """
    Compatibility wrapper used by fallback_chain.

    It provides a simple offline fallback answer when cloud providers
    are unavailable. The signature is flexible on purpose so that
    calls like `offline_response(prompt=...)` or `offline_response(messages=...)`
    both work without errors.
    """
    # If messages were passed, prefer them as the source text
    if messages:
        try:
            text = " ".join(str(m.get("content", "")) for m in messages)
        except Exception:
            text = str(messages)
    else:
        text = prompt or ""

    text = text.strip()

    if not text:
        return (
            "Offline fallback: I cannot reach any AI provider right now, "
            "but no specific NOTAM text was provided."
        )

    return (
        "Offline fallback: AI providers are not available on this deployment. "
        "Here is a generic note based on your input: "
        + text[:300]
    )
