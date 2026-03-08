from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from ..database import get_db
from ..models.property import Property

router = APIRouter(prefix="/properties/{property_id}/market", tags=["market"])


class MarketEventOut(BaseModel):
    id: str
    name: str
    type: str
    date_start: str
    date_end: str
    date_label: str
    venue: str
    desc: str
    impact: str   # "影響大" | "影響中" | "影響小"
    icon: str
    source: str   # "holiday" | "seasonal"


@router.get("/events", response_model=list[MarketEventOut])
async def get_market_events(
    property_id: int,
    days: int = 90,
    db: AsyncSession = Depends(get_db),
):
    """
    今後 days 日分のマーケットイベント（祝日・季節需要）を返す。
    物件の event_area フィールドに基づきエリア特化イベントを返す。
    """
    from ..services.market_service import get_market_events as _get_events

    # property から event_area を取得（デフォルト: nihonbashi）
    prop = await db.get(Property, property_id)
    event_area = getattr(prop, "event_area", "nihonbashi") if prop else "nihonbashi"

    events = await _get_events(days_ahead=days, property_id=property_id, event_area=event_area)
    return events
