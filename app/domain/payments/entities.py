from dataclasses import dataclass


@dataclass
class PaymentView:
    id: str
    merchant_id: str
    amount_minor: int
    currency: str
    status: str
