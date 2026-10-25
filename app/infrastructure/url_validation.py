import ipaddress
import socket
from urllib.parse import urlparse

from app.config import settings
from app.domain.errors import AppError


def validate_webhook_url(url: str):
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https") or not parsed.hostname:
        raise AppError("VALIDATION_ERROR", "Webhook url must be a valid http(s) URL.", 422)
    if settings.allow_private_webhooks:
        return
    host = parsed.hostname.lower()
    if host in ("localhost",):
        raise AppError(
            "VALIDATION_ERROR", "Webhook url must not target localhost in this environment.", 422
        )
    ips = []
    try:
        ips = [ipaddress.ip_address(host)]
    except ValueError:
        try:
            ips = [ipaddress.ip_address(info[4][0]) for info in socket.getaddrinfo(host, None)]
        except Exception:
            raise AppError("VALIDATION_ERROR", "Webhook host could not be resolved.", 422)
    for ip in ips:
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast:
            raise AppError(
                "VALIDATION_ERROR",
                "Webhook url must not target private, loopback, link-local or reserved addresses in this environment.",
                422,
            )
