import bcrypt
import re
from datetime import datetime, timezone, timedelta
from fastapi import HTTPException, Response

class PINService:
    @staticmethod
    def hash_pin(pin: str) -> str:
        """Hash PIN using bcrypt"""
        password_bytes = pin.encode('utf-8')
        salt = bcrypt.gensalt()
        hashed = bcrypt.hashpw(password_bytes, salt)
        return hashed.decode('utf-8')

    @staticmethod
    def verify_pin_hash(plain_pin: str, hashed_pin: str) -> bool:
        """Verify PIN against bcrypt hash"""
        password_bytes = plain_pin.encode('utf-8')
        hashed_bytes = hashed_pin.encode('utf-8')
        return bcrypt.checkpw(password_bytes, hashed_bytes)

    @staticmethod
    async def set_pin(user_id: int, pin: str):
        # 1. Validate PIN is exactly 6 digits
        if not pin or not re.match(r"^\d{6}$", pin):
            raise HTTPException(status_code=400, detail="PIN harus berupa 6 digit angka.")
        
        # 2. Hash PIN
        pin_hash = PINService.hash_pin(pin)
        
        # 3. Upsert into user_pins
        from app import get_db_pool
        pool = await get_db_pool()
        async with pool.acquire() as conn:
            await conn.execute("""
                INSERT INTO user_pins (user_id, pin_hash, failed_attempts, locked_until, updated_at)
                VALUES ($1, $2, 0, NULL, NOW())
                ON CONFLICT (user_id) DO UPDATE 
                SET pin_hash = EXCLUDED.pin_hash,
                    failed_attempts = 0,
                    locked_until = NULL,
                    updated_at = NOW()
            """, user_id, pin_hash)
            
        return {"success": True}

    @staticmethod
    async def verify_pin(user_id: int, device_uuid: str, pin: str, response: Response):
        # Validate input types
        if not pin or not re.match(r"^\d{6}$", pin):
            raise HTTPException(status_code=400, detail="PIN harus berupa 6 digit angka.")

        from app import get_db_pool
        pool = await get_db_pool()
        async with pool.acquire() as conn:
            # 1. Check trusted_devices
            device = await conn.fetchrow("""
                SELECT id FROM trusted_devices
                WHERE user_id = $1 AND device_uuid = $2
            """, user_id, device_uuid)
            
            if not device:
                raise HTTPException(status_code=403, detail="Perangkat tidak dikenali. Silakan login ulang.")
                
            # 2. Fetch user_pins row
            pin_row = await conn.fetchrow("""
                SELECT pin_hash, failed_attempts, locked_until FROM user_pins
                WHERE user_id = $1
            """, user_id)
            
            if not pin_row:
                raise HTTPException(status_code=404, detail="PIN belum diatur.")
                
            # 3. Check if locked_until > NOW()
            locked_until = pin_row["locked_until"]
            if locked_until:
                now = datetime.now()
                if locked_until > now:
                    remaining = int((locked_until - now).total_seconds() / 60) + 1
                    raise HTTPException(status_code=423, detail=f"PIN dikunci. Coba lagi dalam {remaining} menit.")
            
            # 4. Verify bcrypt hash
            is_valid = PINService.verify_pin_hash(pin, pin_row["pin_hash"])
            if not is_valid:
                failed_attempts = pin_row["failed_attempts"] + 1
                locked_until_next = None
                
                if failed_attempts >= 5:
                    locked_until_next = datetime.now() + timedelta(minutes=10)
                    await conn.execute("""
                        UPDATE user_pins
                        SET failed_attempts = $2, locked_until = $3, updated_at = NOW()
                        WHERE user_id = $1
                    """, user_id, failed_attempts, locked_until_next)
                    raise HTTPException(status_code=423, detail="PIN dikunci karena salah 5 kali. Coba lagi dalam 10 menit.")
                else:
                    await conn.execute("""
                        UPDATE user_pins
                        SET failed_attempts = $2, updated_at = NOW()
                        WHERE user_id = $1
                    """, user_id, failed_attempts)
                    remaining_attempts = 5 - failed_attempts
                    raise HTTPException(status_code=401, detail=f"PIN salah. Sisa percobaan: {remaining_attempts}")
            
            # 5. PIN is correct:
            # - Reset failed_attempts & locked_until
            # - Update last_used_at in trusted_devices
            await conn.execute("""
                UPDATE user_pins
                SET failed_attempts = 0, locked_until = NULL, updated_at = NOW()
                WHERE user_id = $1
            """, user_id)
            
            await conn.execute("""
                UPDATE trusted_devices
                SET last_used_at = NOW()
                WHERE user_id = $1 AND device_uuid = $2
            """, user_id, device_uuid)
            
            # - Load user info to create tokens
            user = await conn.fetchrow("""
                SELECT id, email, full_name, role, parent_id, profile_picture_url, is_active 
                FROM users 
                WHERE id = $1 AND is_active = true
            """, user_id)
            
            if not user:
                raise HTTPException(status_code=404, detail="Pengguna tidak aktif atau tidak ditemukan.")
            
            # 6. Create access_token + refresh_token
            from auth_utils import create_access_token, create_refresh_token, REFRESH_TOKEN_EXPIRE_DAYS
            from auth_routes import set_auth_cookies
            
            access_token = create_access_token({
                "sub": str(user['id']), 
                "email": user['email'], 
                "role": user['role'], 
                "full_name": user['full_name']
            })
            refresh_token_str = create_refresh_token({"sub": str(user['id'])})
            
            # Store refresh token in database
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
                    "profile_picture_url": user['profile_picture_url'],
                    "has_pin": True
                }
            }

    @staticmethod
    async def register_device(user_id: int, device_uuid: str, device_label: str | None = None):
        if not device_uuid or len(device_uuid.strip()) == 0:
            raise HTTPException(status_code=400, detail="device_uuid tidak boleh kosong.")
            
        from app import get_db_pool
        pool = await get_db_pool()
        async with pool.acquire() as conn:
            await conn.execute("""
                INSERT INTO trusted_devices (user_id, device_uuid, device_label, last_used_at)
                VALUES ($1, $2, $3, NOW())
                ON CONFLICT (user_id, device_uuid) DO UPDATE
                SET last_used_at = NOW()
            """, user_id, device_uuid, device_label)
            
        return {"success": True}
