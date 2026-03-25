"""Reservation プロダクト — 予約一覧・カレンダー API"""
from __future__ import annotations

import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import select, and_, or_, extract
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models.reservation import Reservation, ReservationStatus
from ..routers.auth import require_auth
from ..models.user import User

router = APIRouter(prefix="/properties/{property_id}/reservations", tags=["reservation"])


# ────────────────────────────────────────────────────────────────────────────
# Schemas
# ────────────────────────────────────────────────────────────────────────────

class ReservationOut(BaseModel):
    id: int
    property_id: int
    reservation_no: str
    ota_channel: Optional[str]
    booking_date: datetime.date
    guest_name: str
    guest_name_kana: Optional[str]
    guest_email: Optional[str]
    guest_count: int
    nationality: Optional[str]
    checkin_date: datetime.date
    checkout_date: datetime.date
    nights: int
    room_type: Optional[str]
    plan_name: Optional[str]
    total_amount: Optional[float]
    currency: str
    status: str
    is_group: bool

    model_config = {"from_attributes": True}


class ReservationListOut(BaseModel):
    items: list[ReservationOut]
    total: int
    # カレンダー集計（月ごと）
    monthly_counts: dict[str, int]  # "YYYY-MM-DD" → 予約件数


class UpdateReservationBody(BaseModel):
    status: ReservationStatus


# ────────────────────────────────────────────────────────────────────────────
# Endpoints
# ────────────────────────────────────────────────────────────────────────────

@router.get("", response_model=ReservationListOut)
async def list_reservations(
    property_id: int,
    month: Optional[str] = Query(default=None, description="YYYY-MM（月フィルタ）"),
    status_filter: Optional[str] = Query(default=None, alias="status"),
    search: Optional[str] = Query(default=None),
    view: str = Query(default="list", description="list | calendar"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_auth),
) -> ReservationListOut:
    filters = [Reservation.property_id == property_id]

    if month:
        try:
            year_m, month_m = map(int, month.split("-"))
            first_day = datetime.date(year_m, month_m, 1)
            if month_m == 12:
                last_day = datetime.date(year_m + 1, 1, 1) - datetime.timedelta(days=1)
            else:
                last_day = datetime.date(year_m, month_m + 1, 1) - datetime.timedelta(days=1)
            # チェックイン or チェックアウトが月内にある予約
            filters.append(
                or_(
                    and_(Reservation.checkin_date >= first_day, Reservation.checkin_date <= last_day),
                    and_(Reservation.checkout_date >= first_day, Reservation.checkout_date <= last_day),
                    and_(Reservation.checkin_date <= first_day, Reservation.checkout_date >= last_day),
                )
            )
        except (ValueError, AttributeError):
            pass

    if status_filter and status_filter != "all":
        filters.append(Reservation.status == status_filter)

    if search:
        like = f"%{search}%"
        filters.append(
            or_(
                Reservation.guest_name.ilike(like),
                Reservation.reservation_no.ilike(like),
            )
        )

    query = select(Reservation).where(and_(*filters)).order_by(Reservation.checkin_date)
    result = await db.execute(query)
    items = list(result.scalars().all())

    # カレンダー集計（チェックイン日ごとの件数）
    monthly_counts: dict[str, int] = {}
    for item in items:
        if item.status not in (ReservationStatus.cancelled, ReservationStatus.no_show):
            d_str = item.checkin_date.isoformat()
            monthly_counts[d_str] = monthly_counts.get(d_str, 0) + 1

    return ReservationListOut(items=items, total=len(items), monthly_counts=monthly_counts)


@router.get("/{reservation_id}", response_model=ReservationOut)
async def get_reservation(
    property_id: int,
    reservation_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_auth),
) -> ReservationOut:
    result = await db.execute(
        select(Reservation).where(
            Reservation.property_id == property_id,
            Reservation.id == reservation_id,
        )
    )
    res = result.scalar_one_or_none()
    if not res:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reservation not found")
    return ReservationOut.model_validate(res)


@router.patch("/{reservation_id}/status", response_model=ReservationOut)
async def update_reservation_status(
    property_id: int,
    reservation_id: int,
    body: UpdateReservationBody,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_auth),
) -> ReservationOut:
    result = await db.execute(
        select(Reservation).where(
            Reservation.property_id == property_id,
            Reservation.id == reservation_id,
        )
    )
    res = result.scalar_one_or_none()
    if not res:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reservation not found")
    res.status = body.status
    await db.commit()
    await db.refresh(res)
    return ReservationOut.model_validate(res)
