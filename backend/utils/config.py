# backend/utils/config.py
import os
from dotenv import load_dotenv

load_dotenv()  # loads .env for local development

# Correct names that match Render.com
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
COPILOT_API_KEY = os.getenv("COPILOT_API_KEY")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")  # default model

if not OPENAI_API_KEY:
    print("⚠️ WARNING: OPENAI_API_KEY is missing!")

if not COPILOT_API_KEY:
    print("⚠️ WARNING: COPILOT_API_KEY is missing!")
