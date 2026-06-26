import logging
import os
from contextlib import contextmanager
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///ticker.db")
# Railway provides postgres:// ; normalize to the psycopg v3 dialect explicitly
# (`postgresql+psycopg://`). Without the +psycopg suffix SQLAlchemy defaults to
# the psycopg2 driver, which isn't installed (we use psycopg[binary] v3), and
# create_engine would crash at import — taking the whole app down on boot.
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+psycopg://", 1)
elif DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg://", 1)

_is_sqlite = DATABASE_URL.startswith("sqlite")
_connect_args = {"check_same_thread": False} if _is_sqlite else {"connect_timeout": 10}
# in-memory sqlite needs a shared static pool to persist across connections
_kw = {}
if DATABASE_URL == "sqlite://":
    from sqlalchemy.pool import StaticPool
    _kw = {"poolclass": StaticPool}
if not _is_sqlite:
    # Recycle connections + pre-ping so a dropped Postgres connection doesn't
    # surface as a hard error on the next request.
    _kw["pool_pre_ping"] = True
    _kw["pool_recycle"] = 300

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
    try:
        import models  # noqa: F401
        Base.metadata.create_all(engine)
    except Exception as e:  # pragma: no cover
        logging.getLogger(__name__).error("init_db failed (continuing): %s", e)
