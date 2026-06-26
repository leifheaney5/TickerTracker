import responses
import services.crypto as c
import cache


@responses.activate
def test_fng_real():
    cache.clear()
    responses.add(responses.GET, "https://api.alternative.me/fng/",
                  json={"data": [{"value": "72", "value_classification": "Greed"}]}, status=200)
    data, source = c.get_fng()
    assert data["value"] == 72 and data["label"] == "Greed" and source == "alternative.me"


@responses.activate
def test_fng_fallback():
    cache.clear()
    responses.add(responses.GET, "https://api.alternative.me/fng/", status=500)
    data, source = c.get_fng()
    assert 0 <= data["value"] <= 100 and source == "mock"


def test_crypto_fallback(monkeypatch):
    cache.clear()
    monkeypatch.setattr(c, "fetch_crypto", lambda: (_ for _ in ()).throw(RuntimeError("down")))
    data, source = c.get_crypto()
    assert data["coins"] and source == "mock"
