import json
import google.generativeai as genai
from .config import GEMINI_API_KEY, GEMINI_MODEL

genai.configure(api_key=GEMINI_API_KEY)

async def extract_filters_from_query(query: str) -> dict:
    """
    Use Gemini structured output to extract filter parameters from natural language.
    """
    model = genai.GenerativeModel(
        model_name=GEMINI_MODEL,
        system_instruction=(
            "You are an AI assistant that extracts filter criteria for a cattle management system from natural language.\n"
            "Output strictly valid JSON with the following keys:\n"
            "- searchQuery (string): name or ID of the cow, or empty string if none.\n"
            "- kesehatan (string): 'all', 'pantau' (needs monitoring/sensor alert), 'action' (sick/needs IB/treatment), 'Sakit', 'Sehat', or 'Perlu IB'. Default is 'all'.\n"
            "- jenis (string): 'all', 'Simmental', 'Limosin', 'Brahman', 'PO', or other breed name. Default is 'all'.\n"
            "- usia (string): extract the age mentioned (e.g. '7 bulan', '2 tahun') or empty string if none.\n"
            "Example 1: 'cari sapi simmental yang sakit' -> {\"searchQuery\": \"\", \"kesehatan\": \"Sakit\", \"jenis\": \"Simmental\", \"usia\": \"\"}\n"
            "Example 2: 'sapi usil' -> {\"searchQuery\": \"usil\", \"kesehatan\": \"all\", \"jenis\": \"all\", \"usia\": \"\"}\n"
            "Example 3: 'tampilkan sapi brahma yang usianya 7 bulan' -> {\"searchQuery\": \"\", \"kesehatan\": \"all\", \"jenis\": \"Brahman\", \"usia\": \"7 bulan\"}\n"
            "Example 4: 'yang usianya 7 bulan' -> {\"searchQuery\": \"\", \"kesehatan\": \"all\", \"jenis\": \"all\", \"usia\": \"7 bulan\"}\n"
            "Do not wrap the JSON in markdown blocks like ```json."
        )
    )
    
    try:
        response = await model.generate_content_async(
            query,
            generation_config=genai.types.GenerationConfig(
                temperature=0.0,
                response_mime_type="application/json"
            )
        )
        
        text = response.text.strip()
        # Ensure it's valid JSON even if model includes markdown
        if text.startswith("```json"):
            text = text[7:-3].strip()
        elif text.startswith("```"):
            text = text[3:-3].strip()
            
        data = json.loads(text)
        return {
            "searchQuery": data.get("searchQuery", ""),
            "kesehatan": data.get("kesehatan", "all"),
            "jenis": data.get("jenis", "all"),
            "usia": data.get("usia", "")
        }
    except Exception as exc:
        print(f"Smart Search Extraction Error: {exc}")
        # Fallback to simple keyword search
        return {
            "searchQuery": query,
            "kesehatan": "all",
            "jenis": "all"
        }
