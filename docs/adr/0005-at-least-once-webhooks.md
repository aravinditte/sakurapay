# ADR — At-least-once webhook delivery

Status: Accepted (v1 implementation)

**Context.** Exactly-once delivery over an unreliable network is impossible: a receiver can process an event and fail before the sender records success, so the sender cannot distinguish "never received" from "received but unacknowledged".

**Decision.** Deliver webhooks at least once, via a transactional outbox: events are committed with the state change, a worker creates one delivery record per endpoint, attempts are HMAC-signed, failures retry with bounded backoff (approx. 5s/15s/45s/120s, max attempts configurable), and exhausted deliveries are surfaced for manual retry. Each event carries a stable ID so receivers can deduplicate.

**Consequences.** No committed state change loses its notification, and workers can crash and resume safely. Receivers must be idempotent — this is part of the documented webhook contract, not an implementation detail. Duplicate deliveries are expected behaviour, not an error.
