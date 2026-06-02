import { apiFetch } from './api';

export interface PaypalCreateOrderPayload {
  couponCode?: string;
  items?: { productId: number; quantity: number }[];
}

export interface PaypalCreateOrderResult {
  paypalOrderId: string;
  amount:        number;
  currency:      string;
}

export interface PaypalCapturePayload {
  paypalOrderId: string;
  couponCode?:   string;
  items?:        { productId: number; quantity: number }[];
}

export interface PaypalCaptureResult {
  success:           boolean;
  orderId:           number | null;
  orderNumber:       string | null;
  totalAmount:       number | null;
  currency:          string;
  paymentMethod:     string | null;
  providerOrderId:   string | null;
  providerCaptureId: string | null;
  message:           string;
  errors:            string[];
}

export interface PaypalConfig {
  enabled:  boolean;
  clientId: string;
  currency: string;
  mode:     string;
}

export async function createPaypalOrder(
  payload: PaypalCreateOrderPayload,
): Promise<PaypalCreateOrderResult> {
  return apiFetch<PaypalCreateOrderResult>('/api/payments/paypal/create-order', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function capturePaypalOrder(
  payload: PaypalCapturePayload,
): Promise<PaypalCaptureResult> {
  return apiFetch<PaypalCaptureResult>('/api/payments/paypal/capture-order', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getPaypalConfig(): Promise<PaypalConfig> {
  return apiFetch<PaypalConfig>('/api/payments/paypal/config');
}
