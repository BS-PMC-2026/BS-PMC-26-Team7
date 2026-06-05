export type InventoryResponse = {
  InventoryId: number;
  ProductId: number | null;
  ProductName: string | null;
  ItemName: string | null;
  DisplayName: string | null;
  Location: string | null;
  WarehouseQuantity: number;
  AllocatedQuantity: number;
  LastUpdatedAt: string;
};

export type InventoryCreatePayload = {
  ItemName: string;
  Location: string | null;
  WarehouseQuantity: number;
};

export type InventoryUpdatePayload = {
  WarehouseQuantity: number;
  AllocatedQuantity: number;
  Location: string | null;
};

export type PlantSummary = {
  PlantId: number;
  PlantCode: string;
  Status: string | null;
  ZoneId: number | null;
  ZoneName: string | null;
  PlantedAt: string | null;
  TransferredAt: string | null;
};

export type InventoryByVariety = {
  PepperId: number;
  PepperName: string;
  PlantCount: number;
  TotalWarehouseQuantity: number;
  StatusBreakdown: Record<string, number>;
  Plants: PlantSummary[];
};