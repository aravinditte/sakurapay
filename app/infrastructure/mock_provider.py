import uuid


def authorize(outcome, amount):
    if outcome == "DECLINED":
        return ("FAILED", "CARD_DECLINED", None)
    if outcome == "TIMEOUT":
        return ("FAILED", "PROVIDER_TIMEOUT", None)
    if outcome == "TEMPORARY_FAILURE":
        return ("FAILED", "PROVIDER_TEMPORARY_FAILURE", None)
    return ("SUCCEEDED", None, f"sim_auth_{uuid.uuid4().hex[:12]}")


def capture():
    return ("SUCCEEDED", None, f"sim_cap_{uuid.uuid4().hex[:12]}")
