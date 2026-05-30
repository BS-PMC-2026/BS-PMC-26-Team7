import { apiFetch } from './api';

export interface EmployeeDiscountSetting {
  settingId:              number;
  globalDiscountPercent:  number;
  active:                 boolean;
  updatedAtUtc:           string;
}

export interface ProductOverride {
  overrideId:             number;
  productId:              number;
  productName?:           string;
  mode:                   'use_global' | 'excluded' | 'custom_percent';
  customDiscountPercent:  number | null;
  updatedAtUtc:           string;
}

export async function getDiscountSetting(): Promise<EmployeeDiscountSetting> {
  return apiFetch<EmployeeDiscountSetting>('/api/employee-discounts/settings');
}

export async function updateDiscountSetting(
  globalDiscountPercent: number,
  active: boolean,
): Promise<EmployeeDiscountSetting> {
  return apiFetch<EmployeeDiscountSetting>('/api/employee-discounts/settings', {
    method: 'PUT',
    body: JSON.stringify({ globalDiscountPercent, active }),
  });
}

export async function listOverrides(): Promise<ProductOverride[]> {
  return apiFetch<ProductOverride[]>('/api/employee-discounts/overrides');
}

export async function setOverride(
  productId: number,
  mode: 'use_global' | 'excluded' | 'custom_percent',
  customDiscountPercent?: number,
): Promise<ProductOverride> {
  return apiFetch<ProductOverride>('/api/employee-discounts/overrides', {
    method: 'POST',
    body: JSON.stringify({ productId, mode, customDiscountPercent }),
  });
}

export async function removeOverride(overrideId: number): Promise<void> {
  await apiFetch<unknown>(`/api/employee-discounts/overrides/${overrideId}`, { method: 'DELETE' });
}
