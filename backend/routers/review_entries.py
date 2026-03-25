"""
Review / Inquiry エントリ CRUD API
GET  /properties/{id}/reviews
GET  /properties/{id}/reviews/{review_id}
POST /properties/{id}/reviews/{review_id}/respond
GET  /properties/{id}/inquiries
GET  /properties/{id}/inquiries/{inquiry_id}
POST /properties/{id}/inquiries/{inquiry_id}/respond
PATCH /properties/{id}/inquiries/{inquiry_id}/status
"""
import datetime
import json
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models.review_entry import ReviewEntry, ReviewLanguage
from ..models.inquiry_entry import InquiryEntry, InquiryStatus
from ..routers.auth import require_auth
from ..models.user import User

router = APIRouter()


# ─── Pydantic スキーマ ────────────────────────────────────────

class ReviewOut(BaseModel):
    id: int
    platform: str
    author: str
    rating: float
    text: str
    date: str
    language: str
    responded: bool
    response: Optional[str] = None

    model_config = {"from_attributes": True}


class ReviewListOut(BaseModel):
    items: list[ReviewOut]
    total: int
    unresponded: int


class InquiryOut(BaseModel):
    id: int
    channel: str
    status: str
    priority: str
    customerName: str
    customerEmail: Optional[str] = None
    customerPhone: Optional[str] = None
    subject: str
    content: str
    date: str
    language: str
    assignee: Optional[str] = None
    tags: list[str] = []
    response: Optional[str] = None

    model_config = {"from_attributes": True}


class InquiryListOut(BaseModel):
    items: list[InquiryOut]
    total: int
    new_count: int


class RespondBody(BaseModel):
    response: str


class UpdateStatusBody(BaseModel):
    status: str
    assignee: Optional[str] = None


# ─── ヘルパー ─────────────────────────────────────────────────

def _to_review_out(r: ReviewEntry) -> ReviewOut:
    return ReviewOut(
        id=r.id,
        platform=r.platform.value,
        author=r.author,
        rating=r.rating,
        text=r.text,
        date=r.review_date.isoformat() if r.review_date else "",
        language=r.language.value,
        responded=r.responded,
        response=r.response,
    )


def _to_inquiry_out(q: InquiryEntry) -> InquiryOut:
    tags: list[str] = []
    if q.tags:
        try:
            tags = json.loads(q.tags)
        except Exception:
            tags = []
    return InquiryOut(
        id=q.id,
        channel=q.channel.value,
        status=q.status.value,
        priority=q.priority.value,
        customerName=q.customer_name,
        customerEmail=q.customer_email,
        customerPhone=q.customer_phone,
        subject=q.subject,
        content=q.content,
        date=q.inquiry_date.isoformat() if q.inquiry_date else "",
        language=q.language,
        assignee=q.assignee,
        tags=tags,
        response=q.response,
    )


# ─── 口コミ（Review）エンドポイント ──────────────────────────

@router.get("/properties/{property_id}/reviews", response_model=ReviewListOut)
async def list_reviews(
    property_id: int,
    platform: Optional[str] = None,
    rating: Optional[int] = None,
    language: Optional[str] = None,
    responded: Optional[bool] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_auth),
):
    stmt = select(ReviewEntry).where(ReviewEntry.property_id == property_id)
    if platform:
        stmt = stmt.where(ReviewEntry.platform == platform)
    if rating is not None:
        stmt = stmt.where(ReviewEntry.rating >= rating, ReviewEntry.rating < rating + 1)
    if language:
        stmt = stmt.where(ReviewEntry.language == language)
    if responded is not None:
        stmt = stmt.where(ReviewEntry.responded == responded)

    stmt = stmt.order_by(ReviewEntry.review_date.desc())
    result = await db.execute(stmt)
    all_items = result.scalars().all()
    unresponded = sum(1 for r in all_items if not r.responded)
    return ReviewListOut(
        items=[_to_review_out(r) for r in all_items],
        total=len(all_items),
        unresponded=unresponded,
    )


@router.get("/properties/{property_id}/reviews/{review_id}", response_model=ReviewOut)
async def get_review(
    property_id: int,
    review_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_auth),
):
    result = await db.execute(
        select(ReviewEntry).where(
            ReviewEntry.id == review_id,
            ReviewEntry.property_id == property_id,
        )
    )
    r = result.scalar_one_or_none()
    if not r:
        raise HTTPException(status_code=404, detail="口コミが見つかりません")
    return _to_review_out(r)


@router.post("/properties/{property_id}/reviews/{review_id}/respond", response_model=ReviewOut)
async def respond_to_review(
    property_id: int,
    review_id: int,
    body: RespondBody,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_auth),
):
    result = await db.execute(
        select(ReviewEntry).where(
            ReviewEntry.id == review_id,
            ReviewEntry.property_id == property_id,
        )
    )
    r = result.scalar_one_or_none()
    if not r:
        raise HTTPException(status_code=404, detail="口コミが見つかりません")
    r.response = body.response
    r.responded = True
    r.responded_at = datetime.date.today()
    await db.commit()
    await db.refresh(r)
    return _to_review_out(r)


# ─── 問い合わせ（Inquiry）エンドポイント ──────────────────────

@router.get("/properties/{property_id}/inquiries", response_model=InquiryListOut)
async def list_inquiries(
    property_id: int,
    channel: Optional[str] = None,
    status: Optional[str] = None,
    priority: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_auth),
):
    stmt = select(InquiryEntry).where(InquiryEntry.property_id == property_id)
    if channel:
        stmt = stmt.where(InquiryEntry.channel == channel)
    if status:
        stmt = stmt.where(InquiryEntry.status == status)
    if priority:
        stmt = stmt.where(InquiryEntry.priority == priority)

    stmt = stmt.order_by(InquiryEntry.inquiry_date.desc())
    result = await db.execute(stmt)
    all_items = result.scalars().all()
    new_count = sum(1 for i in all_items if i.status == InquiryStatus.new)
    return InquiryListOut(
        items=[_to_inquiry_out(i) for i in all_items],
        total=len(all_items),
        new_count=new_count,
    )


@router.get("/properties/{property_id}/inquiries/{inquiry_id}", response_model=InquiryOut)
async def get_inquiry(
    property_id: int,
    inquiry_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_auth),
):
    result = await db.execute(
        select(InquiryEntry).where(
            InquiryEntry.id == inquiry_id,
            InquiryEntry.property_id == property_id,
        )
    )
    q = result.scalar_one_or_none()
    if not q:
        raise HTTPException(status_code=404, detail="問い合わせが見つかりません")
    return _to_inquiry_out(q)


@router.post("/properties/{property_id}/inquiries/{inquiry_id}/respond", response_model=InquiryOut)
async def respond_to_inquiry(
    property_id: int,
    inquiry_id: int,
    body: RespondBody,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_auth),
):
    result = await db.execute(
        select(InquiryEntry).where(
            InquiryEntry.id == inquiry_id,
            InquiryEntry.property_id == property_id,
        )
    )
    q = result.scalar_one_or_none()
    if not q:
        raise HTTPException(status_code=404, detail="問い合わせが見つかりません")
    q.response = body.response
    q.responded_at = datetime.date.today()
    if q.status == InquiryStatus.new:
        q.status = InquiryStatus.in_progress
    await db.commit()
    await db.refresh(q)
    return _to_inquiry_out(q)


@router.patch("/properties/{property_id}/inquiries/{inquiry_id}/status", response_model=InquiryOut)
async def update_inquiry_status(
    property_id: int,
    inquiry_id: int,
    body: UpdateStatusBody,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_auth),
):
    result = await db.execute(
        select(InquiryEntry).where(
            InquiryEntry.id == inquiry_id,
            InquiryEntry.property_id == property_id,
        )
    )
    q = result.scalar_one_or_none()
    if not q:
        raise HTTPException(status_code=404, detail="問い合わせが見つかりません")
    try:
        q.status = InquiryStatus(body.status)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"無効なステータス: {body.status}")
    if body.assignee is not None:
        q.assignee = body.assignee
    await db.commit()
    await db.refresh(q)
    return _to_inquiry_out(q)
