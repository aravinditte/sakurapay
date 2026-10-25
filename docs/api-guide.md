# API Guide

Base: /api/v1. Auth: POST /auth/register or /auth/login, send `Authorization: Bearer <token>`. Payments need `Idempotency-Key` header for create/capture/refund. Interactive docs at /docs.
