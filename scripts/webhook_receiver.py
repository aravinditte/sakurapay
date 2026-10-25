"""Sample webhook receiver: verifies HMAC signatures and deduplicates by event ID (spec 11.5).
Run: python scripts/webhook_receiver.py  (listens on 127.0.0.1:9999/hook)
Set WEBHOOK_RECEIVER_SECRET to the endpoint signing_secret to verify signatures.
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from http.server import BaseHTTPRequestHandler, HTTPServer

from app.infrastructure.security import verify_webhook

SECRET = os.getenv("WEBHOOK_RECEIVER_SECRET", "")


class DedupStore:
    def __init__(self):
        self.seen = set()

    def is_duplicate(self, event_id):
        return event_id in self.seen

    def mark(self, event_id):
        self.seen.add(event_id)


store = DedupStore()


class Handler(BaseHTTPRequestHandler):
    def do_POST(self):
        body = self.rfile.read(int(self.headers.get("Content-Length", 0)))
        event_id = self.headers.get("X-SakuraPay-Event-Id", "")
        ts = self.headers.get("X-SakuraPay-Timestamp", "")
        sig = self.headers.get("X-SakuraPay-Signature", "")
        if SECRET and not verify_webhook(SECRET, ts, body, sig):
            self.send_response(401)
            self.end_headers()
            return
        if store.is_duplicate(event_id):
            print(f"duplicate event {event_id} ignored")
            self.send_response(200)
            self.end_headers()
            return
        store.mark(event_id)
        print(f"processed event {event_id}: {body[:120]!r}")
        self.send_response(200)
        self.end_headers()

    def log_message(self, *a):
        pass


if __name__ == "__main__":
    HTTPServer(("127.0.0.1", 9999), Handler).serve_forever()
