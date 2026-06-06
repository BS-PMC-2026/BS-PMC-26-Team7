'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { getOrder, Order } from '@/services/ordersService';
import { useLanguage } from '@/context/LanguageContext';

function fmt(n: number) { return `₪${Number(n).toFixed(2)}`; }

function formatDate(iso: string | null | undefined) {
  if (!iso) return '—';
  const s = iso.endsWith('Z') ? iso : iso + 'Z';
  return new Date(s).toLocaleString();
}

function StatusBadge({ status }: { status: string }) {
  const colours: Record<string, string> = {
    paid:      'bg-green-100 text-green-700',
    pending:   'bg-yellow-100 text-yellow-700',
    cancelled: 'bg-gray-100  text-gray-600',
    failed:    'bg-red-100   text-red-600',
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${colours[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {status}
    </span>
  );
}

export default function OrderDetailPage() {
  const { t } = useLanguage();
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const [order,   setOrder]   = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    if (!params?.id) return;
    getOrder(Number(params.id))
      .then(setOrder)
      .catch((e) => setError(e instanceof Error ? e.message : 'Order not found.'))
      .finally(() => setLoading(false));
  }, [params?.id]);

  if (loading) return (
    <div className="app-page-bg flex items-center justify-center">
      <p className="text-sm text-gray-400">{t.common.loading}</p>
    </div>
  );

  if (error || !order) return (
    <div className="app-page-bg flex items-center justify-center">
      <div className="text-center">
        <p className="text-red-500 text-sm mb-4">{error ?? 'Order not found.'}</p>
        <Link href="/profile/orders" className="text-sm text-[var(--color-primary)] underline">← Back to My Orders</Link>
      </div>
    </div>
  );

  const payMethod = order.paymentMethod === 'paypal' ? 'PayPal' : 'Mock Credit Card';

  return (
    <div className="app-page-bg">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <Link href="/profile/orders" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4 transition">
          ← My Orders
        </Link>

        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <h1 className="text-xl font-bold text-gray-900 font-mono">{order.orderNumber}</h1>
          <StatusBadge status={order.status} />
        </div>

        {/* Order metadata */}
        <div className="bg-white rounded-xl border border-[var(--color-border)] p-4 mb-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Order Date</p>
              <p className="font-medium text-gray-800">{formatDate(order.createdAtUtc)}</p>
            </div>
            {order.paidAtUtc && (
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Paid At</p>
                <p className="font-medium text-gray-800">{formatDate(order.paidAtUtc)}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Payment Method</p>
              <p className="font-medium text-gray-800">{payMethod}</p>
            </div>
            {order.couponCode && (
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Coupon</p>
                <p className="font-medium text-gray-800 font-mono">{order.couponCode}</p>
              </div>
            )}
            {order.payment?.cardLast4 && (
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Card</p>
                <p className="font-medium text-gray-800">{order.payment.cardBrand ?? ''} ****{order.payment.cardLast4}</p>
              </div>
            )}
          </div>
        </div>

        {/* Items */}
        <div className="bg-white rounded-xl border border-[var(--color-border)] p-4 mb-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Items</h2>
          <div className="flex flex-col gap-2">
            {order.items.map((item) => (
              <div key={item.orderItemId} className="flex items-start justify-between gap-2 py-2 border-b border-gray-50 last:border-0">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{item.productNameSnapshot}</p>
                  <div className="text-xs text-gray-500 mt-0.5 flex flex-wrap gap-2">
                    <span>Qty: {item.quantity}</span>
                    {item.productDiscountAppliedPercent && (
                      <span className="text-green-600">Product discount: {item.productDiscountAppliedPercent.toFixed(0)}%</span>
                    )}
                    {item.employeeDiscountAppliedPercent && (
                      <span className="text-blue-600">Employee discount: {item.employeeDiscountAppliedPercent.toFixed(0)}%</span>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  {item.unitPriceOriginal !== item.lineTotal / item.quantity && (
                    <p className="text-xs text-gray-400 line-through" dir="ltr">{fmt(item.unitPriceOriginal)}</p>
                  )}
                  <p className="text-sm font-bold text-gray-900" dir="ltr">{fmt(item.lineTotal)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Price breakdown */}
        <div className="bg-white rounded-xl border border-[var(--color-border)] p-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Price Summary</h2>
          <div className="flex flex-col gap-1 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal</span>
              <span dir="ltr">{fmt(order.subtotal)}</span>
            </div>
            {order.productDiscountTotal > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Product discounts</span>
                <span dir="ltr">−{fmt(order.productDiscountTotal)}</span>
              </div>
            )}
            {order.employeeDiscountTotal > 0 && (
              <div className="flex justify-between text-blue-600">
                <span>Employee discount</span>
                <span dir="ltr">−{fmt(order.employeeDiscountTotal)}</span>
              </div>
            )}
            {order.couponDiscountTotal > 0 && (
              <div className="flex justify-between text-purple-600">
                <span>Coupon discount</span>
                <span dir="ltr">−{fmt(order.couponDiscountTotal)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-gray-900 text-base border-t border-gray-100 pt-2 mt-1">
              <span>Total</span>
              <span dir="ltr">{fmt(order.totalAmount)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
