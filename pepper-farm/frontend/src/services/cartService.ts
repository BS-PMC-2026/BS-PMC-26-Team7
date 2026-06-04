import { apiFetch } from './api';

export interface CartLineItem {
  cartItemId:             number;
  productId:              number;
  productName:            string;
  imageUrl:               string | null;
  quantity:               number;
  unitPriceOriginal:      number;
  unitPriceAfterDiscount: number;
  unitPriceForUser:       number;
  lineTotal:              number;
  availableStock:         number;
  isAvailable:            boolean;
  stockWarning:           string | null;
  discountPct:            number | null;
  employeeDiscountPct:    number | null;
}

export interface CouponValidation {
  valid:          boolean;
  couponCode:     string | null;
  discountType:   string | null;
  discountValue:  number | null;
  discountAmount: number | null;
  message:        string | null;
}

export interface CartSummary {
  items:                  CartLineItem[];
  originalSubtotal:       number;
  productDiscountTotal:   number;
  employeeDiscountTotal:  number;
  couponDiscountTotal:    number;
  finalTotal:             number;
  coupon:                 CouponValidation | null;
  hasBlockingIssues:      boolean;
  currency:               string;
}

export async function getCart(couponCode?: string): Promise<CartSummary> {
  const qs = couponCode ? `?coupon=${encodeURIComponent(couponCode)}` : '';
  return apiFetch<CartSummary>(`/api/cart${qs}`);
}

export async function addToCart(productId: number, quantity = 1): Promise<CartSummary> {
  return apiFetch<CartSummary>('/api/cart/items', {
    method: 'POST',
    body: JSON.stringify({ productId, quantity }),
  });
}

export async function updateCartItem(cartItemId: number, quantity: number): Promise<CartSummary> {
  return apiFetch<CartSummary>(`/api/cart/items/${cartItemId}`, {
    method: 'PUT',
    body: JSON.stringify({ quantity }),
  });
}

export async function removeCartItem(cartItemId: number): Promise<CartSummary> {
  return apiFetch<CartSummary>(`/api/cart/items/${cartItemId}`, { method: 'DELETE' });
}

export async function clearCart(): Promise<void> {
  await apiFetch<unknown>('/api/cart/clear', { method: 'DELETE' });
}
