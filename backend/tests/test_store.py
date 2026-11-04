import pytest
import services.store as store


pytestmark = pytest.mark.usefixtures("seed_user")


def test_add_and_get_watchlist():
    store.add_watch("AAPL", buy_target=185, sell_target=230)
    store.add_watch("MSFT")
    wl = store.get_watchlist()
    assert [w["symbol"] for w in wl] == ["AAPL", "MSFT"]
    assert wl[0]["buy_target"] == 185
    assert wl[0]["sell_target"] == 230
    assert wl[0]["target"] == 230
    assert wl[0]["position"] == 0 and wl[1]["position"] == 1


def test_add_watch_upsert():
    store.add_watch("AAPL", target=230)
    store.add_watch("AAPL", target=999, sell_target=240, buy_target=180)
    wl = store.get_watchlist()
    assert len(wl) == 1
    assert wl[0]["buy_target"] == 180
    assert wl[0]["sell_target"] == 240
    assert wl[0]["target"] == 240


def test_update_watch_can_clear_each_target_with_zero():
    store.add_watch("AAPL", buy_target=185, sell_target=230)
    updated = store.update_watch("AAPL", buy_target=0, sell_target=0)
    assert updated["buy_target"] == 0
    assert updated["sell_target"] == 0
    assert updated["target"] == 0


def test_update_and_remove_watch():
    store.add_watch("AAPL")
    store.update_watch("AAPL", alert_price=300, alert_dir="below")
    assert store.get_watchlist()[0]["alert_price"] == 300
    assert store.remove_watch("AAPL") is True
    assert store.get_watchlist() == []


def test_settings_roundtrip():
    s = store.get_settings()
    assert s["live_updates"] is True
    store.update_settings(hide_balances=True, broker_name="Demo")
    s2 = store.get_settings()
    assert s2["hide_balances"] is True and s2["broker_name"] == "Demo"


def test_holdings_roundtrip():
    store.set_holding("AAPL", 10, 180)
    store.set_holding("AAPL", 12, 185)  # upsert
    h = store.get_holdings()
    assert len(h) == 1 and h[0]["shares"] == 12
    assert store.remove_holding("AAPL") is True
