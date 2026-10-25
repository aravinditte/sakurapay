import threading
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import ClassVar

from tests.conftest import captured_payment, register


class Ok(BaseHTTPRequestHandler):
    hits: ClassVar[list] = []

    def do_POST(self):
        Ok.hits.append(self.headers.get("X-SakuraPay-Event-Id"))
        self.rfile.read(int(self.headers.get("Content-Length", 0)))
        self.send_response(200)
        self.send_header("Connection", "close")
        self.end_headers()
        self.close_connection = True

    def log_message(self, *a):
        pass


def test_outbox_survives_until_worker_runs(client):
    Ok.hits.clear()
    rec_auth_data = register(client, "worker-recovery@example.test", "demo-password")
    rec_auth = {"Authorization": f"Bearer {rec_auth_data['access_token']}"}
    
    srv = HTTPServer(("127.0.0.1", 0), Ok)
    port = srv.server_address[1]
    t = threading.Thread(target=srv.serve_forever, daemon=True)
    t.start()
    try:
        client.post(
            "/api/v1/webhook-endpoints", json={"url": f"http://127.0.0.1:{port}/hook"}, headers=rec_auth
        )
        captured_payment(client, rec_auth, 7000)
        # "Crash": no worker has run; the event must be durably pending, not lost.
        health = client.get("/health/worker").json()
        assert health["unpublished_outbox_events"] >= 1
        # "Restart": a fresh worker pass processes the durable outbox.
        from app.workers.outbox_worker import run_once as outbox_once
        from app.workers.webhook_worker import run_once as webhook_once

        outbox_once()
        webhook_once()
        deliveries = client.get("/api/v1/webhook-deliveries", headers=rec_auth).json()["items"]
        assert any(d["status"] == "SUCCEEDED" for d in deliveries) and len(Ok.hits) >= 1
    finally:
        srv.shutdown()
        srv.server_close()
