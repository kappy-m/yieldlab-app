from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, update
from pydantic import BaseModel, field_validator
from ..database import get_db
from ..models import Organization, Property, RoomType, BarLadder, ApprovalSetting, PricingGrid

router = APIRouter(prefix="/properties", tags=["properties"])


class PropertyOut(BaseModel):
    id: int
    org_id: int
    name: str
    cm_property_code: str | None
    brand: str | None = None
    address: str | None = None
    star_rating: int | None = None
    total_rooms: int | None = None
    checkin_time: str | None = None
    checkout_time: str | None = None
    website_url: str | None = None
    own_rakuten_hotel_no: str | None = None

    model_config = {"from_attributes": True}


class RoomTypeOut(BaseModel):
    id: int
    name: str
    cm_room_type_code: str | None
    total_rooms: int
    sort_order: int

    model_config = {"from_attributes": True}


class BarLadderOut(BaseModel):
    id: int
    level: str
    price: int
    label: str
    room_type_id: int | None

    model_config = {"from_attributes": True}


class ApprovalSettingOut(BaseModel):
    id: int
    auto_approve_threshold_levels: int
    notification_channel: str
    notification_email: str | None

    model_config = {"from_attributes": True}


@router.get("/", response_model=list[PropertyOut])
async def list_properties(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Property))
    return result.scalars().all()


@router.get("/{property_id}", response_model=PropertyOut)
async def get_property(property_id: int, db: AsyncSession = Depends(get_db)):
    prop = await db.get(Property, property_id)
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")
    return prop


@router.get("/{property_id}/room-types", response_model=list[RoomTypeOut])
async def list_room_types(property_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(RoomType)
        .where(RoomType.property_id == property_id)
        .order_by(RoomType.sort_order)
    )
    return result.scalars().all()


@router.get("/{property_id}/bar-ladder", response_model=list[BarLadderOut])
async def get_bar_ladder(property_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(BarLadder)
        .where(BarLadder.property_id == property_id, BarLadder.is_active == True)
        .order_by(BarLadder.room_type_id, BarLadder.level)
    )
    return result.scalars().all()


class BarLadderUpdate(BaseModel):
    price: int
    label: str | None = None

    @field_validator("price")
    @classmethod
    def price_positive(cls, v: int) -> int:
        if v <= 0:
            raise ValueError("価格は1円以上である必要があります")
        return v


class BarLadderBulkItem(BaseModel):
    id: int
    price: int
    label: str | None = None


class BarLadderBulkUpdate(BaseModel):
    items: list[BarLadderBulkItem]


class ApprovalSettingUpdate(BaseModel):
    auto_approve_threshold_levels: int | None = None
    notification_channel: str | None = None
    notification_email: str | None = None


@router.patch("/{property_id}/bar-ladder/{bar_id}", response_model=BarLadderOut)
async def update_bar_ladder_entry(
    property_id: int,
    bar_id: int,
    body: BarLadderUpdate,
    db: AsyncSession = Depends(get_db),
):
    entry = await db.get(BarLadder, bar_id)
    if not entry or entry.property_id != property_id:
        raise HTTPException(status_code=404, detail="BarLadder entry not found")

    entry.price = body.price
    if body.label is not None:
        entry.label = body.label
    await db.commit()
    await db.refresh(entry)
    return entry


@router.put("/{property_id}/bar-ladder/bulk", response_model=list[BarLadderOut])
async def bulk_update_bar_ladder(
    property_id: int,
    body: BarLadderBulkUpdate,
    db: AsyncSession = Depends(get_db),
):
    """複数のBARラダーエントリを一括更新"""
    updated = []
    for item in body.items:
        entry = await db.get(BarLadder, item.id)
        if not entry or entry.property_id != property_id:
            continue
        entry.price = item.price
        if item.label is not None:
            entry.label = item.label
        updated.append(entry)
    await db.commit()
    for entry in updated:
        await db.refresh(entry)
    return updated


@router.post("/{property_id}/bar-ladder/sync-grid")
async def sync_grid_from_bar_ladder(
    property_id: int,
    db: AsyncSession = Depends(get_db),
):
    """
    BARラダーの価格を pricing_grid に反映する。
    既存のグリッドセルが持つ bar_level に対応する最新価格で上書きする。
    """
    # BARラダー全取得
    bar_result = await db.execute(
        select(BarLadder).where(
            and_(BarLadder.property_id == property_id, BarLadder.is_active == True)
        )
    )
    bars = bar_result.scalars().all()
    # (room_type_id, level) → price のマップを構築
    bar_map: dict[tuple[int | None, str], int] = {
        (b.room_type_id, b.level): b.price for b in bars
    }

    # pricing_grid を全件取得して bar_level に合わせて価格更新
    grid_result = await db.execute(
        select(PricingGrid).where(PricingGrid.property_id == property_id)
    )
    grids = grid_result.scalars().all()
    updated_count = 0
    for g in grids:
        new_price = bar_map.get((g.room_type_id, g.bar_level))
        if new_price is None:
            # room_type_id なしのデフォルトもフォールバックとして確認
            new_price = bar_map.get((None, g.bar_level))
        if new_price and g.price != new_price:
            g.price = new_price
            updated_count += 1

    await db.commit()
    return {"synced_rows": updated_count, "message": f"{updated_count}件のグリッドを更新しました"}


@router.patch("/{property_id}/approval-settings", response_model=ApprovalSettingOut)
async def update_approval_settings(
    property_id: int,
    body: ApprovalSettingUpdate,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ApprovalSetting).where(ApprovalSetting.property_id == property_id)
    )
    setting = result.scalar_one_or_none()
    if not setting:
        raise HTTPException(status_code=404, detail="ApprovalSetting not found")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(setting, field, value)
    await db.commit()
    await db.refresh(setting)
    return setting


@router.get("/{property_id}/approval-settings", response_model=ApprovalSettingOut | None)
async def get_approval_settings(property_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ApprovalSetting).where(ApprovalSetting.property_id == property_id)
    )
    return result.scalar_one_or_none()


class PropertySettingsUpdate(BaseModel):
    own_rakuten_hotel_no: str | None = None


@router.patch("/{property_id}/settings", response_model=PropertyOut)
async def update_property_settings(
    property_id: int,
    body: PropertySettingsUpdate,
    db: AsyncSession = Depends(get_db),
):
    """自社楽天ホテル番号など物件設定を更新する。"""
    prop = await db.get(Property, property_id)
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")
    if body.own_rakuten_hotel_no is not None:
        prop.own_rakuten_hotel_no = body.own_rakuten_hotel_no or None
    await db.commit()
    await db.refresh(prop)
    return prop
