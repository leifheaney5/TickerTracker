"""
TDD: Smart/divergence signal alerts (F4).

The moat logic is a PURE detector that, given a symbol's current signal context, returns the set
of named, explainable conditions that are active. Each condition states WHICH signals fired and
why — honest by construction (no opaque "buy/sell"). These tests pin the detection rules.
"""
import services.signal_alerts as sa


def _ctx(**kw):
    base = dict(rsi=None, sentiment="Neutral", price=None, target_mean=None,
                band="Neutral", prev_band=None, recent_return_pct=None)
    base.update(kw)
    return base


def _keys(conds):
    return {c["key"] for c in conds}


def test_near_analyst_target():
    conds = sa.detect_signal_conditions(_ctx(price=98.0, target_mean=100.0))
    assert "near_target" in _keys(conds)
    near = next(c for c in conds if c["key"] == "near_target")
    assert "target" in near["detail"].lower()


def test_far_from_target_does_not_fire():
    conds = sa.detect_signal_conditions(_ctx(price=70.0, target_mean=100.0))
    assert "near_target" not in _keys(conds)


def test_overbought_plus_bearish():
    conds = sa.detect_signal_conditions(_ctx(rsi=78, sentiment="Bearish"))
    assert "overbought_bearish" in _keys(conds)


def test_overbought_without_bearish_does_not_fire():
    assert "overbought_bearish" not in _keys(sa.detect_signal_conditions(_ctx(rsi=78, sentiment="Bullish")))


def test_oversold_plus_bullish():
    conds = sa.detect_signal_conditions(_ctx(rsi=22, sentiment="Bullish"))
    assert "oversold_bullish" in _keys(conds)


def test_pulse_band_heating_up():
    conds = sa.detect_signal_conditions(_ctx(band="Hot", prev_band="Building"))
    assert "pulse_band_up" in _keys(conds)
    c = next(c for c in conds if c["key"] == "pulse_band_up")
    assert "Building" in c["detail"] and "Hot" in c["detail"]


def test_pulse_band_cooling_down():
    assert "pulse_band_down" in _keys(sa.detect_signal_conditions(_ctx(band="Neutral", prev_band="Building")))


def test_same_band_no_change_event():
    conds = sa.detect_signal_conditions(_ctx(band="Hot", prev_band="Hot"))
    assert not (_keys(conds) & {"pulse_band_up", "pulse_band_down"})


def test_price_up_sentiment_bearish_divergence():
    conds = sa.detect_signal_conditions(_ctx(recent_return_pct=8.0, sentiment="Bearish"))
    assert "price_sentiment_divergence" in _keys(conds)


def test_no_conditions_returns_empty():
    assert sa.detect_signal_conditions(_ctx()) == []


def test_conditions_are_explainable():
    conds = sa.detect_signal_conditions(_ctx(rsi=80, sentiment="Bearish", price=99, target_mean=100))
    assert len(conds) >= 2
    for c in conds:
        assert c["key"] and c["title"] and c["detail"]
