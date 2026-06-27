"""Branded HTML email templates for Ticker Tracker.

All emails share a UTF-8 document shell with the TT logo mark, brand colors, and
a footer with the trademark. Components return full HTML documents ready for
providers.email._send. Email clients (esp. Outlook) need inline styles + a real
charset, so everything here is inline-styled and table-based where it matters.
"""
import datetime as _dt

YEAR = _dt.datetime.now().year

# Brand palette (mirrors the app's design tokens, tuned for light email clients)
BG = "#0a0b0d"           # dark header band
CARD = "#14171c"
PANEL = "#0f1115"
TX = "#e9ebee"
TX2 = "#9aa1ab"
TX3 = "#5b626c"
UP = "#3ddc84"           # green
DOWN = "#ff5d73"         # red
ACCENT = "#3ddc84"
ACCENT_INK = "#06120b"
LINE = "rgba(255,255,255,.08)"

APP_URL = "https://tickertracker.info"


def _logo_mark() -> str:
    """The two-T logo mark rendered as a small inline-styled box (green T over
    red T) — matches the app/header/favicon. Table-based for Outlook."""
    return (
        '<table role="presentation" cellpadding="0" cellspacing="0" '
        'style="display:inline-block;vertical-align:middle">'
        '<tr><td style="width:34px;height:34px;background:#14171c;border-radius:9px;'
        'border:1px solid rgba(255,255,255,.14);position:relative;text-align:center;'
        'font-family:\'Courier New\',monospace;font-weight:800;font-size:17px;'
        'line-height:34px;">'
        '<span style="color:#3ddc84">T</span><span style="color:#ff5d73">T</span>'
        '</td></tr></table>'
    )


def shell(title: str, body_html: str, *, preheader: str = "") -> str:
    """Wrap content in the full branded, UTF-8 email document."""
    pre = (
        f'<div style="display:none;max-height:0;overflow:hidden;opacity:0">'
        f'{preheader}</div>' if preheader else ""
    )
    return f"""<!doctype html>
<html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#eef0f3;
font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
{pre}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef0f3">
<tr><td align="center" style="padding:24px 12px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
    style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;
    box-shadow:0 6px 24px rgba(0,0,0,.08)">

    <!-- Header band -->
    <tr><td style="background:{BG};padding:20px 24px">
      <table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td style="padding-right:11px">{_logo_mark()}</td>
        <td style="font-size:18px;font-weight:800;letter-spacing:-.02em">
          <span style="color:{UP}">Ticker</span><span style="color:{DOWN}">&nbsp;Tracker</span>
        </td>
      </tr></table>
    </td></tr>

    <!-- Title -->
    <tr><td style="padding:26px 28px 0">
      <h1 style="margin:0;font-size:20px;font-weight:800;color:#11151b;letter-spacing:-.01em">{title}</h1>
    </td></tr>

    <!-- Body -->
    <tr><td style="padding:16px 28px 28px;color:#33383f;font-size:14.5px;line-height:1.6">
      {body_html}
    </td></tr>

    <!-- Footer -->
    <tr><td style="padding:18px 28px;border-top:1px solid #eceef1;background:#fafbfc">
      <p style="margin:0 0 4px;font-size:12px;color:#8b93a0">
        © {YEAR} Ticker Tracker&trade; &middot; Informational only, not financial advice.
      </p>
      <p style="margin:0;font-size:12px;color:#8b93a0">
        <a href="{APP_URL}" style="color:#16a34a;text-decoration:none">tickertracker.info</a>
      </p>
    </td></tr>

  </table>
</td></tr></table>
</body></html>"""


def button(label: str, href: str) -> str:
    """A solid accent CTA button (table-based for Outlook)."""
    return (
        '<table role="presentation" cellpadding="0" cellspacing="0" style="margin:18px 0 6px">'
        f'<tr><td style="background:#16a34a;border-radius:10px">'
        f'<a href="{href}" style="display:inline-block;padding:12px 22px;color:#ffffff;'
        f'font-weight:700;font-size:14px;text-decoration:none">{label}</a>'
        '</td></tr></table>'
    )


def stat_pill(text: str, color: str) -> str:
    """A small colored pill for a price/percent."""
    return (
        f'<span style="display:inline-block;padding:3px 10px;border-radius:20px;'
        f'background:{color}1f;color:{color};font-weight:700;font-size:13px">{text}</span>'
    )
