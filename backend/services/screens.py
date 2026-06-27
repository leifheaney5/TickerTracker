"""Saved screener filters service."""
import json
import db
import models


def list_screens(user_id: int) -> list[dict]:
    """Return all saved screens for the user as list of {id, name, filters}."""
    with db.get_session() as s:
        rows = (
            s.query(models.SavedScreen)
            .filter_by(user_id=user_id)
            .order_by(models.SavedScreen.id)
            .all()
        )
        return [
            {"id": r.id, "name": r.name, "filters": json.loads(r.filters_json or "{}")}
            for r in rows
        ]


def save_screen(user_id: int, name: str, filters: dict) -> dict:
    """Persist a new saved screen; return {id, name, filters}."""
    with db.get_session() as s:
        row = models.SavedScreen(
            user_id=user_id,
            name=name,
            filters_json=json.dumps(filters),
        )
        s.add(row)
        s.commit()
        return {"id": row.id, "name": row.name, "filters": filters}


def delete_screen(user_id: int, screen_id: int) -> bool:
    """Delete screen only if it belongs to user_id. Return True if deleted."""
    with db.get_session() as s:
        row = s.get(models.SavedScreen, screen_id)
        if row is None or row.user_id != user_id:
            return False
        s.delete(row)
        s.commit()
        return True
