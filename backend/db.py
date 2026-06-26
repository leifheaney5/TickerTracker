import os
from contextlib import contextmanager
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///ticker.db")
# Railway provides postgres:// ; SQLAlchemy needs postgresql://
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

_connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
# in-memory sqlite needs a shared static pool to persist across connections
_kw = {}
if DATABASE_URL == "sqlite://":
    from sqlalchemy.pool import StaticPool
    _kw = {"poolclass": StaticPool}

engine = create_engine(DATABASE_URL, connect_args=_connect_args, **_kw)
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)
Base = declarative_base()


@contextmanager
def get_session():
    s = SessionLocal()
    try:
        yield s
    finally:
        s.close()


def init_db():
    import models  # noqa: F401  (register models on Base)
    Base.metadata.create_all(engine)
    with get_session() as s:
        if s.get(models.User, 1) is None:
            s.add(models.User(id=1, email="you@example.com", name="Jordan Doe",
                              phone="+1 (555) 012-3344"))
            s.commit()
        if s.get(models.Settings, 1) is None:
            s.add(models.Settings(user_id=1))
            s.commit()
