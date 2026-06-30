import json as _json
import os
import re
import datetime as _dt
from flask import Flask, Response, jsonify, request, send_from_directory, stream_with_context

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


@app.after_request
def _security_headers(resp):
    # Baseline security headers (clickjacking, MIME-sniffing, referrer leakage,
    # transport). Kept conservative so the SPA + CDN logos/fonts still work.
    resp.headers.setdefault("X-Content-Type-Options", "nosniff")
    resp.headers.setdefault("X-Frame-Options", "DENY")
    resp.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    resp.headers.setdefault(
        "Content-Security-Policy",
        # SPA uses inline styles (design tokens) + external font/logo CDNs + the
        # same-origin API. frame-ancestors 'none' backstops clickjacking.
        "default-src 'self'; "
        "img-src 'self' https: data:; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
        "font-src 'self' https://fonts.gstatic.com; "
        "script-src 'self'; "
        "connect-src 'self'; "
        "frame-ancestors 'none'; "
        "base-uri 'self'",
    )
    if os.environ.get("APP_BASE_URL", "").startswith("https"):
        resp.headers.setdefault("Strict-Transport-Security",
                                "max-age=31536000; includeSubDomains")
    return resp

from auth.google import register as register_google
register_google(app)

# ─── Lightweight IP-keyed rate limit for the public market proxy ─────────────
# The unauthenticated /api market endpoints proxy upstream providers (Finnhub/
# Yahoo). A caller rotating symbols can force cache-miss fetches and burn our
# provider quota. This caps requests per client IP over a sliding window. In-
# process (single gunicorn service); for multi-instance, swap for Redis.
import time as _time
from collections import deque, defaultdict
import threading as _threading

_RL_WINDOW = 60          # seconds
_RL_MAX = 120            # max market-proxy requests per IP per window
_rl_hits: dict = defaultdict(deque)
_rl_lock = _threading.Lock()

# Only throttle the public provider-proxy routes (read-only market data).
_RL_PREFIXES = ("/api/quotes", "/api/history", "/api/fundamentals",
                "/api/news", "/api/ratings", "/api/crypto", "/api/fng",
                "/api/search", "/api/earnings", "/api/sentiment", "/api/pulse",
                "/api/logos", "/api/stream/quotes")


def _client_ip():
    # Railway/Proxies set X-Forwarded-For; take the first hop. Falls back to
    # remote_addr. (Used only for rate-limit bucketing, not for auth.)
    xff = request.headers.get("X-Forwarded-For", "")
    return xff.split(",")[0].strip() if xff else (request.remote_addr or "?")


@app.before_request
def _rate_limit_market():
    path = request.path
    if not any(path.startswith(p) for p in _RL_PREFIXES):
        return None
    ip = _client_ip()
    now = _time.monotonic()
    with _rl_lock:
        dq = _rl_hits[ip]
        cutoff = now - _RL_WINDOW
        while dq and dq[0] < cutoff:
            dq.popleft()
        if len(dq) >= _RL_MAX:
            retry = max(1, int(_RL_WINDOW - (now - dq[0])))
            resp = jsonify({"data": {"error": "rate limit exceeded"},
                            "meta": {"source": "ratelimit", "stale": False}})
            resp.status_code = 429
            resp.headers["Retry-After"] = str(retry)
            return resp
        dq.append(now)
    return None

# Input validation: bound attacker-controlled values so they cannot be used to
# inflate the cache or hammer providers. Symbols are short alnum (+ . / -),
# timeframes come from a fixed whitelist, and the per-request symbol count is capped.
_SYMBOL_RE = re.compile(r"^[A-Z0-9.\-]{1,12}$")
_VALID_TF = {"1D", "1W", "1M", "3M", "1Y", "5Y"}
_MAX_SYMS = 60


def valid_symbol(sym: str) -> bool:
    return bool(_SYMBOL_RE.match(sym or ""))


_COIN_ID_RE = re.compile(r"^[a-z0-9-]{1,64}$")


def valid_coin_id(s: str) -> bool:
    return bool(_COIN_ID_RE.match(s or ""))


def envelope(data, source="internal", stale=False):
    return jsonify({"data": data, "meta": {
        "source": source,
        "stale": stale,
        "fetched_at": _dt.datetime.now(_dt.timezone.utc).isoformat(),
    }})


@app.route("/api/health")
def health():
    return envelope({"status": "ok"})


from services.quotes import get_quotes, get_market_status
from services.history import get_history
from services.fundamentals import get_fundamentals
from services.crypto import get_crypto, get_fng, get_crypto_search


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
    bars, source, stale = get_history(sym, tf)
    return envelope(bars, source=source, stale=stale)


@app.route("/api/fundamentals/<sym>")
def fundamentals_route(sym):
    sym = sym.upper()
    if not valid_symbol(sym):
        return envelope({"error": "invalid symbol"}), 400
    data, source, stale = get_fundamentals(sym)
    return envelope(data, source=source, stale=stale)


@app.route("/api/logos")
def logos_route():
    from services.logos import get_logos
    syms = [s.strip().upper() for s in request.args.get("syms", "").split(",") if s.strip()]
    syms = [s for s in syms if valid_symbol(s)][:_MAX_SYMS]
    return envelope(get_logos(syms), source="finnhub")


@app.route("/api/search")
def search_route():
    q = (request.args.get("q") or "").strip()
    if len(q) < 1 or len(q) > 40:
        return envelope([], source="finnhub")
    from services.search import search
    results, source = search(q)
    return envelope(results, source=source)


_CRYPTO_LIMITS = {25, 50, 100}


@app.route("/api/crypto")
def crypto_route():
    try:
        limit = int(request.args.get("limit", 50))
    except (TypeError, ValueError):
        limit = 50
    if limit not in _CRYPTO_LIMITS:
        limit = 50
    raw = request.args.get("watch", "")
    watch = [i.strip() for i in raw.split(",") if i.strip()]
    watch = [i for i in watch if valid_coin_id(i)][:50]
    data, source = get_crypto(limit=limit, extra_ids=watch)
    return envelope(data, source=source)


@app.route("/api/crypto/search")
def crypto_search_route():
    q = (request.args.get("q", "") or "").strip()
    if len(q) < 2:
        return envelope([], source="internal")
    data, source = get_crypto_search(q)
    return envelope(data, source=source)


@app.route("/api/fng")
def fng_route():
    data, source = get_fng()
    return envelope(data, source=source)


from services.news import get_news, watchlist_sentiment
from services.ratings import get_ratings
from services.earnings import get_earnings


@app.route("/api/news")
def news_route():
    sym = request.args.get("sym")
    if sym:
        sym = sym.upper()
        if not valid_symbol(sym):
            return envelope({"error": "invalid symbol"}), 400
    data, source = get_news(sym)  # sym None → market news
    return envelope(data, source=source)


@app.route("/api/sentiment")
def sentiment_route():
    raw = request.args.get("syms", "")
    syms = [s.strip().upper() for s in raw.split(",") if s.strip()]
    syms = [s for s in syms if valid_symbol(s)]
    result = watchlist_sentiment(syms)
    return envelope(result, source="finnhub")


@app.route("/api/earnings")
def earnings_route():
    raw = request.args.get("syms", "")
    syms = [s.strip().upper() for s in raw.split(",") if s.strip()]
    syms = [s for s in syms if valid_symbol(s)][:_MAX_SYMS]
    data, source = get_earnings(syms)
    return envelope(data, source=source)


@app.route("/api/ratings/<sym>")
def ratings_route(sym):
    sym = sym.upper()
    if not valid_symbol(sym):
        return envelope({"error": "invalid symbol"}), 400
    data, source = get_ratings(sym)
    return envelope(data, source=source)


from services import pulse as pulse_svc


@app.route("/api/pulse/<sym>")
def pulse_route(sym):
    sym = sym.upper()
    if not valid_symbol(sym):
        return envelope({"error": "invalid symbol"}), 400
    data = pulse_svc.compute_pulse(sym)
    return envelope(data, source="composite")


from services import signal_history as signal_history_svc


@app.route("/api/pulse/<sym>/history")
def pulse_history_route(sym):
    sym = sym.upper()
    if not valid_symbol(sym):
        return envelope({"error": "invalid symbol"}), 400
    data = signal_history_svc.get_signal_history(sym, days=90)
    return envelope(data, source="signal_history")


from services import signal_alerts as signal_alerts_svc


@app.route("/api/pulse/<sym>/signals")
def pulse_signals_route(sym):
    sym = sym.upper()
    if not valid_symbol(sym):
        return envelope({"error": "invalid symbol"}), 400
    data = signal_alerts_svc.evaluate_signal_alerts(sym)
    return envelope(data, source="signal_alerts")


# ─── Finnhub WS stream ingestion (opt-in via FINNHUB_STREAM_ENABLED) ─────────
# Importing services.stream is always safe — no side effects at import time.
# maybe_start() is a no-op when the env var is absent.
from services import stream as _stream
_stream.manager.maybe_start()


# ─── Stream delivery: status + SSE quote feed ─────────────────────────────────
# The SSE route is a gunicorn sync-worker "slow client": each connection holds
# a worker for SSE_MAX_TICKS × SSE_TICK_INTERVAL seconds (defaults: 30 × 2s =
# 60s).  Keep SSE_MAX_TICKS small and let clients reconnect.  This must remain
# behind FINNHUB_STREAM_ENABLED so the default production path (60s REST poll)
# is unchanged.

@app.route("/api/stream/status")
def stream_status():
    """Return whether the SSE stream endpoint is enabled on this deployment."""
    enabled = bool(os.environ.get("FINNHUB_STREAM_ENABLED"))
    return jsonify({"enabled": enabled})


@app.route("/api/stream/quotes")
def stream_quotes_route():
    """SSE endpoint: emit current cached quotes for the requested symbols.

    Guarded by FINNHUB_STREAM_ENABLED; returns 404 JSON when disabled so the
    frontend falls back cleanly to the existing 60s REST poll.

    Query params:
        symbols  – comma-separated symbol list (same validation as /api/quotes)

    Events:
        data: {quotes: {...}, source: "finnhub_ws"|"finnhub"|...}
        After SSE_MAX_TICKS events, sends ``event: close`` so the client
        reconnects; this bounds worker occupancy.
    """
    if not os.environ.get("FINNHUB_STREAM_ENABLED"):
        return jsonify({"error": "streaming disabled"}), 404

    raw = request.args.get("symbols", "")
    syms = [s.strip().upper() for s in raw.split(",") if s.strip()]
    syms = [s for s in syms if valid_symbol(s)][:_MAX_SYMS]
    if not syms:
        return jsonify({"error": "no valid symbols"}), 400

    # Update the WS subscription so the ingestion thread tracks these symbols.
    _stream.manager.update_symbols(syms)

    max_ticks = int(os.environ.get("SSE_MAX_TICKS", "30"))
    tick_interval = float(os.environ.get("SSE_TICK_INTERVAL", "2.0"))

    def generate():
        from services.quotes import get_quotes
        for _ in range(max_ticks):
            quotes, source = get_quotes(syms)
            payload = _json.dumps({"quotes": quotes, "source": source})
            yield f"data: {payload}\n\n"
            _time.sleep(tick_interval)
        yield "event: close\ndata: reconnect\n\n"

    return Response(
        stream_with_context(generate()),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # disable nginx/Railway buffering
        },
    )


# ─── Persistence (Postgres/SQLite via DATABASE_URL) ──────────────────────────
import db as _db
_db.init_db()

from services.store import (get_watchlist, add_watch, update_watch, remove_watch,
                            get_settings, update_settings,
                            get_holdings, set_holding, remove_holding)
from services.share import create_share, resolve_share
from services.screens import list_screens, save_screen, delete_screen
from services import digest as _digest
from services import watchlists as _wls
from services import billing as _billing


@app.route("/api/watchlist", methods=["GET"])
def watchlist_get():
    if _require_user() is None:
        return envelope({"error": "authentication required"}), 401
    return envelope(get_watchlist(), source="db")


@app.route("/api/watchlist", methods=["POST"])
def watchlist_post():
    uid = _require_user()
    if uid is None:
        return envelope({"error": "authentication required"}), 401
    b = request.get_json(force=True) or {}
    kind = b.get("kind", "stock")
    if kind == "crypto":
        sym = (b.get("symbol") or "").strip().lower()
        if not valid_coin_id(sym):
            return envelope({"error": "invalid coin id"}), 400
    else:
        sym = (b.get("symbol") or "").upper()
        if not valid_symbol(sym):
            return envelope({"error": "invalid symbol"}), 400
    # Free-plan watchlist limit applies to both stocks and crypto coins.
    err = _billing.check_watchlist_add(uid, sym)
    if err:
        return jsonify(err), 402
    try:
        item = add_watch(sym, target=float(b.get("target", 0) or 0),
                         alert_price=float(b.get("alert_price", 0) or 0),
                         alert_dir=b.get("alert_dir", "above"),
                         kind=kind, coin_name=(b.get("coin_name") or "")[:64])
    except _wls.FreeLimit:
        return envelope({"error": "free_limit"}), 402
    return envelope(item, source="db")


@app.route("/api/watchlist/<sym>", methods=["PATCH"])
def watchlist_patch(sym):
    uid = _require_user()
    if uid is None:
        return envelope({"error": "authentication required"}), 401
    b = request.get_json(force=True) or {}
    # Explicit allowlist of client-patchable fields (avoid mass-assignment).
    allowed = {"target", "alert_price", "alert_dir", "alert_active"}
    fields = {k: v for k, v in b.items() if k in allowed}
    if fields.get("alert_active") is True:
        err = _billing.check_alert_activate(uid, sym.upper())
        if err:
            return jsonify(err), 402
    item = update_watch(sym, **fields)
    if item is None:
        return envelope({"error": "not found"}, source="db"), 404
    return envelope(item, source="db")


@app.route("/api/watchlist/<sym>", methods=["DELETE"])
def watchlist_delete(sym):
    if _require_user() is None:
        return envelope({"error": "authentication required"}), 401
    return envelope({"removed": remove_watch(sym)}, source="db")


# ─── Multi-watchlist routes ───────────────────────────────────────────────────

@app.route("/api/watchlists", methods=["GET"])
def watchlists_get():
    uid = _require_user()
    if uid is None:
        return envelope({"error": "authentication required"}), 401
    return envelope(_wls.list_watchlists(uid), source="db")


@app.route("/api/watchlists", methods=["POST"])
def watchlists_post():
    uid = _require_user()
    if uid is None:
        return envelope({"error": "authentication required"}), 401
    b = request.get_json(force=True) or {}
    name = (b.get("name") or "").strip() or "Untitled"
    try:
        return envelope(_wls.create_watchlist(uid, name), source="db")
    except _wls.PremiumRequired:
        return envelope({"error": "premium_required"}), 402


@app.route("/api/watchlists/<int:list_id>", methods=["PATCH"])
def watchlists_patch(list_id):
    uid = _require_user()
    if uid is None:
        return envelope({"error": "authentication required"}), 401
    b = request.get_json(force=True) or {}
    res = _wls.rename_or_move_list(uid, list_id, name=b.get("name"), position=b.get("position"))
    if res is None:
        return envelope({"error": "not found"}), 404
    return envelope(res, source="db")


@app.route("/api/watchlists/<int:list_id>", methods=["DELETE"])
def watchlists_delete(list_id):
    uid = _require_user()
    if uid is None:
        return envelope({"error": "authentication required"}), 401
    try:
        return envelope({"deleted": _wls.delete_watchlist(uid, list_id)}, source="db")
    except _wls.LastList:
        return envelope({"error": "last_list"}), 409


@app.route("/api/watchlists/<int:list_id>/items", methods=["POST"])
def watchlist_item_post(list_id):
    uid = _require_user()
    if uid is None:
        return envelope({"error": "authentication required"}), 401
    b = request.get_json(force=True) or {}
    sym = (b.get("symbol") or "").upper()
    if not valid_symbol(sym):
        return envelope({"error": "invalid symbol"}), 400
    try:
        item = _wls.add_item(uid, list_id, sym,
                             target=float(b.get("target", 0) or 0),
                             alert_price=float(b.get("alert_price", 0) or 0),
                             alert_dir=b.get("alert_dir", "above"))
        return envelope(item, source="db")
    except _wls.FreeLimit:
        return envelope({"error": "free_limit"}), 402
    except ValueError:
        return envelope({"error": "not found"}), 404


@app.route("/api/watchlists/<int:list_id>/items/<sym>", methods=["PATCH"])
def watchlist_item_patch(list_id, sym):
    uid = _require_user()
    if uid is None:
        return envelope({"error": "authentication required"}), 401
    b = request.get_json(force=True) or {}
    allowed = {"target", "alert_price", "alert_dir", "alert_active", "position", "watchlist_id"}
    fields = {k: v for k, v in b.items() if k in allowed}
    try:
        item = _wls.update_item(uid, list_id, sym.upper(), **fields)
    except ValueError:
        return envelope({"error": "not found"}), 404
    if item is None:
        return envelope({"error": "not found"}), 404
    return envelope(item, source="db")


@app.route("/api/watchlists/<int:list_id>/items/<sym>", methods=["DELETE"])
def watchlist_item_delete(list_id, sym):
    uid = _require_user()
    if uid is None:
        return envelope({"error": "authentication required"}), 401
    return envelope({"removed": _wls.remove_item(uid, list_id, sym.upper())}, source="db")


@app.route("/api/watchlists/<int:list_id>/share", methods=["POST"])
def watchlist_list_share(list_id):
    uid = _require_user()
    if uid is None:
        return envelope({"error": "authentication required"}), 401
    return envelope({"token": create_share(uid, list_id)}, source="db")


@app.route("/api/settings", methods=["GET"])
def settings_get():
    if _require_user() is None:
        return envelope({"error": "authentication required"}), 401
    return envelope(get_settings(), source="db")


@app.route("/api/settings", methods=["PATCH"])
def settings_patch():
    uid = _require_user()
    if uid is None:
        return envelope({"error": "authentication required"}), 401
    b = request.get_json(force=True) or {}
    # Explicit allowlist of client-patchable settings (avoid mass-assignment).
    # broker_connected/broker_name are intentionally included while the brokerage
    # link is a self-scoped DEMO toggle; when a real broker OAuth flow exists,
    # move those two to server-only control.
    allowed = {"live_updates", "alert_notifs", "news_digest", "hide_balances",
               "currency", "broker_connected", "broker_name"}
    fields = {k: v for k, v in b.items() if k in allowed}
    if fields.get("news_digest") is True:
        err = _billing.check_digest_enable(uid)
        if err:
            return jsonify(err), 402
    return envelope(update_settings(**fields), source="db")


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


# ─── Transaction ledger + Portfolio P&L engine ───────────────────────────────
# These routes are the richer path for recording positions (average-cost method,
# realized P&L, fee tracking). The legacy POST /api/holdings setter remains for
# quick manual overrides; transactions are the authoritative source.

from services.portfolio import record_transaction, list_transactions, compute_pnl as _compute_pnl


@app.route("/api/transactions", methods=["GET"])
def transactions_get():
    uid = _require_user()
    if uid is None:
        return envelope({"error": "authentication required"}), 401
    sym = request.args.get("symbol", "").upper() or None
    if sym and not valid_symbol(sym):
        return envelope({"error": "invalid symbol"}), 400
    return envelope(list_transactions(uid, symbol=sym), source="db")


@app.route("/api/transactions", methods=["POST"])
def transactions_post():
    uid = _require_user()
    if uid is None:
        return envelope({"error": "authentication required"}), 401
    b = request.get_json(force=True) or {}
    sym = (b.get("symbol") or "").upper()
    if not valid_symbol(sym):
        return envelope({"error": "invalid symbol"}), 400
    kind = (b.get("kind") or "").lower()
    if kind not in ("buy", "sell"):
        return envelope({"error": "kind must be 'buy' or 'sell'"}), 400
    try:
        qty = float(b.get("quantity") or b.get("qty") or 0)
        price = float(b.get("price") or 0)
        fees = float(b.get("fees") or 0)
    except (TypeError, ValueError):
        return envelope({"error": "quantity, price, fees must be numeric"}), 400
    if qty <= 0 or price <= 0:
        return envelope({"error": "quantity and price must be positive"}), 400
    # Parse optional executed_at (ISO 8601)
    executed_at = None
    if b.get("executed_at"):
        try:
            executed_at = _dt.datetime.fromisoformat(str(b["executed_at"]).replace("Z", "+00:00"))
        except ValueError:
            return envelope({"error": "executed_at must be ISO 8601"}), 400
    note = str(b.get("note") or "")[:500] or None  # sanitize + cap length
    try:
        result = record_transaction(uid, sym, kind, qty, price, fees, executed_at, note)
    except ValueError as e:
        return envelope({"error": str(e)}), 400
    return envelope(result, source="db"), 201


@app.route("/api/portfolio/pnl", methods=["GET"])
def portfolio_pnl_get():
    uid = _require_user()
    if uid is None:
        return envelope({"error": "authentication required"}), 401
    # quote_fn: pull from the cached quote layer (respects 60s TTL).
    # Import here to avoid circular-import concerns with the module-level imports.
    from services.quotes import get_quotes as _gq

    def _quote_fn(sym):
        quotes, _ = _gq([sym])
        return quotes.get(sym, {})

    result = _compute_pnl(uid, _quote_fn)
    return envelope(result, source="finnhub")


@app.route("/api/portfolio/dividends", methods=["GET"])
def portfolio_dividends_get():
    """GET /api/portfolio/dividends — dividend rows + annual income estimate.

    Auth required. Returns:
        {rows: [{symbol, ex_date, pay_date, per_share, shares, total, status}],
         annual_income_estimate: <float>}

    ``status`` is "upcoming" when ex_date >= today, else "paid".
    Rows are sorted ascending by ex_date. Returns empty rows when the user
    has no holdings or no dividend data is available.
    """
    uid = _require_user()
    if uid is None:
        return envelope({"error": "authentication required"}), 401
    from services.dividends import upcoming_dividends
    result = upcoming_dividends(uid)
    return envelope(result, source="yahoo")


_BENCHMARK_VALID_TF = {"1M", "3M", "1Y", "5Y"}
_BENCHMARK_VALID_INDEX = {"SPY", "QQQ"}


@app.route("/api/portfolio/benchmark", methods=["GET"])
def portfolio_benchmark_get():
    """GET /api/portfolio/benchmark?tf=1Y&index=SPY — normalized %-growth overlay.

    Auth required. Query params (all optional, defaults shown):
        tf    – timeframe: 1M | 3M | 1Y | 5Y  (default: 1Y)
        index – benchmark ETF: SPY | QQQ       (default: SPY)

    Returns:
        {dates: [...], portfolio_pct: [...], benchmark_pct: [...],
         index: "SPY", disclaimer: "..."}

    HONESTY: this is a current-holdings backtest (today's positions applied
    retroactively). The disclaimer field and UI label make this explicit.
    """
    uid = _require_user()
    if uid is None:
        return envelope({"error": "authentication required"}), 401

    tf = request.args.get("tf", "1Y").upper()
    index = request.args.get("index", "SPY").upper()

    if tf not in _BENCHMARK_VALID_TF:
        return envelope({"error": f"tf must be one of {sorted(_BENCHMARK_VALID_TF)}"}), 400
    if index not in _BENCHMARK_VALID_INDEX:
        return envelope({"error": f"index must be one of {sorted(_BENCHMARK_VALID_INDEX)}"}), 400

    from services.benchmark import portfolio_vs_benchmark
    result = portfolio_vs_benchmark(uid, tf, index)
    return envelope(result, source="yahoo")


# ─── Saved screener filters ──────────────────────────────────────────────────

@app.route("/api/screens", methods=["GET"])
def screens_get():
    uid = _require_user()
    if uid is None:
        return envelope({"error": "authentication required"}), 401
    return envelope(list_screens(uid), source="db")


@app.route("/api/screens", methods=["POST"])
def screens_post():
    uid = _require_user()
    if uid is None:
        return envelope({"error": "authentication required"}), 401
    b = request.get_json(force=True) or {}
    # Explicit allowlist — only name + filters accepted.
    name = b.get("name") or ""
    filters = b.get("filters") or {}
    if not name:
        return envelope({"error": "name is required"}), 400
    if not isinstance(filters, dict):
        return envelope({"error": "filters must be an object"}), 400
    err = _billing.check_screen_add(uid)
    if err:
        return jsonify(err), 402
    return envelope(save_screen(uid, name, filters), source="db")


@app.route("/api/screens/<int:screen_id>", methods=["DELETE"])
def screens_delete(screen_id):
    uid = _require_user()
    if uid is None:
        return envelope({"error": "authentication required"}), 401
    return envelope({"deleted": delete_screen(uid, screen_id)}, source="db")


# ─── One-click unsubscribe (unauthenticated; token is unguessable) ───────────

@app.route("/api/unsubscribe/<token>")
def unsubscribe_route(token):
    ok = _digest.unsubscribe(token)
    if ok:
        body = (
            "<!doctype html><html><head><meta charset=utf-8>"
            "<title>Unsubscribed</title></head><body style='font-family:sans-serif;padding:2rem'>"
            "<h2>You've been unsubscribed from Ticker Tracker emails.</h2>"
            "<p>You won't receive weekly digest emails anymore. "
            "You can re-enable them any time in your account settings.</p>"
            "</body></html>"
        )
    else:
        body = (
            "<!doctype html><html><head><meta charset=utf-8>"
            "<title>Invalid link</title></head><body style='font-family:sans-serif;padding:2rem'>"
            "<h2>This unsubscribe link is invalid.</h2>"
            "<p>The link may have expired or already been used. "
            "Contact support if you need help.</p>"
            "</body></html>"
        )
    from flask import make_response
    resp = make_response(body, 200)
    resp.content_type = "text/html; charset=utf-8"
    return resp


# ─── Shareable watchlist links ────────────────────────────────────────────────

@app.route("/api/watchlist/share", methods=["POST"])
def watchlist_share_create():
    uid = _require_user()
    if uid is None:
        return envelope({"error": "authentication required"}), 401
    token = create_share(uid)
    return envelope({"token": token}, source="db")


@app.route("/api/shared/<token>")
def shared_watchlist(token):
    result = resolve_share(token)
    if result is None:
        return envelope({"error": "not found"}), 404
    return envelope(result, source="db")


# ─── Billing (Stripe subscriptions) ──────────────────────────────────────────

@app.route("/api/billing", methods=["GET"])
def billing_get():
    uid = _require_user()
    if uid is None:
        return envelope({"error": "authentication required"}), 401
    return envelope(_billing.get_billing_state(uid), source="db")


@app.route("/api/billing/checkout", methods=["POST"])
def billing_checkout():
    uid = _require_user()
    if uid is None:
        return envelope({"error": "authentication required"}), 401
    b = request.get_json(force=True) or {}
    interval = "annual" if b.get("interval") == "annual" else "monthly"
    try:
        url = _billing.create_checkout_session(uid, interval)
    except _billing.BillingNotConfigured as e:
        return envelope({"error": "billing unavailable", "detail": str(e)}), 503
    return envelope({"url": url}, source="stripe")


@app.route("/api/billing/portal", methods=["POST"])
def billing_portal():
    uid = _require_user()
    if uid is None:
        return envelope({"error": "authentication required"}), 401
    try:
        url = _billing.create_portal_session(uid)
    except _billing.BillingNotConfigured as e:
        return envelope({"error": "billing unavailable", "detail": str(e)}), 503
    return envelope({"url": url}, source="stripe")


@app.route("/api/stripe/webhook", methods=["POST"])
def stripe_webhook():
    import stripe
    payload = request.get_data()
    sig = request.headers.get("Stripe-Signature", "")
    secret = os.environ.get("STRIPE_WEBHOOK_SECRET", "")
    try:
        event = stripe.Webhook.construct_event(payload, sig, secret)
    except Exception:
        return jsonify({"error": "invalid signature"}), 400
    _billing.handle_webhook_event(event)
    return jsonify({"received": True}), 200


# ─── Web Push ────────────────────────────────────────────────────────────────
# VAPID public key exposure + subscription upsert / removal.
# Delivery is handled inside check_alerts via providers.webpush.

@app.route("/api/push/vapid-public-key", methods=["GET"])
def push_vapid_key():
    key = os.environ.get("VAPID_PUBLIC_KEY") or None
    return jsonify({"key": key})


@app.route("/api/push/subscribe", methods=["POST"])
def push_subscribe():
    uid = _require_user()
    if uid is None:
        return envelope({"error": "authentication required"}), 401
    b = request.get_json(force=True) or {}
    endpoint = (b.get("endpoint") or "").strip()
    keys = b.get("keys") or {}
    p256dh = (keys.get("p256dh") or "").strip()
    auth_key = (keys.get("auth") or "").strip()
    if not endpoint or not p256dh or not auth_key:
        return envelope({"error": "endpoint, keys.p256dh, and keys.auth are required"}), 400
    import db as _db_mod, models as _models
    with _db_mod.get_session() as s:
        existing = s.query(_models.PushSubscription).filter_by(endpoint=endpoint).first()
        if existing:
            existing.user_id = uid
            existing.p256dh = p256dh
            existing.auth = auth_key
        else:
            s.add(_models.PushSubscription(
                user_id=uid, endpoint=endpoint, p256dh=p256dh, auth=auth_key,
            ))
        s.commit()
    return envelope({"subscribed": True}, source="db")


@app.route("/api/push/unsubscribe", methods=["POST"])
def push_unsubscribe():
    uid = _require_user()
    if uid is None:
        return envelope({"error": "authentication required"}), 401
    b = request.get_json(force=True) or {}
    endpoint = (b.get("endpoint") or "").strip()
    if not endpoint:
        return envelope({"error": "endpoint is required"}), 400
    import db as _db_mod, models as _models
    with _db_mod.get_session() as s:
        s.query(_models.PushSubscription).filter_by(
            user_id=uid, endpoint=endpoint
        ).delete()
        s.commit()
    return envelope({"unsubscribed": True}, source="db")


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
