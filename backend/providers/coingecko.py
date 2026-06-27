import requests

_BASE = "https://api.coingecko.com/api/v3"


def _coin(x):
    return {
        "id": x["id"],
        "symbol": x["symbol"].upper(),
        "name": x["name"],
        "price": x.get("current_price") or 0,
        "change_pct": round(x.get("price_change_percentage_24h") or 0, 2),
        "market_cap": x.get("market_cap") or 0,
    }


def fetch_crypto(limit: int = 50, extra_ids=()) -> dict:
    params = {"vs_currency": "usd", "order": "market_cap_desc",
              "per_page": limit, "page": 1}
    # Union any watchlisted coins outside the top-N into the same request.
    extra = [i for i in extra_ids if i]
    if extra:
        params["ids"] = ",".join(sorted(set(extra)))
        # When ids is set CoinGecko ignores per_page paging semantics; ask for
        # both by widening per_page so the top-N still come back.
        params["per_page"] = max(limit, len(extra) + limit)
    r = requests.get(f"{_BASE}/coins/markets", params=params, timeout=10)
    r.raise_for_status()
    rows = r.json()
    coins = [_coin(x) for x in rows]
    total = sum(c["market_cap"] for c in coins) or 1
    btc = next((c for c in coins if c["symbol"] == "BTC"), None)
    return {"coins": coins, "total_market_cap": total,
            "btc_dominance": round((btc["market_cap"] / total * 100) if btc else 0, 1)}


def search_coins(query: str) -> list:
    r = requests.get(f"{_BASE}/search", params={"query": query}, timeout=10)
    r.raise_for_status()
    coins = r.json().get("coins", [])[:10]
    return [{"id": c["id"], "symbol": (c.get("symbol") or "").upper(),
             "name": c.get("name", "")} for c in coins]


def fetch_prices(ids) -> dict:
    ids = [i for i in ids if i]
    if not ids:
        return {}
    r = requests.get(f"{_BASE}/coins/markets",
                     params={"vs_currency": "usd", "ids": ",".join(ids),
                             "per_page": len(ids), "page": 1},
                     timeout=10)
    r.raise_for_status()
    return {x["id"]: {"price": x.get("current_price") or 0,
                      "change_pct": round(x.get("price_change_percentage_24h") or 0, 2)}
            for x in r.json()}
