from mock import (fnv1a, rng, mock_quote, mock_fundamentals, mock_history,
                  mock_crypto, mock_fng)


def test_fnv1a_matches_known_value():
    # FNV-1a 32-bit of "AAPL"
    assert fnv1a("AAPL") == 1489842955


def test_rng_is_deterministic():
    a = rng(123); b = rng(123)
    seq_a = [a() for _ in range(3)]
    seq_b = [b() for _ in range(3)]
    assert seq_a == seq_b
    assert all(0.0 <= x < 1.0 for x in seq_a)


def test_mock_quote_deterministic_and_shaped():
    q1 = mock_quote("AAPL"); q2 = mock_quote("AAPL")
    assert q1 == q2
    for k in ("price", "change_pct", "day_open", "day_high", "day_low", "volume"):
        assert k in q1
    assert q1["price"] > 0


def test_mock_fundamentals_keys():
    f = mock_fundamentals("AAPL")
    for k in ("pe", "market_cap", "sector", "industry", "week52_high",
              "week52_low", "all_time_high", "all_time_low", "beta",
              "dividend_yield", "eps"):
        assert k in f
    assert f["week52_high"] >= f["week52_low"]


def test_mock_history_length_by_tf():
    assert len(mock_history("AAPL", "1M")) == 22
    assert len(mock_history("AAPL", "3M")) == 66
    bars = mock_history("AAPL", "1M")
    assert all(b["h"] >= b["l"] for b in bars)


def test_mock_crypto_and_fng():
    c = mock_crypto()
    assert c["coins"] and "btc_dominance" in c
    f = mock_fng()
    assert 0 <= f["value"] <= 100 and f["label"]
