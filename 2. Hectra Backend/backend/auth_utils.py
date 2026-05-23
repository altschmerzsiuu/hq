"""
JWT Authentication utilities for Estrus AI Dashboard
"""

from datetime import datetime, timedelta
from typing import Optional
from jose import jwt, JWTError
import os
import bcrypt
from dotenv import load_dotenv

# Ensure .env is loaded (important for standalone utility usage)
load_dotenv()

# Configuration from environment variables
SECRET_KEY = os.getenv("JWT_SECRET_KEY")
if not SECRET_KEY:
    raise RuntimeError("FATAL: JWT_SECRET_KEY is not set in environmental variables! Check your .env file.")

ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 15))
REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", 7))

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Create JWT access token"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire, "type": "access"})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def create_refresh_token(data: dict):
    """Create JWT refresh token (longer expiry)"""
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def verify_token(token: str, token_type: str = "access"):
    """Verify and decode JWT token"""
    try:
        print(f"🔍 DEBUG verify_token: Decoding token with SECRET_KEY={SECRET_KEY[:20]}... and ALGORITHM={ALGORITHM}")
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        print(f"🔍 DEBUG verify_token: Decoded payload={payload}")
        if payload.get("type") != token_type:
            print(f"❌ DEBUG verify_token: Type mismatch! Expected '{token_type}', got '{payload.get('type')}'")
            return None
        return payload
    except JWTError as e:
        print(f"❌ DEBUG verify_token: JWTError occurred: {type(e).__name__}: {str(e)}")
        return None

def hash_password(password: str) -> str:
    """Hash password using bcrypt"""
    # Convert password to bytes and hash
    password_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password_bytes, salt)
    return hashed.decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password against bcrypt hash"""
    # Convert both to bytes
    password_bytes = plain_password.encode('utf-8')
    hashed_bytes = hashed_password.encode('utf-8')
    return bcrypt.checkpw(password_bytes, hashed_bytes)
