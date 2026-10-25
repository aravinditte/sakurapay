from pydantic import BaseModel


class PaymentIn(BaseModel):
    amount_minor: int
    currency: str = "USD"
    customer_reference: str | None = None
    description: str | None = None


class AuthorizeIn(BaseModel):
    simulation_outcome: str = "APPROVED"


class CaptureIn(BaseModel):
    amount_minor: int
