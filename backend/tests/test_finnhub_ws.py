"""Unit tests for providers.finnhub_ws — pure parse_trade_message logic only.

These tests cover every branch without a real WebSocket connection or
websocket-client installed. Import is deliberately narrow.
"""
import pytest
from providers.finnhub_ws import parse_trade_message


# ── happy path ────────────────────────────────────────────────────────────────

def test_parses_single_trade():
    raw = '{"type":"trade","data":[{"s":"AAPL","p":182.5,"t":1700000000000,"v":200}]}'
    result = parse_trade_message(raw)
    assert len(result) == 1
    assert result[0]["symbol"] == "AAPL"
    assert result[0]["price"] == 182.5
    assert result[0]["ts"] == 1700000000000
    assert result[0]["volume"] == 200.0


def test_parses_multiple_trades():
    raw = (
        '{"type":"trade","data":['
        '{"s":"AAPL","p":182.5,"t":1000,"v":100},'
        '{"s":"MSFT","p":410.0,"t":2000,"v":50}'
        ']}'
    )
    result = parse_trade_message(raw)
    assert len(result) == 2
    syms = {r["symbol"] for r in result}
    assert syms == {"AAPL", "MSFT"}


def test_volume_defaults_to_zero_when_absent():
    raw = '{"type":"trade","data":[{"s":"NVDA","p":900.0,"t":1000}]}'
    result = parse_trade_message(raw)
    assert result[0]["volume"] == 0.0


def test_ts_defaults_to_zero_when_absent():
    raw = '{"type":"trade","data":[{"s":"NVDA","p":900.0}]}'
    result = parse_trade_message(raw)
    assert result[0]["ts"] == 0


# ── non-trade message types → [] ─────────────────────────────────────────────

def test_ping_returns_empty():
    assert parse_trade_message('{"type":"ping"}') == []


def test_subscription_ack_returns_empty():
    assert parse_trade_message('{"type":"subscribe","symbol":"AAPL"}') == []


def test_unknown_type_returns_empty():
    assert parse_trade_message('{"type":"news","data":[]}') == []


# ── malformed input → [] ──────────────────────────────────────────────────────

def test_malformed_json_returns_empty():
    assert parse_trade_message("{not valid json") == []


def test_empty_string_returns_empty():
    assert parse_trade_message("") == []


def test_non_string_input_returns_empty():
    assert parse_trade_message(None) == []  # type: ignore[arg-type]


def test_array_json_returns_empty():
    assert parse_trade_message('[1,2,3]') == []


# ── items missing required fields ────────────────────────────────────────────

def test_item_missing_symbol_skipped():
    raw = '{"type":"trade","data":[{"p":100.0,"t":1000}]}'
    assert parse_trade_message(raw) == []


def test_item_missing_price_skipped():
    raw = '{"type":"trade","data":[{"s":"AAPL","t":1000}]}'
    assert parse_trade_message(raw) == []


def test_item_with_bad_price_type_skipped():
    raw = '{"type":"trade","data":[{"s":"AAPL","p":"not-a-number","t":1000}]}'
    assert parse_trade_message(raw) == []


def test_mixed_valid_invalid_items():
    """Only the valid item should be returned; malformed items are skipped."""
    raw = (
        '{"type":"trade","data":['
        '{"p":100.0},'              # missing s → skip
        '{"s":"TSLA","p":250.0,"t":5000,"v":30}'  # valid
        ']}'
    )
    result = parse_trade_message(raw)
    assert len(result) == 1
    assert result[0]["symbol"] == "TSLA"


def test_data_not_list_returns_empty():
    raw = '{"type":"trade","data":{"s":"AAPL","p":100}}'
    assert parse_trade_message(raw) == []


def test_non_dict_item_in_data_skipped():
    raw = '{"type":"trade","data":["not-a-dict",{"s":"AAPL","p":100,"t":1}]}'
    result = parse_trade_message(raw)
    assert len(result) == 1
    assert result[0]["symbol"] == "AAPL"
