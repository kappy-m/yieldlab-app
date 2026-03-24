"""
ユーザー・プロダクト権限管理 API（管理者専用）

GET    /users                      → org内ユーザー一覧（product_roles含む）
POST   /users                      → ユーザー作成
PATCH  /users/{user_id}            → ユーザー情報更新
DELETE /users/{user_id}            → ユーザー削除
PUT    /users/{user_id}/product-roles → プロダクト権限を一括設定
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from pydantic import BaseModel, EmailStr

from ..database import get_db
from ..models.user import User
from ..models.user_product_role import UserProductRole
from ..routers.auth import require_auth, _hash_password

router = APIRouter(prefix="/users", tags=["users"])

PRODUCT_CODES = {"yield", "manage", "review", "reservation"}
PRODUCT_ROLES = {"admin", "editor", "viewer"}


# ─── Schemas ──────────────────────────────────────────────────────────────────

class ProductRoleItem(BaseModel):
    product_code: str
    role: str


class UserOut(BaseModel):
    id: int
    email: str
    name: str
    role: str
    is_active: bool
    product_roles: dict[str, str]

    model_config = {"from_attributes": True}


class UserCreate(BaseModel):
    email: str
    name: str
    password: str
    role: str = "viewer"
    product_roles: dict[str, str] = {}


class UserUpdate(BaseModel):
    name: str | None = None
    role: str | None = None
    is_active: bool | None = None
    password: str | None = None


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _require_admin(current_user: User) -> User:
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="この操作は管理者のみ実行できます",
        )
    return current_user


def _user_to_out(user: User) -> UserOut:
    return UserOut(
        id=user.id,
        email=user.email,
        name=user.name,
        role=user.role,
        is_active=user.is_active,
        product_roles={r.product_code: r.role for r in user.product_roles},
    )


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/", response_model=list[UserOut])
async def list_users(
    current_user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    """org 内の全ユーザーを返す。閲覧は全ロールに許可。"""
    result = await db.execute(
        select(User)
        .where(User.org_id == current_user.org_id)
        .order_by(User.id)
    )
    users = result.scalars().all()
    return [_user_to_out(u) for u in users]


@router.post("/", response_model=UserOut, status_code=201)
async def create_user(
    body: UserCreate,
    current_user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    """新規ユーザーを作成する（管理者のみ）。"""
    _require_admin(current_user)

    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="このメールアドレスは既に登録されています")

    user = User(
        org_id=current_user.org_id,
        email=body.email,
        name=body.name,
        password_hash=_hash_password(body.password),
        role=body.role,
    )
    db.add(user)
    await db.flush()

    for product_code, role in body.product_roles.items():
        if product_code in PRODUCT_CODES and role in PRODUCT_ROLES:
            db.add(UserProductRole(user_id=user.id, product_code=product_code, role=role))

    await db.commit()
    await db.refresh(user)
    return _user_to_out(user)


@router.patch("/{user_id}", response_model=UserOut)
async def update_user(
    user_id: int,
    body: UserUpdate,
    current_user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    """ユーザー情報を更新する（管理者のみ。自分自身のロール変更は不可）。"""
    _require_admin(current_user)

    user = await db.get(User, user_id)
    if not user or user.org_id != current_user.org_id:
        raise HTTPException(status_code=404, detail="ユーザーが見つかりません")

    if user_id == current_user.id and body.role is not None and body.role != "admin":
        raise HTTPException(status_code=400, detail="自分自身のロールを変更することはできません")

    if body.name is not None:
        user.name = body.name
    if body.role is not None:
        user.role = body.role
    if body.is_active is not None:
        user.is_active = body.is_active
    if body.password is not None:
        user.password_hash = _hash_password(body.password)

    await db.commit()
    await db.refresh(user)
    return _user_to_out(user)


@router.delete("/{user_id}", status_code=204)
async def delete_user(
    user_id: int,
    current_user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    """ユーザーを削除する（管理者のみ。自分自身の削除は不可）。"""
    _require_admin(current_user)

    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="自分自身を削除することはできません")

    user = await db.get(User, user_id)
    if not user or user.org_id != current_user.org_id:
        raise HTTPException(status_code=404, detail="ユーザーが見つかりません")

    await db.delete(user)
    await db.commit()


@router.put("/{user_id}/product-roles", response_model=UserOut)
async def set_product_roles(
    user_id: int,
    roles: list[ProductRoleItem],
    current_user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    """
    ユーザーのプロダクト権限を一括設定する（管理者のみ）。
    送信されたリストで全権限を上書きする。
    """
    _require_admin(current_user)

    user = await db.get(User, user_id)
    if not user or user.org_id != current_user.org_id:
        raise HTTPException(status_code=404, detail="ユーザーが見つかりません")

    # 既存の権限を全削除
    await db.execute(
        delete(UserProductRole).where(UserProductRole.user_id == user_id)
    )

    # 新しい権限を追加
    for item in roles:
        if item.product_code not in PRODUCT_CODES:
            raise HTTPException(status_code=422, detail=f"無効なプロダクトコード: {item.product_code}")
        if item.role not in PRODUCT_ROLES:
            raise HTTPException(status_code=422, detail=f"無効なロール: {item.role}")
        db.add(UserProductRole(user_id=user_id, product_code=item.product_code, role=item.role))

    await db.commit()
    await db.refresh(user)
    return _user_to_out(user)
