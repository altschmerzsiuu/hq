"""
Profile & Settings endpoints for Estrus AI Dashboard
Handles user profile, farm settings, preferences, and Telegram configuration
"""

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime

router = APIRouter(prefix="/api/profile", tags=["Profile"])

# Pydantic Models
class ProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None

class PasswordChange(BaseModel):
    current_password: str
    new_password: str

class FarmSettings(BaseModel):
    farm_name: Optional[str] = None
    farm_location: Optional[str] = None
    farm_contact: Optional[str] = None
    total_cattle_capacity: Optional[int] = None
    province_id: Optional[str] = None
    city_id: Optional[str] = None
    postal_code: Optional[str] = None
    street_address: Optional[str] = None
    regency_id: Optional[int] = None
    district_id: Optional[int] = None
    village_id: Optional[int] = None
    farm_type: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None

class UserPreferences(BaseModel):
    telegram_bot_token: Optional[str] = None
    telegram_chat_id: Optional[str] = None
    email_notifications: Optional[bool] = None
    telegram_notifications: Optional[bool] = None
    theme: Optional[str] = None
    language: Optional[str] = None
    alert_threshold_estrus: Optional[int] = None

class TelegramTest(BaseModel):
    bot_token: str
    chat_id: str

# Dependency to get DB pool
async def get_db_pool_dependency():
    from app import get_db_pool
    return await get_db_pool()

# Import get_current_user from auth_routes
from auth_routes import get_current_user

@router.get("")
async def get_profile(pool=Depends(get_db_pool_dependency), current_user=Depends(get_current_user)):
    """Get complete user profile with all settings"""
    user_id = current_user['id']
    
    async with pool.acquire() as conn:
        # Get user info
        user = await conn.fetchrow("SELECT id, email, full_name, role, profile_picture_url, created_at, last_login_at FROM users WHERE id = $1", user_id)
        
        # Get farm settings
        farm = await conn.fetchrow("SELECT * FROM farm_settings WHERE user_id = $1", user_id)
        
        # Get preferences
        prefs = await conn.fetchrow("SELECT * FROM user_preferences WHERE user_id = $1", user_id)
        
        # PERBAIKAN DISINI: Tambahkan WHERE owner_id = $1
        cattle_count = await conn.fetchval("SELECT COUNT(*) FROM hewan WHERE owner_id = $1", user_id) or 0
        
        return {
            "user": dict(user) if user else None,
            "farm": dict(farm) if farm else {},
            "preferences": dict(prefs) if prefs else {},
            "cattle_count": cattle_count
        }

@router.put("")
async def update_profile(
    data: ProfileUpdate,
    pool=Depends(get_db_pool_dependency),
    current_user=Depends(get_current_user)
):
    """Update user profile (name, email)"""
    user_id = current_user['id']
    
    async with pool.acquire() as conn:
        # Check if email is already taken
        if data.email and data.email != current_user['email']:
            existing = await conn.fetchrow("SELECT id FROM users WHERE email = $1 AND id != $2", data.email, user_id)
            if existing:
                raise HTTPException(status_code=400, detail="Email already in use")
        
        # Update user
        query = "UPDATE users SET "
        params = []
        param_idx = 1
        
        if data.full_name:
            query += f"full_name = ${param_idx}, "
            params.append(data.full_name)
            param_idx += 1
        
        if data.email:
            query += f"email = ${param_idx}, "
            params.append(data.email)
            param_idx += 1
        
        query = query.rstrip(", ") + f" WHERE id = ${param_idx} RETURNING id, email, full_name, role, profile_picture_url"
        params.append(user_id)
        
        updated_user = await conn.fetchrow(query, *params)
        
        return {"message": "Profile updated successfully", "user": dict(updated_user)}

@router.post("/change-password")
async def change_password(
    data: PasswordChange,
    pool=Depends(get_db_pool_dependency),
    current_user=Depends(get_current_user)
):
    """Change user password"""
    from auth_utils import verify_password, hash_password
    
    user_id = current_user['id']
    
    async with pool.acquire() as conn:
        user = await conn.fetchrow("SELECT password_hash FROM users WHERE id = $1", user_id)
        
        if not user or not user['password_hash']:
            raise HTTPException(status_code=400, detail="Cannot change password for OAuth users")
        
        # Verify current password
        if not verify_password(data.current_password, user['password_hash']):
            raise HTTPException(status_code=401, detail="Current password is incorrect")
        
        # Hash new password
        new_hash = hash_password(data.new_password)
        
        # Update password
        await conn.execute("UPDATE users SET password_hash = $1 WHERE id = $2", new_hash, user_id)
        
        return {"message": "Password changed successfully"}

@router.get("/farm")
async def get_farm_settings(pool=Depends(get_db_pool_dependency), current_user=Depends(get_current_user)):
    """Get farm settings"""
    user_id = current_user['id']
    
    async with pool.acquire() as conn:
        farm = await conn.fetchrow("SELECT * FROM farm_settings WHERE user_id = $1", user_id)
        
        # PERBAIKAN DISINI JUGA: Tambahkan WHERE owner_id = $1
        cattle_count = await conn.fetchval("SELECT COUNT(*) FROM hewan WHERE owner_id = $1", user_id) or 0
        
        return {
            "farm": dict(farm) if farm else {},
            "cattle_count": cattle_count
        }

@router.put("/farm")
async def update_farm_settings(
    data: FarmSettings,
    pool=Depends(get_db_pool_dependency),
    current_user=Depends(get_current_user)
):
    """Update farm settings with regional data"""
    user_id = current_user['id']
    
    async with pool.acquire() as conn:
        # Check if record exists first to handle partial updates cleanly
        existing = await conn.fetchrow("SELECT * FROM farm_settings WHERE user_id = $1", user_id)
        
        if existing:
            # Update existing
            await conn.execute("""
                UPDATE farm_settings SET
                    farm_name = COALESCE($2, farm_name),
                    farm_location = COALESCE($3, farm_location),
                    farm_contact = COALESCE($4, farm_contact),
                    total_cattle_capacity = COALESCE($5, total_cattle_capacity),
                    province_id = COALESCE($6, province_id),
                    regency_id = COALESCE($7, regency_id),
                    district_id = COALESCE($8, district_id),
                    village_id = COALESCE($9, village_id),
                    farm_type = COALESCE($10, farm_type),
                    latitude = COALESCE($11, latitude),
                    longitude = COALESCE($12, longitude),
                    city_id = COALESCE($13, city_id),
                    postal_code = COALESCE($14, postal_code),
                    street_address = COALESCE($15, street_address),
                    updated_at = CURRENT_TIMESTAMP
                WHERE user_id = $1
            """, 
            user_id, data.farm_name, data.farm_location, data.farm_contact, 
            data.total_cattle_capacity, data.province_id, data.regency_id, 
            data.district_id, data.village_id, data.farm_type, data.latitude, data.longitude,
            data.city_id, data.postal_code, data.street_address)
            
            farm = await conn.fetchrow("SELECT * FROM farm_settings WHERE user_id = $1", user_id)
        else:
            # Insert new
            farm = await conn.fetchrow("""
                INSERT INTO farm_settings (
                    user_id, farm_name, farm_location, farm_contact, 
                    total_cattle_capacity, province_id, regency_id, 
                    district_id, village_id, farm_type, latitude, longitude,
                    city_id, postal_code, street_address
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
                RETURNING *
            """, 
            user_id, data.farm_name, data.farm_location, data.farm_contact, 
            data.total_cattle_capacity, data.province_id, data.regency_id, 
            data.district_id, data.village_id, data.farm_type, data.latitude, data.longitude,
            data.city_id, data.postal_code, data.street_address)
        
        return {"message": "Farm settings updated successfully", "farm": dict(farm)}

@router.get("/preferences")
async def get_preferences(pool=Depends(get_db_pool_dependency), current_user=Depends(get_current_user)):
    """Get user preferences"""
    user_id = current_user['id']
    
    async with pool.acquire() as conn:
        prefs = await conn.fetchrow("SELECT * FROM user_preferences WHERE user_id = $1", user_id)
        return dict(prefs) if prefs else {}

@router.put("/preferences")
async def update_preferences(
    data: UserPreferences,
    pool=Depends(get_db_pool_dependency),
    current_user=Depends(get_current_user)
):
    """Update user preferences (Telegram, notifications, appearance)"""
    user_id = current_user['id']
    
    async with pool.acquire() as conn:
        # Check existing to handle partial update better
        existing = await conn.fetchrow("SELECT * FROM user_preferences WHERE user_id = $1", user_id)
        
        if existing:
            await conn.execute("""
                UPDATE user_preferences SET
                    telegram_bot_token = COALESCE($2, telegram_bot_token),
                    telegram_chat_id = COALESCE($3, telegram_chat_id),
                    email_notifications = COALESCE($4, email_notifications),
                    telegram_notifications = COALESCE($5, telegram_notifications),
                    theme = COALESCE($6, theme),
                    language = COALESCE($7, language),
                    alert_threshold_estrus = COALESCE($8, alert_threshold_estrus),
                    updated_at = CURRENT_TIMESTAMP
                WHERE user_id = $1
            """, user_id, data.telegram_bot_token, data.telegram_chat_id, 
             data.email_notifications, data.telegram_notifications,
             data.theme, data.language, data.alert_threshold_estrus)
             
            prefs = await conn.fetchrow("SELECT * FROM user_preferences WHERE user_id = $1", user_id)
        else:
            prefs = await conn.fetchrow("""
                INSERT INTO user_preferences (
                    user_id, telegram_bot_token, telegram_chat_id, 
                    email_notifications, telegram_notifications, 
                    theme, language, alert_threshold_estrus
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING *
            """, user_id, data.telegram_bot_token, data.telegram_chat_id, 
             data.email_notifications, data.telegram_notifications,
             data.theme, data.language, data.alert_threshold_estrus)
        
        return {"message": "Preferences updated successfully", "preferences": dict(prefs)}

@router.post("/test-telegram")
async def test_telegram(
    data: TelegramTest,
    current_user=Depends(get_current_user)
):
    """Test Telegram bot connection"""
    import httpx
    
    try:
        async with httpx.AsyncClient() as client:
            url = f"https://api.telegram.org/bot{data.bot_token}/sendMessage"
            response = await client.post(url, json={
                "chat_id": data.chat_id,
                "text": f"🎉 Test notification from Estrus AI Dashboard!\n\nBot connected successfully for user: {current_user['email']}"
            })
            
            if response.status_code == 200:
                return {"message": "Test message sent successfully!", "status": "connected"}
            else:
                raise HTTPException(status_code=400, detail="Failed to send test message")
    
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Telegram connection failed: {str(e)}")