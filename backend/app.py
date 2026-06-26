import os
import re
from flask import Flask, jsonify, request, send_from_directory

# Serve the built frontend (Vite emits to ../frontend/dist). In production a
# single Flask service hosts both the SPA and the /api endpoints. We disable
# Flask's auto static route so it can't shadow the SPA catch-all below.
_FRONTEND_DIST = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "frontend", "dist")

app = Flask(__name__, static_folder=None)

from flask_login import current_user
from auth import init_login
init_login(app)


def _require_user():
    """Return the authenticated user's id (int), or None if anonymous."""
    if not getattr(current_user, "is_authenticated", False):
        return None
    return int(current_user.id)

from auth.routes import auth_bp
app.register_blueprint(auth_bp, url_prefix="/api/auth")

from auth.google import register as register_google
register_google(app)

# Input validation: bound attacker-controlled values so they cannot be used to
# inflate the cache or hammer providers. Symbols are short alnum (+ . / -),
# timeframes come from a fixed whitelist, and the per-request symbol count is capped.
_SYMBOL_RE = re.compile(r"^[A-Z0-9.\-]{1,12}$")
_VALID_TF = {"1D", "1W", "1M", "3M", "1Y", "5Y"}
_MAX_SYMS = 60


def valid_symbol(sym: str) -> bool:
    return bool(_SYMBOL_RE.match(sym or ""))


def envelope(data, source="internal", stale=False):
    return jsonify({"data": data, "meta": {"source": source, "stale": stale}})


@app.route("/api/health")
def health():
    return envelope({"status": "ok"})


from services.quotes import get_quotes, get_market_status
from services.history import get_history
from services.fundamentals import get_fundamentals
from services.crypto import get_crypto, get_fng


@app.route("/api/quotes")
def quotes_route():
    syms = [s.strip().upper() for s in request.args.get("syms", "").split(",") if s.strip()]
    syms = [s for s in syms if valid_symbol(s)][:_MAX_SYMS]
    quotes, source = get_quotes(syms)
    return envelope({"quotes": quotes, "market_status": get_market_status()}, source=source)


@app.route("/api/history/<sym>")
def history_route(sym):
    sym = sym.upper()
    tf = request.args.get("tf", "3M")
    if not valid_symbol(sym) or tf not in _VALID_TF:
        return envelope({"error": "invalid symbol or timeframe"}), 400
    bars, source = get_history(sym, tf)
    return envelope(bars, source=source)


@app.route("/api/fundamentals/<sym>")
def fundamentals_route(sym):
    sym = sym.upper()
    if not valid_symbol(sym):
        return envelope({"error": "invalid symbol"}), 400
    data, source = get_fundamentals(sym)
    return envelope(data, source=source)


@app.route("/api/crypto")
def crypto_route():
    data, source = get_crypto()
    return envelope(data, source=source)


@app.route("/api/fng")
def fng_route():
    data, source = get_fng()
    return envelope(data, source=source)


from services.news import get_news
from services.ratings import get_ratings


@app.route("/api/news")
def news_route():
    sym = request.args.get("sym")
    if sym:
        sym = sym.upper()
        if not valid_symbol(sym):
            return envelope({"error": "invalid symbol"}), 400
    data, source = get_news(sym)  # sym None → market news
    return envelope(data, source=source)


@app.route("/api/ratings/<sym>")
def ratings_route(sym):
    sym = sym.upper()
    if not valid_symbol(sym):
        return envelope({"error": "invalid symbol"}), 400
    data, source = get_ratings(sym)
    return envelope(data, source=source)


# ─── Persistence (Postgres/SQLite via DATABASE_URL) ──────────────────────────
import db as _db
_db.init_db()

from services.store import (get_watchlist, add_watch, update_watch, remove_watch,
                            get_settings, update_settings,
                            get_holdings, set_holding, remove_holding)


@app.route("/api/watchlist", methods=["GET"])
def watchlist_get():
    if _require_user() is None:
        return envelope({"error": "authentication required"}), 401
    return envelope(get_watchlist(), source="db")


@app.route("/api/watchlist", methods=["POST"])
def watchlist_post():
    if _require_user() is None:
        return envelope({"error": "authentication required"}), 401
    b = request.get_json(force=True) or {}
    sym = (b.get("symbol") or "").upper()
    if not valid_symbol(sym):
        return envelope({"error": "invalid symbol"}), 400
    item = add_watch(sym, target=float(b.get("target", 0) or 0),
                     alert_price=float(b.get("alert_price", 0) or 0),
                     alert_dir=b.get("alert_dir", "above"))
    return envelope(item, source="db")


@app.route("/api/watchlist/<sym>", methods=["PATCH"])
def watchlist_patch(sym):
    if _require_user() is None:
        return envelope({"error": "authentication required"}), 401
    b = request.get_json(force=True) or {}
    item = update_watch(sym, **b)
    if item is None:
        return envelope({"error": "not found"}, source="db"), 404
    return envelope(item, source="db")


@app.route("/api/watchlist/<sym>", methods=["DELETE"])
def watchlist_delete(sym):
    if _require_user() is None:
        return envelope({"error": "authentication required"}), 401
    return envelope({"removed": remove_watch(sym)}, source="db")


@app.route("/api/settings", methods=["GET"])
def settings_get():
    if _require_user() is None:
        return envelope({"error": "authentication required"}), 401
    return envelope(get_settings(), source="db")


@app.route("/api/settings", methods=["PATCH"])
def settings_patch():
    if _require_user() is None:
        return envelope({"error": "authentication required"}), 401
    b = request.get_json(force=True) or {}
    return envelope(update_settings(**b), source="db")


@app.route("/api/holdings", methods=["GET"])
def holdings_get():
    if _require_user() is None:
        return envelope({"error": "authentication required"}), 401
    return envelope(get_holdings(), source="db")


@app.route("/api/holdings", methods=["POST"])
def holdings_post():
    if _require_user() is None:
        return envelope({"error": "authentication required"}), 401
    b = request.get_json(force=True) or {}
    sym = (b.get("symbol") or "").upper()
    if not valid_symbol(sym):
        return envelope({"error": "invalid symbol"}), 400
    return envelope(set_holding(sym, float(b.get("shares", 0) or 0),
                                float(b.get("avg_cost", 0) or 0)), source="db")


@app.route("/api/holdings/<sym>", methods=["DELETE"])
def holdings_delete(sym):
    if _require_user() is None:
        return envelope({"error": "authentication required"}), 401
    return envelope({"removed": remove_holding(sym)}, source="db")


# ─── SPA fallback ────────────────────────────────────────────────────────────
# Serve the built index.html for any non-API path so client-side state-driven
# navigation works on hard refresh. Unknown /api/* paths still 404 as JSON.
@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def spa(path):
    if path.startswith("api/"):
        return jsonify({"error": "not found"}), 404
    full = os.path.join(_FRONTEND_DIST, path)
    if path and os.path.isfile(full):
        return send_from_directory(_FRONTEND_DIST, path)
    index = os.path.join(_FRONTEND_DIST, "index.html")
    if os.path.isfile(index):
        return send_from_directory(_FRONTEND_DIST, "index.html")
    return jsonify({"error": "frontend not built", "hint": "run: cd frontend && npm run build"}), 503


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)), debug=False)
