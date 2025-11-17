
import requests

def run_copilot(prompt):
    try:
        url = "https://api.githubcopilot.com/v1/chat/completions"
        headers = {
            "Content-Type": "application/json",
            "Authorization": "Bearer <COPILOT_API_KEY>"
        }

        payload = {
            "model": "gpt-4o-copilot",
            "messages": [{"role":"user","content":prompt}]
        }

        r = requests.post(url, json=payload, headers=headers, timeout=10)
        if r.status_code == 200:
            return r.json()["choices"][0]["message"]["content"]
        return None

    except:
        return None
