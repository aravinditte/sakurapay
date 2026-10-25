from pydantic import BaseModel


class WebhookEndpointIn(BaseModel):
    url: str
