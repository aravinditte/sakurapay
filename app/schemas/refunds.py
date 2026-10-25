from pydantic import BaseModel


class RefundIn(BaseModel):
    amount_minor: int
    reason: str | None = None
