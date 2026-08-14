import os
import uuid
import json
import magic
import google.generativeai as genai
from supabase import create_client, Client
from fastapi import HTTPException, UploadFile
from typing import Optional

def get_supabase_client() -> Optional[Client]:
    url: str | None = os.getenv("SUPABASE_URL")
    key: str | None = os.getenv("SUPABASE_KEY")
    if not url or not key:
        print("⚠️ SUPABASE_URL or SUPABASE_KEY not set. Image upload will fail.")
        return None
    return create_client(url, key)

async def upload_image_to_storage(file: UploadFile, folder: str = "general") -> str:
    """
    Uploads an image to Supabase Storage (bucket: herd-images) and returns the public URL.
    Includes security checks (magic bytes) and AI content moderation (Gemini).
    """
    supabase = get_supabase_client()
    if not supabase:
        raise HTTPException(status_code=500, detail="Storage not configured on server.")

    bucket_name = "herd-images"
    
    # Read file content
    content = await file.read()
    
    # --- Security Check 1: Magic Bytes (Malware Prevention) ---
    mime = magic.Magic(mime=True)
    actual_mime_type = mime.from_buffer(content)
    
    if not actual_mime_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File yang diunggah bukan format gambar yang valid.")
        
    allowed_mimes = ["image/jpeg", "image/png", "image/webp"]
    if actual_mime_type not in allowed_mimes:
        raise HTTPException(status_code=400, detail="Hanya format JPG, PNG, dan WebP yang diperbolehkan.")

    # --- Security Check 2: Content Moderation (Gemini Vision) ---
    gemini_api_key = os.getenv("GEMINI_API_KEY")
    if gemini_api_key:
        try:
            genai.configure(api_key=gemini_api_key)
            model = genai.GenerativeModel("gemini-1.5-flash-latest")
            
            prompt = """
            Analyze this image carefully. Determine if it contains any of the following:
            1. NSFW, pornography, gore, or explicit content.
            This image is supposed to be either a Cow's profile picture or a Human User's profile picture.
            If it contains a cow, an animal, a human face, or a landscape, allow it.
            If it contains explicit/harmful content, reject it.
            Respond strictly in JSON format with two keys:
            {
              "allowed": true/false,
              "reason": "Brief reason in Indonesian why it's rejected or allowed."
            }
            """
            
            response = model.generate_content([
                prompt,
                {"mime_type": actual_mime_type, "data": content}
            ])
            
            text = response.text.strip()
            if text.startswith("```json"):
                text = text[7:-3].strip()
            elif text.startswith("```"):
                text = text[3:-3].strip()
                
            result = json.loads(text)
            if not result.get("allowed", True):
                reason = result.get("reason", "Gambar mengandung konten yang tidak pantas.")
                raise HTTPException(status_code=400, detail=reason)
                
        except HTTPException:
            raise
        except Exception as e:
            print(f"⚠️ Gemini moderation skipped due to error: {e}")
            # If Gemini fails, we allow the image to upload so we don't block the user
    
    # Generate unique filename
    ext = actual_mime_type.split('/')[-1]
    if ext == 'jpeg': ext = 'jpg'
    unique_filename = f"{uuid.uuid4()}.{ext}"
    file_path = f"{folder}/{unique_filename}"
    
    try:
        # Upload to Supabase Storage
        res = supabase.storage.from_(bucket_name).upload(
            path=file_path,
            file=content,
            file_options={"content-type": actual_mime_type}
        )
        
        # Get public URL
        public_url = supabase.storage.from_(bucket_name).get_public_url(file_path)
        return public_url
    except Exception as e:
        print(f"❌ Error uploading to Supabase: {e}")
        raise HTTPException(status_code=500, detail="Failed to upload image to cloud storage.")

