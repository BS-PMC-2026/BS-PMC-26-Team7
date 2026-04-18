from pydantic import BaseModel, Field, model_validator
from datetime import datetime
from typing import Optional


class InventoryUpdate(BaseModel):
    WarehouseQuantity: int = Field(..., ge=0)
    AllocatedQuantity: int = Field(..., ge=0)

    @model_validator(mode="after")
    def check_allocated_not_exceeds_warehouse(self) -> "InventoryUpdate":
        if self.AllocatedQuantity > self.WarehouseQuantity:
            raise ValueError(
                "AllocatedQuantity cannot exceed WarehouseQuantity."
            )
        return self


class InventoryResponse(BaseModel):
    InventoryId: int
    ProductId: int
    ProductName: Optional[str] = None  # joined from Product for convenience
    WarehouseQuantity: int
    AllocatedQuantity: int
    LastUpdatedAt: datetime

    class Config:
        from_attributes = True