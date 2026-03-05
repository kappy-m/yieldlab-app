from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from pydantic import BaseModel
from datetime import date
from ..database import get_db
from ..models import PricingGrid, RoomType

router = APIRouter(prefix="/properties/{property_id}/pricing", tags=["pricing"])


class PricingCellOut(BaseModel):
    id: int
    room_type_id: int
    room_type_name: str
    target_date: str
    bar_level: str
    price: int
    available_rooms: int
    updated_by: str

    model_config = {"from_attributes": True}


class PricingCellUpdate(BaseModel):
    bar_level: str
    price: int
    available_rooms: int


@router.get("/", response_model=list[PricingCellOut])
async def get_pricing_grid(
    property_id: int,
    date_from: date | None = None,
    date_to: date | None = None,
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(PricingGrid, RoomType.name.label("room_type_name"))
        .join(RoomType, PricingGrid.room_type_id == RoomType.id)
        .where(PricingGrid.property_id == property_id)
    )
    if date_from:
        query = query.where(PricingGrid.target_date >= date_from)
    if date_to:
        query = query.where(PricingGrid.target_date <= date_to)
    query = query.order_by(RoomType.sort_order, PricingGrid.target_date)

    result = await db.execute(query)
    rows = result.all()

    return [
        PricingCellOut(
            id=row.PricingGrid.id,
            room_type_id=row.PricingGrid.room_type_id,
            room_type_name=row.room_type_name,
            target_date=str(row.PricingGrid.target_date),
            bar_level=row.PricingGrid.bar_level,
            price=row.PricingGrid.price,
            available_rooms=row.PricingGrid.available_rooms,
            updated_by=row.PricingGrid.updated_by,
        )
        for row in rows
    ]


@router.patch("/{room_type_id}/{target_date}", response_model=PricingCellOut)
async def update_pricing_cell(
    property_id: int,
    room_type_id: int,
    target_date: date,
    body: PricingCellUpdate,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(PricingGrid).where(
            and_(
                PricingGrid.property_id == property_id,
                PricingGrid.room_type_id == room_type_id,
                PricingGrid.target_date == target_date,
            )
        )
    )
    cell = result.scalar_one_or_none()

    if not cell:
        room = await db.get(RoomType, room_type_id)
        if not room:
            raise HTTPException(status_code=404, detail="RoomType not found")
        cell = PricingGrid(
            property_id=property_id,
            room_type_id=room_type_id,
            target_date=target_date,
            bar_level=body.bar_level,
            price=body.price,
            available_rooms=body.available_rooms,
            updated_by="manual",
        )
        db.add(cell)
    else:
        cell.bar_level = body.bar_level
        cell.price = body.price
        cell.available_rooms = body.available_rooms
        cell.updated_by = "manual"

    await db.commit()
    await db.refresh(cell)

    room = await db.get(RoomType, room_type_id)
    return PricingCellOut(
        id=cell.id,
        room_type_id=cell.room_type_id,
        room_type_name=room.name if room else "",
        target_date=str(cell.target_date),
        bar_level=cell.bar_level,
        price=cell.price,
        available_rooms=cell.available_rooms,
        updated_by=cell.updated_by,
    )
