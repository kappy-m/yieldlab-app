"""
認証 API
POST /auth/login  → JWT トークン発行 + HttpOnly cookie セット
GET  /auth/me     → 現在のユーザー情報（product_roles 含む）
"""
import os
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from ..database import get_db
from ..models.user import User
from ..rate_limit import limiter

try:
    from jose import jwt, JWTError
    _HAS_JOSE = True
except ImportError:
    _HAS_JOSE = False

try:
    import bcrypt as _bcrypt_lib
    _HAS_BCRYPT = True
except ImportError:
    _HAS_BCRYPT = False

router = APIRouter(prefix="/auth", tags=["auth"])

SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "yieldlab-poc-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7日間
_IS_PROD = os.environ.get("ENVIRONMENT", "development") == "production"

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)


# ─── Pydantic schemas ─────────────────────────────────────────────────────────

class TokenOut(BaseModel):
    access_token: str
    token_type: str
    user_id: int
    name: str
    role: str
    org_id: int
    product_roles: dict[str, str]


class UserOut(BaseModel):
    id: int
    name: str
    email: str
    role: str
    org_id: int
    product_roles: dict[str, str]

    model_config = {"from_attributes": True}


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _verify_password(plain: str, hashed: str) -> bool:
    if _HAS_BCRYPT:
        try:
            return _bcrypt_lib.checkpw(plain.encode(), hashed.encode())
        except Exception:
            pass
    return plain == hashed


def _hash_password(plain: str) -> str:
    if _HAS_BCRYPT:
        try:
            salt = _bcrypt_lib.gensalt()
            return _bcrypt_lib.hashpw(plain.encode(), salt).decode()
        except Exception:
            pass
    return plain


def _build_product_roles(user: User) -> dict[str, str]:
    """UserProductRole リストを {product_code: role} dict に変換する。"""
    return {r.product_code: r.role for r in user.product_roles}


def _create_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode["exp"] = expire
    if not _HAS_JOSE:
        import json, base64
        return base64.b64encode(json.dumps(to_encode, default=str).encode()).decode()
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def _decode_token(token: str) -> Optional[dict]:
    if not _HAS_JOSE:
        import json, base64
        try:
            return json.loads(base64.b64decode(token).decode())
        except Exception:
            return None
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        return None


# ─── Dependency ───────────────────────────────────────────────────────────────

async def get_current_user(
    token: Optional[str] = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> Optional[User]:
    """JWT トークンから現在のユーザーを取得する。トークン未提供時は None を返す。"""
    if not token:
        return None
    payload = _decode_token(token)
    if not payload:
        return None
    user_id: int = payload.get("sub")
    if not user_id:
        return None
    user = await db.get(User, int(user_id))
    if not user or not user.is_active:
        return None
    return user


async def require_auth(
    current_user: Optional[User] = Depends(get_current_user),
) -> User:
    """認証必須。トークン未提供・無効の場合は 401 を返す。"""
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="認証が必要です",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return current_user


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/login", response_model=TokenOut)
@limiter.limit("5/minute")
async def login(
    request: Request,
    response: Response,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
):
    """email / password でログインし JWT トークンを発行する。ブルートフォース防止: 5回/分。"""
    
    result = await db.execute(select(User).where(User.email == form_data.username))
    user = result.scalar_one_or_none()

    if not user or not _verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="メールアドレスまたはパスワードが間違っています",
        )

    if not user.is_active:
        raise HTTPException(status_code=400, detail="このアカウントは無効です")

    product_roles = _build_product_roles(user)

    token = _create_token({
        "sub": str(user.id),
        "org_id": user.org_id,
        "role": user.role,
        "roles": product_roles,
    })

    # Next.js middleware がルーティングガードに使うための HttpOnly cookie
    response.set_cookie(
        key="yl_token",
        value=token,
        httponly=True,
        samesite="lax",
        secure=_IS_PROD,
        max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/",
    )

    return TokenOut(
        access_token=token,
        token_type="bearer",
        user_id=user.id,
        name=user.name,
        role=user.role,
        org_id=user.org_id,
        product_roles=product_roles,
    )


@router.post("/logout")
async def logout(response: Response):
    """ログアウト: HttpOnly cookie を削除する。"""
    response.delete_cookie(key="yl_token", path="/")
    return {"message": "ログアウトしました"}


@router.get("/me", response_model=UserOut)
async def get_me(current_user: User = Depends(require_auth)):
    """現在ログイン中のユーザー情報を返す（product_roles 含む）。"""
    return UserOut(
        id=current_user.id,
        name=current_user.name,
        email=current_user.email,
        role=current_user.role,
        org_id=current_user.org_id,
        product_roles=_build_product_roles(current_user),
    )
