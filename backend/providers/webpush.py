# backend/providers/webpush.py
"""Web Push notification delivery via pywebpush (VAPID).

Guarded import: if pywebpush is not installed OR VAPID_PRIVATE_KEY is unset,
send_push() is a graceful no-op that logs and returns False. This keeps the app
and all tests functional without the optional dependency.

VAPID keys are read from environment:
  VAPID_PUBLIC_KEY   — base64url-encoded DER public key (given to browsers)
  VAPID_PRIVATE_KEY  — base64url-encoded DER private key (server-side only)
  VAPID_CLAIMS_EMAIL — "mailto:..." address for the VAPID sub claim
"""
import logging
import os

logger = logging.getLogger(__name__)

try:
    from pywebpush import webpush as _webpush_send, WebPushException
    _PYWEBPUSH_AVAILABLE = True
except ImportError:
    _PYWEBPUSH_AVAILABLE = False
    WebPushException = Exception


def send_push(subscription: dict, payload: dict) -> bool:
    """Send a Web Push notification.

    Args:
        subscription: dict with keys 'endpoint', 'p256dh', 'auth'
        payload:      dict with at least 'title' and 'body' keys (JSON-encoded)

    Returns:
        True on successful delivery, False on any failure or no-op.
    """
    private_key = os.environ.get("VAPID_PRIVATE_KEY", "")
    if not _PYWEBPUSH_AVAILABLE:
        logger.info("pywebpush not installed; skipping web push")
        return False
    if not private_key:
        logger.info("VAPID_PRIVATE_KEY unset; skipping web push")
        return False

    import json
    claims_email = os.environ.get("VAPID_CLAIMS_EMAIL", "mailto:noreply@tickertracker.info")

    try:
        _webpush_send(
            subscription_info={
                "endpoint": subscription["endpoint"],
                "keys": {
                    "p256dh": subscription["p256dh"],
                    "auth": subscription["auth"],
                },
            },
            data=json.dumps(payload),
            vapid_private_key=private_key,
            vapid_claims={"sub": claims_email},
        )
        return True
    except WebPushException as e:
        # 404/410 = subscription expired/unregistered → caller should prune
        status = getattr(e, "response", None)
        status_code = getattr(status, "status_code", None) if status else None
        logger.warning("web push failed (status=%s) for %s: %s",
                       status_code, subscription.get("endpoint", "?")[:60], e)
        if status_code in (404, 410):
            raise  # signal caller to prune
        return False
    except Exception as e:
        logger.error("web push unexpected error: %s", e)
        return False
