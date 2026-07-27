from sqlalchemy import Column, String, Numeric, ForeignKey, TIMESTAMP, text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.core.db import Base


class User(Base):
    __tablename__ = "users"
    __table_args__ = {"extend_existing": True}
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    email = Column(String, unique=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    risk_tolerance = Column(String, default="moderate")
    created_at = Column(TIMESTAMP(timezone=True), server_default=text("now()"))
    holdings = relationship("Holding", back_populates="user", cascade="all, delete-orphan")


class Holding(Base):
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
    __tablename__ = "evidence_items"
    __table_args__ = {"extend_existing": True}
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    ticker = Column(String, nullable=False)
    source_type = Column(String, nullable=False)
    payload = Column(JSONB, nullable=False)
    reliability_weight = Column(Numeric, default=1.0)
    retrieved_at = Column(TIMESTAMP(timezone=True), server_default=text("now()"))


class Decision(Base):
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


class ChatMessage(Base):
    __tablename__ = "chat_messages"
    __table_args__ = {"extend_existing": True}
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    session_id = Column(UUID(as_uuid=True), nullable=False)
    role = Column(String, nullable=False)
    content = Column(String, nullable=False)
    agent_attribution_json = Column(JSONB)
    created_at = Column(TIMESTAMP(timezone=True), server_default=text("now()"))