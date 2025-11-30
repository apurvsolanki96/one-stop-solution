# backend/ai_providers/gemini_client.py
import google.generativeai as genai
from backend.utils.config import GOOGLE_API_KEY

# Configure the library
if GOOGLE_API_KEY:
    genai.configure(api_key=GOOGLE_API_KEY)

async def generate_gemini(prompt: str) -> str:
    """
    Sends a prompt to Google Gemini Pro and returns the text response.
    """
    if not GOOGLE_API_KEY:
        return ""

    try:
        model = genai.GenerativeModel('gemini-pro')
        response = await model.generate_content_async(prompt)
        
        if response.text:
            return response.text.strip()
    except Exception as e:
        print(f"[Gemini ERROR] {e}")
    
    return ""
