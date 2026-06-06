'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { getOrder, Order } from '@/services/ordersService';
import { useLanguage } from '@/context/LanguageContext';

function fmt(n: number) {
  return `₪${Number(n).toFixed(2)}`;
}

function productsRoute(): string {
  try {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) return '/visitor/products';
    const payload = JSON.parse(atob(token.split('.')[1]));
    const role = (payload.role ?? payload.Role ?? '') as string;
    if (role === 'Worker') return '/worker/products';
    return '/visitor/products';
  } catch { return '/visitor/products'; }
}

function formatUtc(iso: string | null | undefined): string {
  if (!iso) return '—';
  const s = iso.endsWith('Z') ? iso : iso + 'Z';
  return new Date(s).toLocaleString();
}

function SuccessPageInner() {
  const { t } = useLanguage();
  const st = t.store;
  const params = useSearchParams();
  const orderId = params?.get('orderId');

  const [order, setOrder]   = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) {
      setError('Missing order ID.');
      setLoading(false);
      return;
    }
    getOrder(Number(orderId))
      .then(setOrder)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load order.'))
      .finally(() => setLoading(false));
  }, [orderId]);

  if (loading) {
    return (
      <div className="app-page-bg flex items-center justify-center">
        <p className="text-sm text-gray-500">{t.common.loading}</p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="app-page-bg flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 text-sm mb-4">{error ?? 'Order not found.'}</p>
          <Link href={productsRoute()} className="text-sm text-[var(--color-primary)] underline">
            {st.continueShopping}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="app-page-bg">
      <div className="max-w-2xl mx-auto px-4 py-12">
        {/* Back to products */}
        <Link
          href={productsRoute()}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6 transition"
          data-testid="back-to-products-success"
        >
          ← {st.continueShopping}
        </Link>

        {/* Success banner */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">✓</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2" data-testid="order-success-title">
            {st.orderSuccess}
          </h1>
          <p className="text-sm text-gray-600">{st.orderThankYou}</p>
        </div>

        {/* Receipt email note */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center mb-6">
          <p className="text-xs text-blue-700" data-testid="receipt-email-msg">{st.receiptEmailQueued}</p>
        </div>

        {/* Order details card */}
        <div className="bg-white rounded-2xl border border-[var(--color-border)] p-6 mb-6">
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <p className="text-xs text-gray-500 mb-0.5">{st.orderNumber}</p>
              <p className="text-sm font-bold text-gray-900" data-testid="order-number">
                {order.orderNumber}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">{st.total}</p>
              <p className="text-sm font-bold text-gray-900" dir="ltr" data-testid="order-total">
                {fmt(order.totalAmount)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">{st.paymentMethod}</p>
              <p className="text-sm text-gray-700" data-testid="order-payment-method">
                {order.paymentMethod === 'mock_credit_card' ? st.mockCreditCard
                  : order.paymentMethod === 'mock_paypal' ? st.mockPaypal
                  : order.paymentMethod}
              </p>
            </div>
            {order.payment?.mockTransactionId && (
              <div>
                <p className="text-xs text-gray-500 mb-0.5">{st.transactionId}</p>
                <p className="text-xs font-mono text-gray-700 break-all" data-testid="transaction-id">
                  {order.payment.mockTransactionId}
                </p>
              </div>
            )}
            <div>
              <p className="text-xs text-gray-500 mb-0.5">{st.orderDate}</p>
              <p className="text-xs text-gray-700">{formatUtc(order.createdAtUtc)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">{st.orderStatus}</p>
              <p className="text-xs text-gray-700 capitalize">{order.status}</p>
            </div>
          </div>

          {/* Items */}
          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs font-semibold text-gray-700 mb-3">{st.orderItems}</p>
            <div className="flex flex-col gap-2" data-testid="order-items">
              {order.items.map((item) => (
                <div key={item.orderItemId} className="flex justify-between items-start text-sm">
                  <div>
                    <p className="text-sm text-gray-800">{item.productNameSnapshot}</p>
                    <p className="text-xs text-gray-500">× {item.quantity}</p>
                  </div>
                  <p className="text-sm font-medium text-gray-900 shrink-0 ml-4" dir="ltr">
                    {fmt(item.lineTotal)}
                  </p>
                </div>
              ))}
            </div>

            {/* Totals breakdown */}
            <div className="border-t border-gray-100 pt-3 mt-3 flex flex-col gap-1 text-xs">
              {order.productDiscountTotal > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>− {t.store.productDiscount}</span>
                  <span dir="ltr">−{fmt(order.productDiscountTotal)}</span>
                </div>
              )}
              {order.employeeDiscountTotal > 0 && (
                <div className="flex justify-between text-blue-600">
                  <span>− {t.store.employeeDiscount}</span>
                  <span dir="ltr">−{fmt(order.employeeDiscountTotal)}</span>
                </div>
              )}
              {order.couponDiscountTotal > 0 && (
                <div className="flex justify-between text-purple-600">
                  <span>− {t.store.couponDiscount} {order.couponCode && `(${order.couponCode})`}</span>
                  <span dir="ltr">−{fmt(order.couponDiscountTotal)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-gray-900 text-sm border-t border-gray-100 pt-2 mt-1">
                <span>{st.total}</span>
                <span dir="ltr">{fmt(order.totalAmount)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/visitor/products"
            data-testid="continue-shopping-btn"
            className="flex-1 text-center border border-[var(--color-primary)] text-[var(--color-primary)] px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-[var(--color-secondary-light)] transition"
          >
            {st.continueShopping}
          </Link>
          <Link
            href="/profile/orders"
            data-testid="view-orders-btn"
            className="flex-1 text-center bg-[var(--color-primary)] text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:opacity-90 transition"
          >
            {st.viewOrders}
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={
      <div className="app-page-bg flex items-center justify-center">
        <p className="text-sm text-gray-500">Loading...</p>
      </div>
    }>
      <SuccessPageInner />
    </Suspense>
  );
}
