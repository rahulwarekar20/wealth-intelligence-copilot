"""Database tables: users, profiles, holdings, other assets, evidence items, decisions (audit trail), documents and alerts."""

from sqlalchemy import Column, String, Numeric, Integer, Text, ForeignKey, TIMESTAMP, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.core.db import Base


class User(Base):
    """An account. Deleting a user deletes their holdings, decisions and documents."""
    __tablename__ = "users"
    __table_args__ = {"extend_existing": True}
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    email = Column(String, unique=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    risk_tolerance = Column(String, default="moderate")
    created_at = Column(TIMESTAMP(timezone=True), server_default=text("now()"))
    holdings = relationship("Holding", back_populates="user", cascade="all, delete-orphan")


class Holding(Base):
    """A position a user holds (prices are fetched live, not stored)."""
    __tablename__ = "holdings"
    __table_args__ = {"extend_existing": True}
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    ticker = Column(String, nullable=False)
    quantity = Column(Numeric, nullable=False)
    cost_basis = Column(Numeric)
    account_type = Column(String, default="taxable")
    created_at = Column(TIMESTAMP(timezone=True), server_default=text("now()"))
    user = relationship("User", back_populates="holdings")


class EvidenceItem(Base):
    """Cached evidence for a ticker from one source (sentiment / filing / price_volume), shared by all users."""
    __tablename__ = "evidence_items"
    __table_args__ = {"extend_existing": True}
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    ticker = Column(String, nullable=False)
    source_type = Column(String, nullable=False)
    payload = Column(JSONB, nullable=False)
    reliability_weight = Column(Numeric, default=1.0)
    retrieved_at = Column(TIMESTAMP(timezone=True), server_default=text("now()"))


class Decision(Base):
    """Audit-trail entry: one recommendation or strategy as given to the user."""
    __tablename__ = "decisions"
    __table_args__ = {"extend_existing": True}
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    ticker = Column(String)
    query_text = Column(String, nullable=False)
    recommendation_json = Column(JSONB, nullable=False)
    confidence = Column(Numeric)
    evidence_diversity_score = Column(Numeric)
    prompt_version = Column(String, default="v1")
    created_at = Column(TIMESTAMP(timezone=True), server_default=text("now()"))


class Document(Base):
    """A private document a user uploaded; only its extracted text is kept."""
    __tablename__ = "documents"
    __table_args__ = {"extend_existing": True}
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    filename = Column(String, nullable=False)
    content_type = Column(String, nullable=False)
    size_bytes = Column(Integer, nullable=False)
    text_content = Column(Text, nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), server_default=text("now()"))

class UserProfile(Base):
    """
    Investment preferences that personalise the advice. One row per user,
    created on first save; risk tolerance itself lives on users.risk_tolerance.
    """
    __tablename__ = "user_profiles"
    __table_args__ = {"extend_existing": True}
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    horizon_years = Column(Integer)                       # years until the money is needed; NULL = not set
    max_position_pct = Column(Numeric, nullable=False, server_default=text("25"))  # concentration limit per ticker
    updated_at = Column(TIMESTAMP(timezone=True), server_default=text("now()"))


class OtherAsset(Base):
    """Something the user owns outside their stock holdings: cash, bonds, property or other."""
    __tablename__ = "other_assets"
    __table_args__ = {"extend_existing": True}
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String, nullable=False)
    asset_class = Column(String, nullable=False)          # cash / bonds / property / other
    value = Column(Numeric, nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), server_default=text("now()"))


class Alert(Base):
    """
    An in-app notification. `dedupe_key` identifies the event (e.g. one per
    filing or per day), so re-running the checks never creates duplicates.
    """
    __tablename__ = "alerts"
    __table_args__ = (UniqueConstraint("user_id", "dedupe_key", name="uq_alerts_user_key"), {"extend_existing": True})
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    kind = Column(String, nullable=False)                 # concentration / price_drop / filing / earnings / strategy_change
    ticker = Column(String)
    message = Column(Text, nullable=False)
    dedupe_key = Column(String, nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), server_default=text("now()"))
    read_at = Column(TIMESTAMP(timezone=True))            # NULL = unread
