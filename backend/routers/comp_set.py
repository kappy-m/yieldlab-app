from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from ..database import get_db
from ..models import CompSet

router = APIRouter(prefix="/properties/{property_id}/comp-set", tags=["comp-set"])


class CompSetOut(BaseModel):
    id: int
    name: str
    expedia_hotel_id: str | None
    expedia_url: str | None
    rakuten_hotel_no: str | None = None
    google_place_id: str | None = None
    tripadvisor_location_id: str | None = None
    scrape_mode: str
    is_active: bool
    sort_order: int

    model_config = {"from_attributes": True}


class CompSetCreate(BaseModel):
    name: str
    expedia_hotel_id: str | None = None
    expedia_url: str | None = None
    rakuten_hotel_no: str | None = None
    google_place_id: str | None = None
    tripadvisor_location_id: str | None = None
    scrape_mode: str = "mock"
    sort_order: int = 0


class CompSetUpdate(BaseModel):
    name: str | None = None
    expedia_hotel_id: str | None = None
    expedia_url: str | None = None
    rakuten_hotel_no: str | None = None
    google_place_id: str | None = None
    tripadvisor_location_id: str | None = None
    scrape_mode: str | None = None
    is_active: bool | None = None
    sort_order: int | None = None


@router.get("/", response_model=list[CompSetOut])
async def list_comp_set(property_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(CompSet)
        .where(CompSet.property_id == property_id)
        .order_by(CompSet.sort_order)
    )
    return result.scalars().all()


@router.post("/", response_model=CompSetOut, status_code=201)
async def create_comp_hotel(
    property_id: int,
    body: CompSetCreate,
    db: AsyncSession = Depends(get_db),
):
    hotel = CompSet(property_id=property_id, **body.model_dump())
    db.add(hotel)
    await db.commit()
    await db.refresh(hotel)
    return hotel


@router.patch("/{comp_id}", response_model=CompSetOut)
async def update_comp_hotel(
    property_id: int,
    comp_id: int,
    body: CompSetUpdate,
    db: AsyncSession = Depends(get_db),
):
    hotel = await db.get(CompSet, comp_id)
    if not hotel or hotel.property_id != property_id:
        raise HTTPException(status_code=404, detail="CompSet not found")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(hotel, field, value)
    await db.commit()
    await db.refresh(hotel)
    return hotel


@router.delete("/{comp_id}", status_code=204)
async def delete_comp_hotel(
    property_id: int,
    comp_id: int,
    db: AsyncSession = Depends(get_db),
):
    hotel = await db.get(CompSet, comp_id)
    if not hotel or hotel.property_id != property_id:
        raise HTTPException(status_code=404, detail="CompSet not found")
    await db.delete(hotel)
    await db.commit()
