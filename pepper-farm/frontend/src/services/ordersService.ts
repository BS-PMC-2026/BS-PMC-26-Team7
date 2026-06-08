import { apiFetch } from './api';

export interface OrderItemDetail {
  orderItemId:                    number;
  productId:                      number | null;
  productNameSnapshot:            string;
  unitPriceOriginal:              number;
  unitPriceAfterProductDiscount:  number;
  unitPriceAfterEmployeeDiscount: number;
  quantity:                       number;
  lineSubtotal:                   number;
  lineDiscountTotal:              number;
  lineTotal:                      number;
  employeeDiscountAppliedPercent: number | null;
  productDiscountAppliedPercent:  number | null;
}

export interface PaymentDetail {
  paymentRecordId:    number;
  paymentMethod:      string;
  paymentStatus:      string;
  amount:             number;
  currency:           string;
  mockTransactionId:  string | null;
  cardLast4:          string | null;
  cardBrand:          string | null;
  invoiceEmailStatus: string;
  createdAtUtc:       string;
  paidAtUtc:          string | null;
}

export interface Order {
  orderId:                number;
  orderNumber:            string;
  status:                 string;
  subtotal:               number;
  productDiscountTotal:   number;
  employeeDiscountTotal:  number;
  couponDiscountTotal:    number;
  totalAmount:            number;
  currency:               string;
  couponCode:             string | null;
  paymentMethod:          string;
  createdAtUtc:           string;
  paidAtUtc:              string | null;
  items:                  OrderItemDetail[];
  payment:                PaymentDetail | null;
}

export interface OrderWithBuyer extends Order {
  buyerName:  string | null;
  buyerEmail: string | null;
}

export async function getMyOrders(): Promise<Order[]> {
  return apiFetch<Order[]>('/api/orders');
}

export async function getOrder(orderId: number): Promise<Order> {
  return apiFetch<Order>(`/api/orders/${orderId}`);
}

/** FarmManager only — returns every order with buyer info. */
export async function getAllOrders(): Promise<OrderWithBuyer[]> {
  return apiFetch<OrderWithBuyer[]>('/api/orders/all');
}
