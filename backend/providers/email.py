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
    from providers import email_templates as t
    body = (
        '<p style="margin:0 0 14px">Welcome to Ticker Tracker — one quick step to '
        'finish creating your account.</p>'
        f'{t.button("Verify my email", link)}'
        '<p style="margin:14px 0 0;font-size:12.5px;color:#8b93a0">'
        'This link expires in 24 hours. If you didn\'t sign up, you can ignore '
        'this email.</p>'
    )
    html = t.shell("Confirm your email", body,
                   preheader="Verify your email to finish signing up.")
    return _send(to, "Verify your Ticker Tracker email", html)


def send_reset_email(to: str, link: str) -> bool:
    from providers import email_templates as t
    body = (
        '<p style="margin:0 0 14px">We received a request to reset your Ticker '
        'Tracker password. Click below to choose a new one.</p>'
        f'{t.button("Reset my password", link)}'
        '<p style="margin:14px 0 0;font-size:12.5px;color:#8b93a0">'
        'This link expires in 1 hour. If you didn\'t request this, ignore this '
        'email — your password won\'t change.</p>'
    )
    html = t.shell("Reset your password", body,
                   preheader="Reset your Ticker Tracker password.")
    return _send(to, "Reset your Ticker Tracker password", html)
