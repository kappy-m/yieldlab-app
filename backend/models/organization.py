from sqlalchemy import String, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from ..database import Base

class Organization(Base):
    __tablename__ = "organizations"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    plan_tier: Mapped[str] = mapped_column(String(50), default="starter")
    created_at: Mapped[str] = mapped_column(DateTime, default=func.now())

    properties: Mapped[list["Property"]] = relationship(back_populates="organization")
