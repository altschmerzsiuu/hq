"""
Authentication endpoints for Estrus AI Dashboard
Handles user registration, login, Google OAuth, and JWT token management
"""

from fastapi import APIRouter, HTTPException, Depends, Header, Response, Request
from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime, timedelta, timezone
import httpx
from auth_utils import (
    create_access_token, 
    create_refresh_token,
    verify_token,
    hash_password,
    verify_password,
    REFRESH_TOKEN_EXPIRE_DAYS,
    ACCESS_TOKEN_EXPIRE_MINUTES
)

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

# Pydantic Models
class UserRegister(BaseModel):
    email: EmailStr
    password: str
    full_name: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class GoogleAuthRequest(BaseModel):
    token: str

class RefreshTokenRequest(BaseModel):
    refresh_token: Optional[str] = None

class LogoutRequest(BaseModel):
    refresh_token: Optional[str] = None

class LoginResponse(BaseModel):
    message: str
    user: dict
    access_token: Optional[str] = None

# Dependency to get DB pool
async def get_db_pool_dependency():
    from app import get_db_pool
    return await get_db_pool()

# Dependency: Get current user from token (check header OR cookie)
async def get_current_user(request: Request, authorization: Optional[str] = Header(None)):
    from app import get_db_pool
    
    # ── TELEGRAM BOT AUTH BYPASS ──────────────────────────────────────────────
    x_device_key = request.headers.get("x-device-key")
    x_tg_chat_id = request.headers.get("x-telegram-chat-id")
    
    if x_device_key and x_tg_chat_id:
        import os
        expected_key = os.getenv("DEVICE_API_KEY", "your-device-key-here")
        if x_device_key == expected_key:
            pool = await get_db_pool()
            async with pool.acquire() as conn:
                pref = await conn.fetchrow("SELECT user_id FROM user_preferences WHERE telegram_chat_id = $1", x_tg_chat_id)
                user = None
                if pref:
                    user_id = pref["user_id"]
                    user = await conn.fetchrow("SELECT id, email, full_name, role, parent_id, profile_picture_url, is_active FROM users WHERE id = $1 AND is_active = true", user_id)
                
                if not user:
                    # Fallback ke user pertama agar pengetesan lancar tanpa setup preferences dulu
                    user = await conn.fetchrow("SELECT id, email, full_name, role, parent_id, profile_picture_url, is_active FROM users WHERE is_active = true ORDER BY id ASC LIMIT 1")
                    if user:
                        print(f"⚠️ [AUTH BYPASS] Chat ID {x_tg_chat_id} not linked. Falling back to {user['email']}.")
                
                if user:
                    print(f"🤖 [AUTH BYPASS] Authenticated Telegram Bot for user {user['email']}")
                    return dict(user)
    # ──────────────────────────────────────────────────────────────────────────
    
    token = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization.replace("Bearer ", "")
        print(f"🔍 DEBUG: Token from Header: {token[:20]}...")
    elif "access_token" in request.cookies:
        token = request.cookies.get("access_token")
        print(f"🔍 DEBUG: Token from Cookie: {token[:20]}...")
    
    if not token:
        print("❌ DEBUG: No token found in Header or Cookie")
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    payload = verify_token(token, "access")
    if not payload:
        print("❌ DEBUG: Invalid or expired token")
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    
    user_id = int(payload.get("sub"))
    pool = await get_db_pool()
    async with pool.acquire() as conn:
        user = await conn.fetchrow("SELECT id, email, full_name, role, parent_id, profile_picture_url, is_active FROM users WHERE id = $1 AND is_active = true", user_id)
        if not user:
            print(f"❌ DEBUG: User ID {user_id} not found")
            raise HTTPException(status_code=401, detail="User not found")
        return dict(user)

def set_auth_cookies(response: Response, access_token: str, refresh_token: str):
    """Utility to set HttpOnly cookies"""
    # 15 minutes for access token (matches auth_utils)
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        samesite="lax",
        secure=False, # Set to True in production with HTTPS
        path="/",
    )
    # 7 days for refresh token
    response.set_cookie(
        key="refresh_token_cookie",
        value=refresh_token,
        httponly=True,
        max_age=REFRESH_TOKEN_EXPIRE_DAYS * 24 * 3600,
        samesite="lax",
        secure=False,
        path="/",
    )

@router.post("/register", response_model=LoginResponse)
async def register(user_data: UserRegister, response: Response, pool=Depends(get_db_pool_dependency)):
    """Register new user with email and password"""
    async with pool.acquire() as conn:
        existing = await conn.fetchrow("SELECT id FROM users WHERE email = $1", user_data.email)
        if existing:
            raise HTTPException(status_code=400, detail="Email already registered")
        
        password_hash = hash_password(user_data.password)
        user = await conn.fetchrow("""
            INSERT INTO users (email, full_name, password_hash, oauth_provider, role)
            VALUES ($1, $2, $3, 'email', 'viewer')
            RETURNING id, email, full_name, role, created_at
        """, user_data.email, user_data.full_name, password_hash)
        
        access_token = create_access_token({"sub": str(user['id']), "email": user['email'], "role": user['role'], "full_name": user['full_name']})
        refresh_token_str = create_refresh_token({"sub": str(user['id'])})
        
        expires_at = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
        await conn.execute("""
            INSERT INTO refresh_tokens (user_id, token, expires_at)
            VALUES ($1, $2, $3)
        """, user['id'], refresh_token_str, expires_at)
        
        set_auth_cookies(response, access_token, refresh_token_str)
        
        return {
            "message": "success",
            "access_token": access_token,
            "user": dict(user)
        }

@router.post("/login", response_model=LoginResponse)
async def login(credentials: UserLogin, response: Response, pool=Depends(get_db_pool_dependency)):
    """Login with email and password"""
    async with pool.acquire() as conn:
        user = await conn.fetchrow("SELECT * FROM users WHERE email = $1 AND is_active = true", credentials.email)
        if not user or not user['password_hash'] or not verify_password(credentials.password, user['password_hash']):
            raise HTTPException(status_code=401, detail="Invalid credentials")
        
        await conn.execute("UPDATE users SET last_login_at = NOW() WHERE id = $1", user['id'])
        
        access_token = create_access_token({"sub": str(user['id']), "email": user['email'], "role": user['role'], "full_name": user['full_name']})
        refresh_token_str = create_refresh_token({"sub": str(user['id'])})
        
        expires_at = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
        await conn.execute("""
            INSERT INTO refresh_tokens (user_id, token, expires_at)
            VALUES ($1, $2, $3)
        """, user['id'], refresh_token_str, expires_at)
        
        set_auth_cookies(response, access_token, refresh_token_str)
        
        return {
            "message": "success",
            "access_token": access_token,
            "user": {
                "id": user['id'],
                "email": user['email'],
                "full_name": user['full_name'],
                "role": user['role'],
                "profile_picture_url": user['profile_picture_url']
            }
        }

@router.post("/google", response_model=LoginResponse)
async def google_auth(request_data: GoogleAuthRequest, response: Response, pool=Depends(get_db_pool_dependency)):
    """Authenticate with Google OAuth ID token (from Google Identity Services)"""
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(f"https://oauth2.googleapis.com/tokeninfo?id_token={request_data.token}")
            if resp.status_code != 200:
                raise HTTPException(status_code=401, detail=f"Invalid Google token info response (status: {resp.status_code})")
            google_data = resp.json()
            
            import os
            expected_client_id = os.getenv("GOOGLE_CLIENT_ID")
            
            # Print debug logs in backend terminal to help diagnose Client ID mismatch
            if google_data.get("aud") != expected_client_id:
                print(f"🔑 [GOOGLE OAUTH] Token Aud mismatch detected")
                raise HTTPException(status_code=401, detail="Invalid token audience")
            
            email = google_data.get("email")
            name = google_data.get("name")
            picture = google_data.get("picture")
            google_id = google_data.get("sub")
            if not email:
                raise HTTPException(status_code=400, detail="Email not provided by Google")
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=401, detail=f"Google authentication failed: {str(e)}")
    
    async with pool.acquire() as conn:
        user = await conn.fetchrow("SELECT * FROM users WHERE email = $1", email)
        if not user:
            user = await conn.fetchrow("""
                INSERT INTO users (email, full_name, oauth_provider, oauth_id, profile_picture_url, role)
                VALUES ($1, $2, 'google', $3, $4, 'viewer')
                RETURNING id, email, full_name, role, profile_picture_url
            """, email, name, google_id, picture)
        else:
            await conn.execute("""
                UPDATE users SET last_login_at = NOW(), profile_picture_url = COALESCE(profile_picture_url, $2)
                WHERE id = $1
            """, user['id'], picture)
        
        access_token = create_access_token({"sub": str(user['id']), "email": user['email'], "role": user['role'], "full_name": user['full_name']})
        refresh_token_str = create_refresh_token({"sub": str(user['id'])})
        
        expires_at = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
        await conn.execute("""
            INSERT INTO refresh_tokens (user_id, token, expires_at)
            VALUES ($1, $2, $3)
        """, user['id'], refresh_token_str, expires_at)
        
        set_auth_cookies(response, access_token, refresh_token_str)
        
        return {
            "message": "success",
            "user": dict(user)
        }

@router.post("/refresh")
async def refresh_access_token(request_data: RefreshTokenRequest, request: Request, response: Response, pool=Depends(get_db_pool_dependency)):
    """Refresh access token using refresh token (from body or cookie)"""
    refresh_token = request_data.refresh_token or request.cookies.get("refresh_token_cookie")
    
    if not refresh_token:
        raise HTTPException(status_code=401, detail="No refresh token provided")
        
    payload = verify_token(refresh_token, "refresh")
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    
    user_id = int(payload.get("sub"))
    async with pool.acquire() as conn:
        token_record = await conn.fetchrow("""
            SELECT * FROM refresh_tokens 
            WHERE user_id = $1 AND token = $2 AND expires_at > NOW()
        """, user_id, refresh_token)
        
        if not token_record:
            raise HTTPException(status_code=401, detail="Refresh token not found or expired")
        
        user = await conn.fetchrow("SELECT * FROM users WHERE id = $1 AND is_active = true", user_id)
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        
        access_token = create_access_token({"sub": str(user['id']), "email": user['email'], "role": user['role'], "full_name": user['full_name']})
        
        # Set new access token cookie
        response.set_cookie(
            key="access_token",
            value=access_token,
            httponly=True,
            max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            samesite="lax",
            secure=False,
            path="/",
        )
        
        return {
            "message": "success",
            "access_token": access_token
        }

@router.post("/logout")
async def logout(request_data: LogoutRequest, request: Request, response: Response, pool=Depends(get_db_pool_dependency)):
    """Logout and invalidate refresh token + clear cookies"""
    refresh_token = request_data.refresh_token or request.cookies.get("refresh_token_cookie")
    
    if refresh_token:
        async with pool.acquire() as conn:
            await conn.execute("DELETE FROM refresh_tokens WHERE token = $1", refresh_token)
    
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token_cookie", path="/")
    
    return {"message": "Logged out successfully"}

@router.get("/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    """Get current user information"""
    return current_user
