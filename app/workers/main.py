import threading

import app.infrastructure.models  # noqa
from app.infrastructure.database import Base, engine
from app.workers.outbox_worker import run_forever as outbox_loop
from app.workers.webhook_worker import run_forever as webhook_loop


def main():
    Base.metadata.create_all(bind=engine)
    print("SakuraPay workers started (outbox + webhook)")
    t1 = threading.Thread(target=outbox_loop, daemon=True)
    t1.start()
    webhook_loop()


if __name__ == "__main__":
    main()
