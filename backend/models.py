from sqlalchemy import (Column, Integer, String, Float, Boolean, DateTime, Date,
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
    plan = Column(String, default="free")  # 'free' | 'premium'


class WatchlistItem(Base):
    __tablename__ = "watchlist_items"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    watchlist_id = Column(Integer, ForeignKey("watchlists.id"), nullable=True, index=True)
    symbol = Column(String, nullable=False)
    position = Column(Integer, default=0)
    target = Column(Float, default=0.0)
    alert_price = Column(Float, default=0.0)
    alert_dir = Column(String, default="above")
    alert_active = Column(Boolean, default=False)
    alert_last_fired_at = Column(DateTime, nullable=True)
    kind = Column(String, default="stock")            # "stock" | "crypto"
    coin_name = Column(String, default="")            # cached display name (crypto)
    created_at = Column(DateTime, server_default=func.now())


class Watchlist(Base):
    __tablename__ = "watchlists"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String, nullable=False, default="My Watchlist")
    position = Column(Integer, default=0)
    share_token = Column(String, nullable=True, index=True)
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
    share_token = Column(String, nullable=True, index=True)
    unsub_token = Column(String, nullable=True, index=True)


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


class SavedScreen(Base):
    __tablename__ = "saved_screens"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String, nullable=False)
    filters_json = Column(String, default="")
    created_at = Column(DateTime, server_default=func.now())


class BillingSubscription(Base):
    __tablename__ = "billing_subscriptions"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True, index=True)
    plan = Column(String, default="free")
    status = Column(String, default="")
    stripe_customer_id = Column(String, nullable=True, index=True)
    stripe_subscription_id = Column(String, nullable=True, index=True)
    stripe_price_id = Column(String, nullable=True)
    current_period_end = Column(DateTime, nullable=True)
    cancel_at_period_end = Column(Boolean, default=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class StripeEvent(Base):
    __tablename__ = "stripe_events"
    event_id = Column(String, primary_key=True)
    event_type = Column(String, default="")
    received_at = Column(DateTime, server_default=func.now())


class SignalSnapshot(Base):
    """Daily Pulse snapshot per watched symbol — the durable first-party signal history.

    Symbol-scoped (not per-user): one row per symbol per day, the accruing time-series that
    cannot be backfilled. Powers Pulse sparklines and "shifted N days ago" annotations.
    """
    __tablename__ = "signal_snapshots"
    id = Column(Integer, primary_key=True)
    symbol = Column(String, nullable=False, index=True)
    date = Column(Date, nullable=False, index=True)
    pulse_score = Column(Float, default=0.0)
    pulse_band = Column(String, default="")
    sentiment_mood = Column(String, default="")
    price = Column(Float, default=0.0)
    created_at = Column(DateTime, server_default=func.now())
    __table_args__ = (UniqueConstraint("symbol", "date", name="uq_signal_symbol_date"),)
