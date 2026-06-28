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
    # Request 1: top-N by market cap (CoinGecko treats `ids` as a FILTER, so it
    # must NOT be set here or the top-N would be dropped).
    r = requests.get(f"{_BASE}/coins/markets",
                     params={"vs_currency": "usd", "order": "market_cap_desc",
                             "per_page": limit, "page": 1},
                     timeout=10)
    r.raise_for_status()
    coins = [_coin(x) for x in r.json()]

    # Request 2 (only if needed): watchlisted coins that fell outside the top-N.
    present = {c["id"] for c in coins}
    missing = sorted({i for i in extra_ids if i} - present)
    if missing:
        r2 = requests.get(f"{_BASE}/coins/markets",
                          params={"vs_currency": "usd", "ids": ",".join(missing),
                                  "per_page": len(missing), "page": 1},
                          timeout=10)
        r2.raise_for_status()
        for x in r2.json():
            c = _coin(x)
            if c["id"] not in present:  # request-1 coins win on dedupe
                present.add(c["id"])
                coins.append(c)

    total = sum(c["market_cap"] for c in coins)
    btc = next((c for c in coins if c["symbol"] == "BTC"), None)
    return {"coins": coins, "total_market_cap": total,
            "btc_dominance": round((btc["market_cap"] / (total or 1) * 100) if btc else 0, 1)}


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
