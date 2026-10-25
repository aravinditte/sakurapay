from dataclasses import dataclass


@dataclass
class LedgerEntryView:
    account_id: str
    amount_delta_minor: int
