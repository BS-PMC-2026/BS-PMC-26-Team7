from pydantic import BaseModel, EmailStr, field_validator


class WorkerResponse(BaseModel):
    userId: int
    fullName: str
    email: str
    roleName: str
    isActive: bool

    model_config = {"from_attributes": True}


class RegisterRequest(BaseModel):
    fullName: str
    email: EmailStr
    password: str

    @field_validator("fullName")
    @classmethod
    def validate_full_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Full name cannot be empty.")
        if len(v) < 2:
            raise ValueError("Full name must be at least 2 characters.")
        return v

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 6:
            raise ValueError("Password must be at least 6 characters.")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one digit.")
        if not any(c.isalpha() for c in v):
            raise ValueError("Password must contain at least one letter.")
        return v


class RegisterResponse(BaseModel):
    userId: int
    fullName: str
    email: str
    role: str

    model_config = {"from_attributes": True}


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class LoginResponse(BaseModel):
    accessToken: str
    tokenType: str = "bearer"
    role: str
    fullName: str


class UserResponse(BaseModel):
    userId: int
    fullName: str
    email: str
    role: str
    isActive: bool

    model_config = {"from_attributes": True}


class PromoteRequest(BaseModel):
    roleId: int