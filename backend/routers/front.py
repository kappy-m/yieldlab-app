"""Front プロダクト — チェックイン/アウト・ゲスト情報 API"""
from __future__ import annotations

import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import select, and_, or_, func
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models.guest_stay import GuestStay, StayStatus
from ..routers.auth import require_auth
from ..models.user import User

router = APIRouter(prefix="/properties/{property_id}/front", tags=["front"])


# ────────────────────────────────────────────────────────────────────────────
# Schemas
# ────────────────────────────────────────────────────────────────────────────

class GuestStayOut(BaseModel):
    id: int
    property_id: int
    reservation_no: str
    ota_channel: Optional[str]
    guest_name: str
    guest_name_kana: Optional[str]
    guest_email: Optional[str]
    guest_phone: Optional[str]
    guest_count: int
    nationality: Optional[str]
    room_number: Optional[str]
    room_type: Optional[str]
    floor: Optional[int]
    checkin_date: datetime.date
    checkout_date: datetime.date
    nights: int
    status: str
    checkin_time: Optional[datetime.time]
    checkout_time: Optional[datetime.time]
    plan_name: Optional[str]
    special_requests: Optional[str]
    is_repeat: bool

    model_config = {"from_attributes": True}


class GuestStayListOut(BaseModel):
    items: list[GuestStayOut]
    total: int
    today_checkin: int
    today_checkout: int
    today_inhouse: int


class UpdateStatusBody(BaseModel):
    status: StayStatus
    room_number: Optional[str] = None


# ────────────────────────────────────────────────────────────────────────────
# Helpers
# ────────────────────────────────────────────────────────────────────────────

async def _get_stay(db: AsyncSession, property_id: int, stay_id: int) -> GuestStay:
    result = await db.execute(
        select(GuestStay).where(
            GuestStay.property_id == property_id,
            GuestStay.id == stay_id,
        )
    )
    stay = result.scalar_one_or_none()
    if not stay:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stay not found")
    return stay


# ────────────────────────────────────────────────────────────────────────────
# Endpoints
# ────────────────────────────────────────────────────────────────────────────

@router.get("/stays", response_model=GuestStayListOut)
async def list_stays(
    property_id: int,
    date: Optional[str] = Query(default=None, description="対象日 YYYY-MM-DD（省略時は今日）"),
    view: str = Query(default="today", description="today | checkin | checkout | inhouse | all"),
    status_filter: Optional[str] = Query(default=None, alias="status"),
    search: Optional[str] = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_auth),
) -> GuestStayListOut:
    target_date = datetime.date.fromisoformat(date) if date else datetime.date.today()

    # ベースフィルタ
    filters = [GuestStay.property_id == property_id]

    if view == "checkin":
        filters.append(GuestStay.checkin_date == target_date)
    elif view == "checkout":
        filters.append(GuestStay.checkout_date == target_date)
    elif view == "inhouse":
        filters.append(
            and_(GuestStay.checkin_date <= target_date, GuestStay.checkout_date > target_date)
        )
    elif view == "today":
        filters.append(
            or_(
                GuestStay.checkin_date == target_date,
                GuestStay.checkout_date == target_date,
                and_(GuestStay.checkin_date < target_date, GuestStay.checkout_date > target_date),
            )
        )
    # view == "all" はフィルタなし

    if status_filter and status_filter != "all":
        filters.append(GuestStay.status == status_filter)

    if search:
        like = f"%{search}%"
        filters.append(
            or_(
                GuestStay.guest_name.ilike(like),
                GuestStay.reservation_no.ilike(like),
                GuestStay.room_number.ilike(like),
            )
        )

    query = select(GuestStay).where(and_(*filters)).order_by(GuestStay.checkin_date, GuestStay.guest_name)
    result = await db.execute(query)
    items = list(result.scalars().all())

    # 今日の統計（view に関係なく計算）
    today = datetime.date.today()
    stat_q = select(
        func.count(GuestStay.id).filter(GuestStay.checkin_date == today).label("ci"),
        func.count(GuestStay.id).filter(GuestStay.checkout_date == today).label("co"),
        func.count(GuestStay.id).filter(
            and_(GuestStay.checkin_date <= today, GuestStay.checkout_date > today,
                 GuestStay.status == StayStatus.checked_in)
        ).label("ih"),
    ).where(GuestStay.property_id == property_id)
    stat_res = await db.execute(stat_q)
    stats = stat_res.one()

    return GuestStayListOut(
        items=items,
        total=len(items),
        today_checkin=stats.ci or 0,
        today_checkout=stats.co or 0,
        today_inhouse=stats.ih or 0,
    )


@router.get("/stays/{stay_id}", response_model=GuestStayOut)
async def get_stay(
    property_id: int,
    stay_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_auth),
) -> GuestStayOut:
    stay = await _get_stay(db, property_id, stay_id)
    return GuestStayOut.model_validate(stay)


@router.patch("/stays/{stay_id}/status", response_model=GuestStayOut)
async def update_stay_status(
    property_id: int,
    stay_id: int,
    body: UpdateStatusBody,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_auth),
) -> GuestStayOut:
    stay = await _get_stay(db, property_id, stay_id)
    stay.status = body.status
    if body.room_number:
        stay.room_number = body.room_number
    if body.status == StayStatus.checked_in:
        stay.checkin_time = datetime.datetime.now().time()
    elif body.status == StayStatus.checked_out:
        stay.checkout_time = datetime.datetime.now().time()
    await db.commit()
    await db.refresh(stay)
    return GuestStayOut.model_validate(stay)
