import { apiFetch } from './api';

export interface CreditCard {
  cardholderName: string;
  cardNumber:     string;
  expiryMonth:    number;
  expiryYear:     number;
  cvv:            string;
}

export interface CheckoutItem {
  productId: number;
  quantity:  number;
}

export interface CheckoutRequest {
  couponCode?:    string;
  paymentMethod:  'mock_credit_card' | 'mock_paypal';
  creditCard?:    CreditCard;
  items?:         CheckoutItem[];   // empty = use cart
}

export interface CheckoutLineItem {
  productId:                      number;
  productName:                    string;
  quantity:                       number;
  unitPriceOriginal:              number;
  unitPriceAfterProductDiscount:  number;
  unitPriceAfterEmployeeDiscount: number;
  lineTotal:                      number;
  productDiscountPct:             number | null;
  employeeDiscountPct:            number | null;
}

export interface CheckoutPreview {
  items:                  CheckoutLineItem[];
  originalSubtotal:       number;
  productDiscountTotal:   number;
  employeeDiscountTotal:  number;
  couponDiscountTotal:    number;
  finalTotal:             number;
  couponCode:             string | null;
  currency:               string;
  isValid:                boolean;
  errors:                 string[];
}

export interface PaymentResult {
  success:            boolean;
  orderId:            number | null;
  orderNumber:        string | null;
  totalAmount:        number | null;
  currency:           string;
  paymentMethod:      string | null;
  mockTransactionId:  string | null;
  message:            string;
  errors:             string[];
}

export async function previewCheckout(req: CheckoutRequest): Promise<CheckoutPreview> {
  return apiFetch<CheckoutPreview>('/api/checkout/preview', {
    method: 'POST',
    body: JSON.stringify(req),
  });
}

export async function pay(req: CheckoutRequest): Promise<PaymentResult> {
  return apiFetch<PaymentResult>('/api/checkout/pay', {
    method: 'POST',
    body: JSON.stringify(req),
    timeoutMs: 30_000,   // checkout gets extra time (still returns fast — email is background)
  });
}

// ── Luhn check (client-side pre-validation only — server always re-validates) ──

export function luhnCheck(cardNumber: string): boolean {
  const digits = cardNumber.replace(/\D/g, '').split('').map(Number);
  let sum = 0;
  let odd = true;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits[i];
    if (!odd) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    odd = !odd;
  }
  return sum % 10 === 0;
}
