import { apiFetch } from './api';

export interface Coupon {
  couponId:           number;
  code:               string;
  description:        string | null;
  discountType:       string;
  discountValue:      number;
  active:             boolean;
  startsAtUtc:        string | null;
  endsAtUtc:          string | null;
  maxTotalUses:       number | null;
  maxUsesPerUser:     number | null;
  currentUseCount:    number;
  minimumOrderAmount: number | null;
  createdAtUtc:       string;
  updatedAtUtc:       string;
}

export interface CouponPayload {
  code:               string;
  description?:       string;
  discountType:       'percentage' | 'fixed_amount';
  discountValue:      number;
  active:             boolean;
  startsAtUtc?:       string | null;
  endsAtUtc?:         string | null;
  maxTotalUses?:      number | null;
  maxUsesPerUser?:    number | null;
  minimumOrderAmount?: number | null;
}

export interface CouponValidationResult {
  valid:          boolean;
  couponCode?:    string;
  discountType?:  string;
  discountValue?: number;
  discountAmount?: number;
  message?:       string;
}

export async function listCoupons(): Promise<Coupon[]> {
  return apiFetch<Coupon[]>('/api/coupons');
}

export async function createCoupon(payload: CouponPayload): Promise<Coupon> {
  return apiFetch<Coupon>('/api/coupons', { method: 'POST', body: JSON.stringify(payload) });
}

export async function updateCoupon(id: number, payload: CouponPayload): Promise<Coupon> {
  return apiFetch<Coupon>(`/api/coupons/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
}

export async function deactivateCoupon(id: number): Promise<void> {
  await apiFetch<unknown>(`/api/coupons/${id}`, { method: 'DELETE' });
}

export async function validateCoupon(code: string, subtotal: number): Promise<CouponValidationResult> {
  return apiFetch<CouponValidationResult>('/api/coupons/validate', {
    method: 'POST',
    body: JSON.stringify({ code, subtotal }),
  });
}
