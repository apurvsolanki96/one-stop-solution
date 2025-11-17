import os
import requests
from dotenv import load_dotenv

load_dotenv()

COPILOT_API_KEY = os.getenv("COPILOT_API_KEY")
COPILOT_ENDPOINT = "https://api.githubcopilot.com/v1/chat/completions"

HEADERS = {
    "Authorization": f"Bearer {COPILOT_API_KEY}",
    "Content-Type": "application/json"
}

MODEL = "gpt-4o-mini"  # GitHub Models fallback


def generate_copilot(prompt: str) -> str:
    """
    GitHub Copilot fallback model.
    Returns empty string on failure.
    """
    try:
        payload = {
            "model": MODEL,
            "messages": [
                {"role": "system", "content": "You are an aviation NOTAM assistant."},
                {"role": "user", "content": prompt}
            ],
            "temperature": 0
        }

        r = requests.post(COPILOT_ENDPOINT, json=payload, headers=HEADERS, timeout=20)

        if r.status_code != 200:
            print("[Copilot ERROR]", r.text)
            return ""

        data = r.json()
        return data["choices"][0]["message"]["content"].strip()

    except Exception as e:
        print(f"[Copilot EXCEPTION] {e}")
        return ""
