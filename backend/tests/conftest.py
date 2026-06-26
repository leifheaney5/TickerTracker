import os
os.environ["DATABASE_URL"] = "sqlite://"  # in-memory, before db import
import pytest


@pytest.fixture(autouse=True)
def fresh_db():
    import db
    db.Base.metadata.drop_all(db.engine)
    db.init_db()
    yield
