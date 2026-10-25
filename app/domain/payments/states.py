TRANSITIONS = {
    ("CREATED", "authorize_ok"): "AUTHORIZED",
    ("CREATED", "authorize_decline"): "DECLINED",
    ("AUTHORIZED", "capture"): "CAPTURED",
    ("AUTHORIZED", "cancel"): "CANCELED",
    ("CAPTURED", "refund_partial"): "PARTIALLY_REFUNDED",
    ("CAPTURED", "refund_full"): "REFUNDED",
    ("PARTIALLY_REFUNDED", "refund_partial"): "PARTIALLY_REFUNDED",
    ("PARTIALLY_REFUNDED", "refund_full"): "REFUNDED",
}


def can(op, state):
    return (state, op) in TRANSITIONS
