
import openai
import time

TIMEOUT = 10

def call_openai(model, prompt):
    openai.api_key = None  # Loaded from env in real system

    for attempt in range(3):
        try:
            resp = openai.ChatCompletion.create(
                model=model,
                messages=[{"role":"user","content":prompt}],
                timeout=TIMEOUT
            )
            return resp["choices"][0]["message"]["content"]

        except Exception as e:
            if attempt == 2:
                raise e
            time.sleep(1)

def run_primary_ai(prompt):
    try:
        return call_openai("gpt-4.1-turbo", prompt)
    except:
        # downgrade
        try:
            return call_openai("gpt-4.1-mini", prompt)
        except:
            return None
