import logging
import os

logger = logging.getLogger(__name__)


def _resend_send(payload: dict):
    import resend
    resend.api_key = os.environ["RESEND_API_KEY"]
    return resend.Emails.send(payload)


def _send(to: str, subject: str, html: str) -> bool:
    if not os.environ.get("RESEND_API_KEY"):
        logger.info("RESEND_API_KEY unset; skipping email to %s", to)
        return False
    try:
        _resend_send({
            "from": os.environ.get("MAIL_FROM", "noreply@example.com"),
            "to": [to], "subject": subject, "html": html,
        })
        return True
    except Exception as e:
        logger.error("email send failed to %s: %s", to, e)
        return False


def send_verify_email(to: str, link: str) -> bool:
    html = (f'<p>Welcome to Ticker Tracker. Confirm your email to finish '
            f'signing up:</p><p><a href="{link}">Verify my email</a></p>'
            f'<p>This link expires in 24 hours.</p>')
    return _send(to, "Verify your Ticker Tracker email", html)


def send_reset_email(to: str, link: str) -> bool:
    html = (f'<p>Reset your Ticker Tracker password:</p>'
            f'<p><a href="{link}">Reset password</a></p>'
            f'<p>This link expires in 1 hour. If you did not request this, '
            f'ignore this email.</p>')
    return _send(to, "Reset your Ticker Tracker password", html)
