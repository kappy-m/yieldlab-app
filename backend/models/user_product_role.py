from sqlalchemy import String, Integer, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from ..database import Base


class UserProductRole(Base):
    """
    ユーザーのプロダクト別アクセス権限。

    product_code: "yield" | "manage" | "review" | "reservation"
    role:         "admin" | "editor" | "viewer"

    将来のチーム機能追加時は TeamProductRole を別途追加し、
    effective_role = max(user_product_roles, team_product_roles) で解決する。
    """
    __tablename__ = "user_product_roles"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    product_code: Mapped[str] = mapped_column(String(30))
    role: Mapped[str] = mapped_column(String(20), default="viewer")

    user: Mapped["User"] = relationship(back_populates="product_roles")

    __table_args__ = (
        UniqueConstraint("user_id", "product_code", name="uq_user_product"),
    )
