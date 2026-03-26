from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from pydantic import BaseModel
from datetime import date, timedelta
from ..database import get_db
from ..models import Recommendation, ApprovalLog, ApprovalSetting, PricingGrid, RoomType, BarLadder
from ..models.property import Property
from ..services.rule_engine import RuleEngineInput, recommend
from ..dependencies import get_authed_property

router = APIRouter(prefix="/properties/{property_id}/recommendations", tags=["recommendations"])


class RecommendationOut(BaseModel):
    id: int
    room_type_id: int
    room_type_name: str
    target_date: str
    current_bar_level: str
    recommended_bar_level: str
    current_price: int
    recommended_price: int
    delta_levels: int
    reason: str
    status: str
    needs_approval: bool

    model_config = {"from_attributes": True}


class ApprovalAction(BaseModel):
    action: str            # approved / rejected / modified
    modified_bar_level: str | None = None
    modified_price: int | None = None
    note: str | None = None
    reviewer_id: str | None = "rm_user"


@router.get("/", response_model=list[RecommendationOut])
async def list_recommendations(
    status: str | None = None,
    prop: Property = Depends(get_authed_property),
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(Recommendation, RoomType.name.label("room_type_name"))
        .join(RoomType, Recommendation.room_type_id == RoomType.id)
        .where(Recommendation.property_id == prop.id)
    )
    if status:
        query = query.where(Recommendation.status == status)
    query = query.order_by(Recommendation.generated_at.desc())

    result = await db.execute(query)
    rows = result.all()

    setting = await db.execute(
        select(ApprovalSetting).where(ApprovalSetting.property_id == prop.id)
    )
    s = setting.scalar_one_or_none()
    threshold = s.auto_approve_threshold_levels if s else 1

    return [
        RecommendationOut(
            id=row.Recommendation.id,
            room_type_id=row.Recommendation.room_type_id,
            room_type_name=row.room_type_name,
            target_date=str(row.Recommendation.target_date),
            current_bar_level=row.Recommendation.current_bar_level,
            recommended_bar_level=row.Recommendation.recommended_bar_level,
            current_price=row.Recommendation.current_price,
            recommended_price=row.Recommendation.recommended_price,
            delta_levels=row.Recommendation.delta_levels,
            reason=row.Recommendation.reason,
            status=row.Recommendation.status,
            needs_approval=abs(row.Recommendation.delta_levels) > threshold,
        )
        for row in rows
    ]


@router.post("/generate", response_model=list[RecommendationOut])
async def generate_recommendations(
    days_ahead: int = 30,
    prop: Property = Depends(get_authed_property),
    db: AsyncSession = Depends(get_db),
):
    """ルールエンジンを実行して推奨価格を生成する"""
    setting_result = await db.execute(
        select(ApprovalSetting).where(ApprovalSetting.property_id == prop.id)
    )
    s = setting_result.scalar_one_or_none()
    threshold = s.auto_approve_threshold_levels if s else 1

    room_types_result = await db.execute(
        select(RoomType).where(RoomType.property_id == prop.id).order_by(RoomType.sort_order)
    )
    room_types = room_types_result.scalars().all()

    today = date.today()
    new_recs: list[Recommendation] = []

    for rt in room_types:
        bar_result = await db.execute(
            select(BarLadder).where(
                and_(BarLadder.property_id == prop.id, BarLadder.is_active == True)
            )
        )
        bar_ladders = {b.level: b.price for b in bar_result.scalars().all()}

        for day_offset in range(days_ahead):
            target = today + timedelta(days=day_offset)

            grid_result = await db.execute(
                select(PricingGrid).where(
                    and_(
                        PricingGrid.property_id == prop.id,
                        PricingGrid.room_type_id == rt.id,
                        PricingGrid.target_date == target,
                    )
                )
            )
            grid = grid_result.scalar_one_or_none()
            current_level = grid.bar_level if grid else "10"
            current_price = grid.price if grid else bar_ladders.get("10", 12000)
            available = grid.available_rooms if grid else rt.total_rooms

            inp = RuleEngineInput(
                current_level=current_level,
                pace_ratio=1.05 + (day_offset % 7) * 0.02,  # 仮データ
                inventory_ratio=available / max(rt.total_rooms, 1),
                competitor_avg_price=current_price * 1.08,    # 仮データ
                own_price=current_price,
                days_to_arrival=day_offset,
            )
            out = recommend(inp, threshold)

            if out.delta_levels == 0:
                continue

            rec_price = bar_ladders.get(out.recommended_level, current_price)
            status = "auto_approved" if not out.needs_approval else "pending"

            rec = Recommendation(
                property_id=prop.id,
                room_type_id=rt.id,
                target_date=target,
                current_bar_level=current_level,
                recommended_bar_level=out.recommended_level,
                current_price=current_price,
                recommended_price=rec_price,
                delta_levels=out.delta_levels,
                reason=out.reason,
                status=status,
            )
            db.add(rec)
            new_recs.append(rec)

    await db.commit()
    return await list_recommendations(status=None, prop=prop, db=db)


@router.post("/{recommendation_id}/action", response_model=RecommendationOut)
async def act_on_recommendation(
    recommendation_id: int,
    body: ApprovalAction,
    prop: Property = Depends(get_authed_property),
    db: AsyncSession = Depends(get_db),
):
    rec = await db.get(Recommendation, recommendation_id)
    if not rec or rec.property_id != prop.id:
        raise HTTPException(status_code=404, detail="Recommendation not found")
    if rec.status not in ("pending", "auto_approved"):
        raise HTTPException(status_code=400, detail=f"Already actioned: {rec.status}")

    if body.action not in ("approved", "rejected", "modified"):
        raise HTTPException(status_code=422, detail="action must be approved / rejected / modified")

    log = ApprovalLog(
        recommendation_id=rec.id,
        reviewer_id=body.reviewer_id,
        action=body.action,
        modified_bar_level=body.modified_bar_level,
        modified_price=body.modified_price,
        note=body.note,
    )
    db.add(log)

    if body.action in ("approved", "modified"):
        final_level = body.modified_bar_level or rec.recommended_bar_level
        final_price = body.modified_price or rec.recommended_price
        rec.status = "approved"

        grid_result = await db.execute(
            select(PricingGrid).where(
                and_(
                    PricingGrid.property_id == prop.id,
                    PricingGrid.room_type_id == rec.room_type_id,
                    PricingGrid.target_date == rec.target_date,
                )
            )
        )
        cell = grid_result.scalar_one_or_none()
        if cell:
            cell.bar_level = final_level
            cell.price = final_price
            cell.updated_by = "ai"
    else:
        rec.status = "rejected"

    await db.commit()
    await db.refresh(rec)

    room = await db.get(RoomType, rec.room_type_id)
    setting_result = await db.execute(
        select(ApprovalSetting).where(ApprovalSetting.property_id == prop.id)
    )
    s = setting_result.scalar_one_or_none()
    threshold = s.auto_approve_threshold_levels if s else 1

    return RecommendationOut(
        id=rec.id,
        room_type_id=rec.room_type_id,
        room_type_name=room.name if room else "",
        target_date=str(rec.target_date),
        current_bar_level=rec.current_bar_level,
        recommended_bar_level=rec.recommended_bar_level,
        current_price=rec.current_price,
        recommended_price=rec.recommended_price,
        delta_levels=rec.delta_levels,
        reason=rec.reason,
        status=rec.status,
        needs_approval=abs(rec.delta_levels) > threshold,
    )
