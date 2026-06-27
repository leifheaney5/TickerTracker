from sqlalchemy import (Column, Integer, String, Float, Boolean, DateTime,
                        ForeignKey, func, UniqueConstraint)
from db import Base
from flask_login import UserMixin


class User(UserMixin, Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    email = Column(String, nullable=False, unique=True, index=True)
    name = Column(String, default="")
    phone = Column(String, default="")
    created_at = Column(DateTime, server_default=func.now())
    password_hash = Column(String, nullable=True)
    email_verified = Column(Boolean, default=False)


class WatchlistItem(Base):
    __tablename__ = "watchlist_items"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    symbol = Column(String, nullable=False)
    position = Column(Integer, default=0)
    target = Column(Float, default=0.0)
    alert_price = Column(Float, default=0.0)
    alert_dir = Column(String, default="above")
    alert_active = Column(Boolean, default=False)
    alert_last_fired_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now())


class Holding(Base):
    __tablename__ = "holdings"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    symbol = Column(String, nullable=False)
    shares = Column(Float, default=0.0)
    avg_cost = Column(Float, default=0.0)


class AlertLog(Base):
    __tablename__ = "alert_log"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    symbol = Column(String, nullable=False)
    price = Column(Float, default=0.0)
    triggered_at = Column(DateTime, server_default=func.now())


class Settings(Base):
    __tablename__ = "settings"
    user_id = Column(Integer, ForeignKey("users.id"), primary_key=True)
    broker_connected = Column(Boolean, default=False)
    broker_name = Column(String, default="")
    live_updates = Column(Boolean, default=True)
    alert_notifs = Column(Boolean, default=True)
    news_digest = Column(Boolean, default=False)
    hide_balances = Column(Boolean, default=False)
    currency = Column(String, default="USD")


class CustomSymbol(Base):
    __tablename__ = "custom_symbols"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    symbol = Column(String, nullable=False)
    name = Column(String, default="")
    sector = Column(String, default="—")
    group = Column(String, default="Tech")
    exch = Column(String, default="—")


class OAuthIdentity(Base):
    __tablename__ = "oauth_identities"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    provider = Column(String, nullable=False)
    subject = Column(String, nullable=False)
    __table_args__ = (UniqueConstraint("provider", "subject", name="uq_provider_subject"),)


class EmailToken(Base):
    __tablename__ = "email_tokens"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    kind = Column(String, nullable=False)            # 'verify' | 'reset'
    token_hash = Column(String, nullable=False, index=True)
    expires_at = Column(DateTime, nullable=False)
    used_at = Column(DateTime, nullable=True)


class LoginAttempt(Base):
    __tablename__ = "login_attempts"
    id = Column(Integer, primary_key=True)
    email = Column(String, nullable=False, index=True)
    ip = Column(String, default="")
    created_at = Column(DateTime, server_default=func.now(), index=True)
    success = Column(Boolean, default=False)
