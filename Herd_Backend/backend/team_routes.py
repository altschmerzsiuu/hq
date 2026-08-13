"""
Team Management Endpoints
Handles listing team members, inviting new members, and updating roles.
Only accessible by 'owner' or 'admin' roles.
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from auth_routes import get_current_user
from auth_utils import hash_password
import secrets
import string

router = APIRouter(prefix="/api/admin", tags=["Team Management"])

# ── Allowed Roles ──────────────────────────────────────────────────────────────
ALLOWED_ROLES = ["admin", "worker", "viewer"]

# ── Permission Helper ──────────────────────────────────────────────────────────
def require_admin_or_owner(user: dict):
    """Raise 403 if user is not owner or admin."""
    if user.get("role") not in ("owner", "admin"):
        raise HTTPException(
            status_code=403,
            detail="Akses ditolak. Hanya Owner atau Admin yang dapat mengelola tim."
        )


# ── Pydantic Models ────────────────────────────────────────────────────────────
class InviteMemberRequest(BaseModel):
    email: EmailStr
    full_name: str = Field(..., min_length=2, max_length=100)
    role: str = Field(default="worker")


class UpdateRoleRequest(BaseModel):
    role: str


# ── Helper ─────────────────────────────────────────────────────────────────────
def generate_temp_password(length: int = 12) -> str:
    """Generate a secure random temporary password."""
    alphabet = string.ascii_letters + string.digits + "!@#$%"
    return ''.join(secrets.choice(alphabet) for _ in range(length))


# ── GET /api/admin/users ───────────────────────────────────────────────────────
@router.get("/users")
async def list_team_members(current_user: dict = Depends(get_current_user)):
    """
    List all users under the same farm (owner or members added by the owner).
    Owner/Admin only.
    """
    from app import get_db_pool
    require_admin_or_owner(current_user)

    # Effective owner is the user themselves (if owner) or their parent (if admin)
    owner_id = current_user.get("parent_id") or current_user.get("id")

    pool = await get_db_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT
                id,
                email,
                full_name,
                role,
                profile_picture_url,
                is_active,
                last_login_at,
                created_at
            FROM users
            WHERE (id = $1 OR parent_id = $1)
            ORDER BY created_at ASC
            """,
            owner_id
        )
        members = [dict(r) for r in rows]

    # Serialize datetime objects to ISO strings for JSON
    for m in members:
        if m.get("last_login_at"):
            m["last_login_at"] = m["last_login_at"].isoformat()
        if m.get("created_at"):
            m["created_at"] = m["created_at"].isoformat()

    return members


# ── POST /api/admin/users/invite ───────────────────────────────────────────────
@router.post("/users/invite", status_code=201)
async def invite_team_member(
    body: InviteMemberRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Invite a new team member. Creates their account with a temporary password.
    Owner/Admin only.
    """
    from app import get_db_pool
    require_admin_or_owner(current_user)

    if body.role not in ALLOWED_ROLES:
        raise HTTPException(
            status_code=400,
            detail=f"Role tidak valid. Pilihan yang diizinkan: {', '.join(ALLOWED_ROLES)}"
        )

    # The invited member's parent is always the farm owner
    owner_id = current_user.get("parent_id") or current_user.get("id")

    temp_password = generate_temp_password()
    password_hash = hash_password(temp_password)

    pool = await get_db_pool()
    async with pool.acquire() as conn:
        # Check if email already exists
        existing = await conn.fetchrow(
            "SELECT id FROM users WHERE email = $1",
            body.email
        )
        if existing:
            raise HTTPException(
                status_code=409,
                detail="Email sudah terdaftar. Pengguna ini mungkin sudah memiliki akun."
            )

        # Create the user account, linking them to the owner via parent_id
        new_user = await conn.fetchrow(
            """
            INSERT INTO users
                (email, full_name, password_hash, oauth_provider, role, parent_id, is_active)
            VALUES
                ($1, $2, $3, 'email', $4, $5, true)
            RETURNING id, email, full_name, role, created_at
            """,
            body.email,
            body.full_name,
            password_hash,
            body.role,
            owner_id
        )

    # TODO (optional): send an invitation email with the temp_password via mailer.py
    # For now, return the temp password in the response so the admin can share it.
    return {
        "message": f"Akun berhasil dibuat untuk {body.email}",
        "user": {
            "id": new_user["id"],
            "email": new_user["email"],
            "full_name": new_user["full_name"],
            "role": new_user["role"],
        },
        "temp_password": temp_password,
        "note": "Bagikan kata sandi sementara ini kepada anggota tim. Mereka dapat mengubahnya setelah masuk."
    }


# ── PATCH /api/admin/users/{member_id}/role ────────────────────────────────────
@router.patch("/users/{member_id}/role")
async def update_member_role(
    member_id: int,
    body: UpdateRoleRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Update a team member's role. Owner/Admin only.
    Cannot change the role of the owner themselves.
    """
    from app import get_db_pool
    require_admin_or_owner(current_user)

    if body.role not in ALLOWED_ROLES:
        raise HTTPException(
            status_code=400,
            detail=f"Role tidak valid. Pilihan yang diizinkan: {', '.join(ALLOWED_ROLES)}"
        )

    owner_id = current_user.get("parent_id") or current_user.get("id")

    pool = await get_db_pool()
    async with pool.acquire() as conn:
        # Make sure the target member belongs to the same farm
        target = await conn.fetchrow(
            "SELECT id, role, parent_id FROM users WHERE id = $1",
            member_id
        )
        if not target:
            raise HTTPException(status_code=404, detail="Anggota tim tidak ditemukan.")

        # Prevent changing the owner's own role
        if target["id"] == owner_id:
            raise HTTPException(
                status_code=400,
                detail="Tidak dapat mengubah role pemilik peternakan."
            )

        # Make sure target belongs to the same farm
        if target["parent_id"] != owner_id:
            raise HTTPException(
                status_code=403,
                detail="Anda tidak memiliki izin untuk mengubah role pengguna ini."
            )

        await conn.execute(
            "UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2",
            body.role,
            member_id
        )

    return {"message": f"Role anggota berhasil diperbarui menjadi '{body.role}'."}


# ── DELETE /api/admin/users/{member_id} ────────────────────────────────────────
@router.delete("/users/{member_id}")
async def remove_team_member(
    member_id: int,
    current_user: dict = Depends(get_current_user)
):
    """
    Remove a team member from the farm. Owner/Admin only.
    This deactivates their account, not a hard delete.
    """
    from app import get_db_pool
    require_admin_or_owner(current_user)

    owner_id = current_user.get("parent_id") or current_user.get("id")

    pool = await get_db_pool()
    async with pool.acquire() as conn:
        target = await conn.fetchrow(
            "SELECT id, parent_id FROM users WHERE id = $1",
            member_id
        )
        if not target:
            raise HTTPException(status_code=404, detail="Anggota tim tidak ditemukan.")

        if target["id"] == owner_id:
            raise HTTPException(
                status_code=400,
                detail="Tidak dapat menghapus akun pemilik peternakan."
            )

        if target["parent_id"] != owner_id:
            raise HTTPException(
                status_code=403,
                detail="Anda tidak memiliki izin untuk menghapus pengguna ini."
            )

        # Soft-delete: deactivate the account
        await conn.execute(
            "UPDATE users SET is_active = false, updated_at = NOW() WHERE id = $1",
            member_id
        )

    return {"message": "Anggota tim berhasil dihapus dari peternakan."}
