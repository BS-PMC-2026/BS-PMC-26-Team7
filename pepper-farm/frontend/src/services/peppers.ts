export type PepperCreate = {
  PepperName: string;
  ScientificName?: string;
  HeatLevelScovilleMin?: number;
  HeatLevelScovilleMax?: number;
  OptimalSoilMoistureMin?: number;
  OptimalSoilMoistureMax?: number;
  OptimalTempMinC?: number;
  OptimalTempMaxC?: number;
  OptimalSunlightHours?: number;
  ImageUrl?: string;
  Zone?: string;
  GeneralDescription?: string;
  IsActive: boolean;
};

export async function createPepper(data: PepperCreate) {
  const response = await fetch("http://127.0.0.1:8000/api/peppers", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.detail || "Failed to create pepper");
  }

  return result;
}

export async function uploadPepperImage(file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("http://127.0.0.1:8000/api/peppers/upload-image", {
    method: "POST",
    body: formData,
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.detail || "Failed to upload image");
  }

  return result;
}

export async function getPepperVarieties() {
  const response = await fetch("http://127.0.0.1:8000/api/peppers");

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.detail || "Failed to load pepper varieties");
  }

  return result;
}