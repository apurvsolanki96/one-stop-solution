# backend/utils/config.py
import os
from dotenv import load_dotenv

load_dotenv()  # loads .env for local development

# API Keys
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
COPILOT_API_KEY = os.getenv("COPILOT_API_KEY")
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY") # Added Google Key

# Model Configs
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4")

if not OPENAI_API_KEY:
    print("⚠️ WARNING: OPENAI_API_KEY is missing!")
if not COPILOT_API_KEY:
    print("⚠️ WARNING: COPILOT_API_KEY is missing!")
if not GOOGLE_API_KEY:
    print("⚠️ WARNING: GOOGLE_API_KEY is missing! Gemini redundancy will be skipped.")
