"""Tests for saved screener filters (Task 3.2)."""
import pytest
import db
import models
from services import screens as svc


def _make_user(email: str) -> int:
    """Insert a bare User, return its id."""
    with db.get_session() as s:
        u = models.User(email=email, name="Test")
        s.add(u)
        s.commit()
        return u.id


# ── basic CRUD ────────────────────────────────────────────────────────────────

def test_save_and_list(fresh_db):
    uid = _make_user("a@example.com")
    filters = {"grp": "Tech", "perf": "Gainers", "cap": "All"}

    saved = svc.save_screen(uid, "My Tech Screen", filters)
    assert saved["name"] == "My Tech Screen"
    assert saved["filters"] == filters

    listed = svc.list_screens(uid)
    assert len(listed) == 1
    assert listed[0]["id"] == saved["id"]
    assert listed[0]["filters"] == filters


def test_delete_own_screen(fresh_db):
    uid = _make_user("b@example.com")
    saved = svc.save_screen(uid, "To Delete", {"grp": "All", "perf": "All", "cap": "All"})
    screen_id = saved["id"]

    deleted = svc.delete_screen(uid, screen_id)
    assert deleted is True
    assert svc.list_screens(uid) == []


def test_delete_nonexistent_returns_false(fresh_db):
    uid = _make_user("c@example.com")
    result = svc.delete_screen(uid, 9999)
    assert result is False


# ── scoping: user A cannot delete user B's screen ─────────────────────────────

def test_delete_scoped_to_user(fresh_db):
    uid_a = _make_user("owner@example.com")
    uid_b = _make_user("other@example.com")
    saved = svc.save_screen(uid_a, "Private", {"grp": "Finance", "perf": "All", "cap": "Mega"})
    screen_id = saved["id"]

    # User B tries to delete User A's screen — must return False and leave it
    result = svc.delete_screen(uid_b, screen_id)
    assert result is False

    # Row still exists for user A
    remaining = svc.list_screens(uid_a)
    assert len(remaining) == 1
    assert remaining[0]["id"] == screen_id


def test_list_scoped_to_user(fresh_db):
    uid_a = _make_user("u1@example.com")
    uid_b = _make_user("u2@example.com")
    svc.save_screen(uid_a, "Screen A", {"grp": "All", "perf": "All", "cap": "All"})
    svc.save_screen(uid_b, "Screen B", {"grp": "Tech", "perf": "Gainers", "cap": "Large"})

    assert len(svc.list_screens(uid_a)) == 1
    assert svc.list_screens(uid_a)[0]["name"] == "Screen A"
    assert len(svc.list_screens(uid_b)) == 1
    assert svc.list_screens(uid_b)[0]["name"] == "Screen B"
