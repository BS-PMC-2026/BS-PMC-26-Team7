import { apiFetch } from './api';
import { Pepper } from '@/types/pepper';

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

export async function getAllPeppers(): Promise<Pepper[]> {
  return apiFetch<Pepper[]>('/api/peppers');
}

export async function createPepper(data: PepperCreate): Promise<Pepper> {
  return apiFetch<Pepper>('/api/peppers', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function uploadPepperImage(file: File): Promise<{ imageUrl: string }> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch('/api/peppers/upload-image', {
    method: 'POST',
    body: formData,
  });

  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.detail || 'Failed to upload image');
  }
  return result;
}

/** @deprecated use getAllPeppers() */
export async function getPepperVarieties(): Promise<Pepper[]> {
  return getAllPeppers();
}
