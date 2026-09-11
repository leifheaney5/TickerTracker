"""Finnhub WebSocket client — streams live trade data for a set of symbols.

Import-guarded: if websocket-client is not installed, the module is available
but all WS operations are no-ops. The stream manager (services/stream.py)
checks ``websocket is not None`` before starting.

Finnhub WS wire format for trade messages:
  {"type": "trade", "data": [{"s": "AAPL", "p": 150.1, "t": 1700000000000, "v": 100}, ...]}
Other types: "ping", subscription acks — all yield [].
"""
import json
import logging
import os
from typing import Callable, List

try:
    import websocket  # type: ignore[import]
except ImportError:
    websocket = None  # type: ignore[assignment]

logger = logging.getLogger(__name__)

_WS_URL = "wss://ws.finnhub.io"


def parse_trade_message(raw_json: str) -> List[dict]:
    """Parse a raw Finnhub WS message string into a list of trade dicts.

    Each trade dict contains: symbol (str), price (float), ts (int), volume (float).
    Returns [] for:
      - ping / subscription-ack frames (type != "trade")
      - malformed / non-JSON input
      - items missing a symbol or price
    Never raises.
    """
    try:
        msg = json.loads(raw_json)
    except (json.JSONDecodeError, TypeError, ValueError):
        return []
    if not isinstance(msg, dict):
        return []
    if msg.get("type") != "trade":
        return []
    data = msg.get("data")
    if not isinstance(data, list):
        return []
    out: List[dict] = []
    for item in data:
        if not isinstance(item, dict):
            continue
        sym = item.get("s")
        price = item.get("p")
        if not sym or price is None:
            continue
        try:
            ts_raw = item.get("t")
            vol_raw = item.get("v")
            out.append({
                "symbol": str(sym),
                "price": float(price),
                "ts": int(ts_raw) if ts_raw is not None else 0,
                "volume": float(vol_raw) if vol_raw is not None else 0.0,
            })
        except (TypeError, ValueError):
            continue
    return out


class FinnhubWSClient:
    """Thin wrapper around websocket-client.

    Calls ``on_trade(symbol, price, ts)`` for each trade event received.
    Safe to instantiate when websocket-client is missing — ``connect()`` logs
    and returns immediately.
    """

    def __init__(
        self,
        symbols: List[str],
        on_trade: Callable[[str, float, int], None],
    ) -> None:
        self._symbols = list(symbols)
        self._on_trade = on_trade
        self._ws: object = None

    def connect(self) -> None:
        """Blocking: opens the WS connection and processes messages.

        Intended to run inside a daemon thread. Returns when the connection
        closes or when websocket-client / the API key are absent.
        """
        if websocket is None:
            logger.warning(
                "finnhub_ws: websocket-client not installed; streaming disabled"
            )
            return
        key = os.environ.get("FINNHUB_API_KEY")
        if not key:
            logger.warning(
                "finnhub_ws: FINNHUB_API_KEY not set; streaming disabled"
            )
            return

        url = f"{_WS_URL}?token={key}"

        def _on_open(ws: object) -> None:
            for sym in self._symbols:
                ws.send(json.dumps({"type": "subscribe", "symbol": sym}))  # type: ignore[attr-defined]
            logger.info(
                "finnhub_ws: connected; subscribed to %d symbol(s)", len(self._symbols)
            )

        def _on_message(ws: object, message: str) -> None:
            trades = parse_trade_message(message)
            for t in trades:
                try:
                    self._on_trade(t["symbol"], t["price"], t["ts"])
                except Exception:
                    pass

        def _on_error(ws: object, error: object) -> None:
            logger.error("finnhub_ws: error: %s", error)

        def _on_close(ws: object, code: object, msg: object) -> None:
            logger.info("finnhub_ws: connection closed (code=%s msg=%s)", code, msg)

        self._ws = websocket.WebSocketApp(
            url,
            on_open=_on_open,
            on_message=_on_message,
            on_error=_on_error,
            on_close=_on_close,
        )
        self._ws.run_forever()  # type: ignore[union-attr]

    def close(self) -> None:
        """Request connection close (best-effort)."""
        if self._ws is not None:
            try:
                self._ws.close()  # type: ignore[union-attr]
            except Exception:
                pass
