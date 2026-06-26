import requests

_IDS = "bitcoin,ethereum,solana,ripple,binancecoin,dogecoin,cardano"


def fetch_crypto() -> dict:
    r = requests.get(
        "https://api.coingecko.com/api/v3/coins/markets",
        params={"vs_currency": "usd", "ids": _IDS, "order": "market_cap_desc"},
        timeout=10,
    )
    r.raise_for_status()
    rows = r.json()
    coins = [{
        "symbol": x["symbol"].upper(), "name": x["name"],
        "price": x["current_price"],
        "change_pct": round(x.get("price_change_percentage_24h") or 0, 2),
        "market_cap": x.get("market_cap") or 0,
    } for x in rows]
    total = sum(c["market_cap"] for c in coins) or 1
    btc = next((c for c in coins if c["symbol"] == "BTC"), None)
    return {"coins": coins, "total_market_cap": total,
            "btc_dominance": round((btc["market_cap"] / total * 100) if btc else 0, 1)}
