import requests


def fetch_fng() -> dict:
    r = requests.get("https://api.alternative.me/fng/", params={"limit": 1}, timeout=8)
    r.raise_for_status()
    d = r.json()["data"][0]
    return {"value": int(d["value"]), "label": d["value_classification"]}
