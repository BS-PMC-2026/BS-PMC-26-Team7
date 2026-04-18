export type InventoryResponse = {
  InventoryId: number;
  ProductId: number;
  ProductName: string | null;
  WarehouseQuantity: number;
  AllocatedQuantity: number;
  LastUpdatedAt: string;
};

export type InventoryUpdatePayload = {
  WarehouseQuantity: number;
  AllocatedQuantity: number;
};