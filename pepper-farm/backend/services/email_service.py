import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText


def _get_smtp_config() -> tuple[str, int, str, str, str]:
    host = os.getenv("SMTP_HOST", "")
    port = int(os.getenv("SMTP_PORT", "587"))
    user = os.getenv("SMTP_USER", "")
    password = os.getenv("SMTP_PASSWORD", "")
    from_addr = os.getenv("SMTP_FROM", "") or user
    return host, port, user, password, from_addr


def is_smtp_configured() -> bool:
    host, _, user, password, _ = _get_smtp_config()
    return bool(host and user and password)


def send_email(to_email: str, subject: str, body_html: str, body_text: str = "") -> None:
    """Send a single email via SMTP (Gmail STARTTLS).

    Reuses the same SMTP env vars (SMTP_HOST, SMTP_PORT, SMTP_USER,
    SMTP_PASSWORD, SMTP_FROM) already used by the sensor export endpoint in
    routers/sensors.py.  Raises ValueError when SMTP is not configured, or
    smtplib.SMTPException on delivery failure.
    """
    host, port, user, password, from_addr = _get_smtp_config()
    if not host or not user or not password:
        raise ValueError(
            "SMTP not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASSWORD in .env."
        )

    msg = MIMEMultipart("alternative")
    msg["From"] = from_addr
    msg["To"] = to_email
    msg["Subject"] = subject

    if body_text:
        msg.attach(MIMEText(body_text, "plain", "utf-8"))
    msg.attach(MIMEText(body_html, "html", "utf-8"))

    with smtplib.SMTP(host, port) as smtp:
        smtp.ehlo()
        smtp.starttls()
        smtp.ehlo()
        smtp.login(user, password)
        smtp.send_message(msg)
