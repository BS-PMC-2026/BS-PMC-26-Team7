from pydantic import BaseModel

class WorkerResponse(BaseModel):
    userId: int
    fullName: str
    email: str
    roleName: str
    isActive: bool

    model_config = {"from_attributes": True}
