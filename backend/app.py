from flask import Flask, jsonify, request

app = Flask(__name__)


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
    quotes, source = get_quotes(syms)
    return envelope({"quotes": quotes, "market_status": get_market_status()}, source=source)


@app.route("/api/history/<sym>")
def history_route(sym):
    tf = request.args.get("tf", "3M")
    bars, source = get_history(sym.upper(), tf)
    return envelope(bars, source=source)


@app.route("/api/fundamentals/<sym>")
def fundamentals_route(sym):
    data, source = get_fundamentals(sym.upper())
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
