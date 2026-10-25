# SakuraPay - 決済処理の信頼性を検証するシミュレーター

バックエンド開発 | Python | FastAPI | PostgreSQL

SakuraPayは、決済処理を模擬し、リクエストの重複送信、並行処理、障害発生時におけるデータの整合性を検証するプロジェクトです。承認・確定、全額返金・一部返金、冪等性制御、追記型の台帳、Transactional Outbox、HMAC署名付きWebhook、照合による不整合検出を実装しています。実際のお金やカードは一切扱いません。

起動方法は英語READMEをご覧ください。
