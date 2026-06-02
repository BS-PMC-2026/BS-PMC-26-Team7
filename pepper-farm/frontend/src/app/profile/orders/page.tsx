'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getMyOrders, Order } from '@/services/ordersService';
import { useLanguage } from '@/context/LanguageContext';

function fmt(n: number) { return `₪${Number(n).toFixed(2)}`; }

function StatusBadge({ status }: { status: string }) {
  const colours: Record<string, string> = {
    paid:      'bg-green-100 text-green-700',
    pending:   'bg-yellow-100 text-yellow-700',
    cancelled: 'bg-gray-100  text-gray-600',
    failed:    'bg-red-100   text-red-600',
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize ${colours[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {status}
    </span>
  );
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return '—';
  const s = iso.endsWith('Z') ? iso : iso + 'Z';
  return new Date(s).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function MyOrdersPage() {
  const { t } = useLanguage();
  const st = t.store;
  const router = useRouter();

  const [orders,  setOrders]  = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    getMyOrders()
      .then(setOrders)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load orders.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-[var(--color-muted)]">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4 transition"
        >
          ← {t.common.back ?? 'Back'}
        </button>

        <h1 className="text-2xl font-bold text-gray-900 mb-6">{st.myOrders}</h1>

        {loading && (
          <div className="text-center py-12 text-gray-400">{t.common.loading}</div>
        )}

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">{error}</div>
        )}

        {!loading && !error && orders.length === 0 && (
          <div className="bg-white rounded-2xl border border-[var(--color-border)] p-12 text-center">
            <p className="text-4xl mb-3">📦</p>
            <p className="text-lg font-semibold text-gray-700 mb-1">No orders yet</p>
            <p className="text-sm text-gray-500 mb-6">Your order history will appear here after your first purchase.</p>
            <Link
              href="/visitor/products"
              className="inline-block bg-[var(--color-primary)] text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:opacity-90 transition"
            >
              {st.continueShopping}
            </Link>
          </div>
        )}

        {!loading && orders.length > 0 && (
          <div className="flex flex-col gap-3">
            {orders.map((order) => (
              <Link
                key={order.orderId}
                href={`/profile/orders/${order.orderId}`}
                className="bg-white rounded-xl border border-[var(--color-border)] p-4 hover:border-[var(--color-primary)] transition block no-underline"
                data-testid={`order-row-${order.orderId}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-semibold text-gray-900 font-mono text-sm">{order.orderNumber}</span>
                      <StatusBadge status={order.status} />
                    </div>
                    <p className="text-xs text-gray-500">{formatDate(order.createdAtUtc)}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {order.items.length} {order.items.length === 1 ? 'item' : 'items'} ·{' '}
                      {order.paymentMethod === 'paypal' ? 'PayPal' : 'Credit Card'}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-base font-bold text-gray-900" dir="ltr">{fmt(order.totalAmount)}</p>
                    <p className="text-[11px] text-[var(--color-primary)] mt-1">View details →</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
