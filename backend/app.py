import re
from flask import Flask, jsonify, request

app = Flask(__name__)

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


if __name__ == "__main__":
    import os
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)), debug=False)
