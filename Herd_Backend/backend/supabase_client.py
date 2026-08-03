import os
import uuid
from supabase import create_client, Client
from fastapi import HTTPException, UploadFile
from typing import Optional

def get_supabase_client() -> Optional[Client]:
    url: str = os.getenv("SUPABASE_URL")
    key: str = os.getenv("SUPABASE_KEY")
    if not url or not key:
        print("⚠️ SUPABASE_URL or SUPABASE_KEY not set. Image upload will fail.")
        return None
    return create_client(url, key)

async def upload_image_to_storage(file: UploadFile, folder: str = "general") -> str:
    """
    Uploads an image to Supabase Storage (bucket: herd-images) and returns the public URL.
    """
    supabase = get_supabase_client()
    if not supabase:
        raise HTTPException(status_code=500, detail="Storage not configured on server.")

    bucket_name = "herd-images"
    
    # Read file content
    content = await file.read()
    
    # Generate unique filename
    ext = file.filename.split('.')[-1] if '.' in file.filename else 'jpg'
    unique_filename = f"{uuid.uuid4()}.{ext}"
    file_path = f"{folder}/{unique_filename}"
    
    try:
        # Upload to Supabase Storage
        # Note: supabase-py requires sync upload or wrapping in thread. We'll pass the bytes directly.
        res = supabase.storage.from_(bucket_name).upload(
            path=file_path,
            file=content,
            file_options={"content-type": file.content_type or "image/jpeg"}
        )
        
        # Get public URL
        public_url = supabase.storage.from_(bucket_name).get_public_url(file_path)
        return public_url
    except Exception as e:
        print(f"❌ Error uploading to Supabase: {e}")
        raise HTTPException(status_code=500, detail="Failed to upload image to cloud storage.")
