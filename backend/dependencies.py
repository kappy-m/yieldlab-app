"""
共通 FastAPI Dependency 定義。
全ルーターから import して認証・テナント分離を一元管理する。
"""
from fastapi import Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from .database import get_db
from .models.property import Property
from .models.user import User
from .routers.auth import require_auth


async def get_authed_property(
    property_id: int,
    current_user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> Property:
    """
    property_id のプロパティを取得し、リクエストユーザーの org に属することを検証する。
    不正アクセスは 403 で拒否し、存在しない場合は 404 を返す。
    """
    prop = await db.get(Property, property_id)
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")
    if prop.org_id != current_user.org_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="このプロパティへのアクセス権がありません",
        )
    return prop
