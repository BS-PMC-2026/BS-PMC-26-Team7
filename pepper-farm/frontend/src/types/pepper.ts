export type Pepper = {
  PepperId: number;
  PepperName: string;
  ScientificName?: string | null;
  HeatLevelScovilleMin?: number | null;
  HeatLevelScovilleMax?: number | null;
  OptimalSoilMoistureMin?: number | null;
  OptimalSoilMoistureMax?: number | null;
  OptimalTempMinC?: number | null;
  OptimalTempMaxC?: number | null;
  OptimalPARMin?: number | null;
  OptimalPARMax?: number | null;
  ImageUrl?: string | null;
  Zone?: string | null;
  GeneralDescription?: string | null;
  IsActive: boolean;
};
