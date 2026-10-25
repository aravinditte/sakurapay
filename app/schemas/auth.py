from pydantic import BaseModel


class LoginIn(BaseModel):
    email: str
    password: str


class RegisterIn(BaseModel):
    email: str
    password: str
    merchant_name: str = "Demo Merchant"
    role: str = "MERCHANT"
