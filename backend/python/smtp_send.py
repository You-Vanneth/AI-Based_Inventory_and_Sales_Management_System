import json
import smtplib
import ssl
import sys
from email.message import EmailMessage


def load_payload():
    raw = sys.stdin.read().strip()
    if not raw:
        raise ValueError("Missing email payload")
    return json.loads(raw)


def main():
    payload = load_payload()
    host = str(payload.get("smtp_host") or "").strip()
    port = int(payload.get("smtp_port") or 0)
    username = str(payload.get("smtp_user") or "").strip()
    password = str(payload.get("smtp_password") or "")
    sender_name = str(payload.get("sender_name") or "AI Inventory").strip()
    sender_email = str(payload.get("sender_email") or "").strip()
    recipients = [str(x).strip() for x in (payload.get("to") or []) if str(x).strip()]
    subject = str(payload.get("subject") or "AI Inventory Alert").strip()
    body = str(payload.get("text") or "").strip()
    use_tls = bool(payload.get("use_tls", True))

    if not host or not port or not sender_email or not recipients:
        raise ValueError("SMTP host, port, sender email, and recipients are required")

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = f"{sender_name} <{sender_email}>"
    message["To"] = ", ".join(recipients)
    message.set_content(body or "AI Inventory notification")

    if use_tls:
        context = ssl.create_default_context()
        with smtplib.SMTP(host, port, timeout=20) as server:
            server.starttls(context=context)
            if username:
                server.login(username, password)
            server.send_message(message)
    else:
        with smtplib.SMTP_SSL(host, port, timeout=20) as server:
            if username:
                server.login(username, password)
            server.send_message(message)

    sys.stdout.write(json.dumps({"ok": True, "to": recipients}))


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:  # pragma: no cover
        sys.stderr.write(json.dumps({"error": str(exc)}))
        sys.exit(1)
