export type PlantCreate = {
  PlantCode: string;
  PepperId: number;
  ZoneId?: number;
  PlantedAt?: string;
  Status?: string;
  Notes?: string;
  IsActive: boolean;
};

export type PlantResponse = {
  PlantId: number;
  PlantCode: string;
  PepperId: number;
  ZoneId?: number | null;
  PlantedAt?: string | null;
  Status?: string | null;
  Notes?: string | null;
  IsActive: boolean;
};

export type PepperOption = {
  PepperId: number;
  PepperName: string;
};