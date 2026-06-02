from pydantic import BaseModel, Field, model_validator
from datetime import datetime
from typing import Dict, List, Optional


class InventoryCreate(BaseModel):
    """Create a warehouse-only inventory item (no linked product)."""
    ItemName: str = Field(..., min_length=1, max_length=200)
    Location: Optional[str] = Field(None, max_length=200)
    WarehouseQuantity: int = Field(0, ge=0)

    @model_validator(mode="after")
    def strip_fields(self) -> "InventoryCreate":
        self.ItemName = self.ItemName.strip()
        if not self.ItemName:
            raise ValueError("ItemName cannot be empty.")
        if self.Location is not None:
            loc = self.Location.strip()
            self.Location = loc or None
        return self


class InventoryUpdate(BaseModel):
    WarehouseQuantity: int = Field(..., ge=0)
    AllocatedQuantity: int = Field(..., ge=0)
    Location: Optional[str] = Field(None, max_length=200)

    @model_validator(mode="after")
    def check_allocated_not_exceeds_warehouse(self) -> "InventoryUpdate":
        if self.AllocatedQuantity > self.WarehouseQuantity:
            raise ValueError("AllocatedQuantity cannot exceed WarehouseQuantity.")
        if self.Location is not None:
            loc = self.Location.strip()
            self.Location = loc or None
        return self


class InventoryResponse(BaseModel):
    InventoryId: int
    ProductId: Optional[int] = None
    ProductName: Optional[str] = None   # joined from Product when ProductId is set
    ItemName: Optional[str] = None      # warehouse-only label
    DisplayName: Optional[str] = None   # ProductName or ItemName for convenience
    Location: Optional[str] = None
    WarehouseQuantity: int
    AllocatedQuantity: int
    LastUpdatedAt: datetime

    class Config:
        from_attributes = True


# For the plants-by-variety view
class PlantSummary(BaseModel):
    PlantId: int
    PlantCode: str
    Status: Optional[str] = None
    ZoneId: Optional[int] = None
    ZoneName: Optional[str] = None


class InventoryByVariety(BaseModel):
    PepperId: int
    PepperName: str
    PlantCount: int
    TotalWarehouseQuantity: int
    StatusBreakdown: Dict[str, int] = {}
    Plants: List[PlantSummary]