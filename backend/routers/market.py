from fastapi import APIRouter
from pydantic import BaseModel

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
):
    """今後 days 日分のマーケットイベント（祝日・季節需要）を返す"""
    from ..services.market_service import get_market_events
    events = await get_market_events(days_ahead=days)
    return events
