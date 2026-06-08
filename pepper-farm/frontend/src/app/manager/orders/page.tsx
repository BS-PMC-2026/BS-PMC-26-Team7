'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getAllOrders, OrderWithBuyer } from '@/services/ordersService';
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
  return new Date(s).toLocaleString();
}

export default function ManagerOrdersPage() {
  const { t } = useLanguage();

  const [orders,  setOrders]  = useState<OrderWithBuyer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [search,  setSearch]  = useState('');
  const [filter,  setFilter]  = useState<'all' | 'paid' | 'pending' | 'failed'>('all');

  useEffect(() => {
    getAllOrders()
      .then(setOrders)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load orders.'))
      .finally(() => setLoading(false));
  }, []);

  const displayed = orders.filter((o) => {
    if (filter !== 'all' && o.status !== filter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        o.orderNumber.toLowerCase().includes(q) ||
        (o.buyerName  ?? '').toLowerCase().includes(q) ||
        (o.buyerEmail ?? '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const totalRevenue = orders
    .filter((o) => o.status === 'paid')
    .reduce((sum, o) => sum + o.totalAmount, 0);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Order Management</h1>
      <p className="text-sm text-gray-500 mb-6">All customer and worker orders.</p>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total Orders',   value: String(orders.length),                                 colour: 'text-gray-900' },
          { label: 'Paid',           value: String(orders.filter((o) => o.status === 'paid').length), colour: 'text-green-700' },
          { label: 'Pending',        value: String(orders.filter((o) => o.status === 'pending').length), colour: 'text-yellow-700' },
          { label: 'Total Revenue',  value: fmt(totalRevenue),                                     colour: 'text-[var(--color-primary)]' },
        ].map((card) => (
          <div key={card.label} className="bg-white rounded-xl border border-[var(--color-border)] p-4">
            <p className="text-xs text-gray-500 mb-1">{card.label}</p>
            <p className={`text-xl font-bold ${card.colour}`}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Filters + search */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by order #, buyer name or email…"
          className="flex-1 border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-primary)]"
        />
        <div className="flex gap-1">
          {(['all', 'paid', 'pending', 'failed'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs rounded-lg font-medium transition capitalize ${
                filter === f
                  ? 'bg-[var(--color-primary)] text-white'
                  : 'border border-[var(--color-border)] hover:bg-[var(--color-muted)]'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {loading && <div className="text-center py-12 text-gray-400">{t.common.loading}</div>}
      {error   && <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-600 mb-4">{error}</div>}

      {!loading && displayed.length === 0 && (
        <div className="bg-white rounded-xl border border-[var(--color-border)] p-10 text-center text-gray-400 text-sm">
          No orders found.
        </div>
      )}

      {!loading && displayed.length > 0 && (
        <div className="bg-white rounded-xl border border-[var(--color-border)] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-muted)] text-gray-500 text-xs">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Order #</th>
                <th className="px-4 py-3 text-left font-medium">Buyer</th>
                <th className="px-4 py-3 text-left font-medium">Date</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Payment</th>
                <th className="px-4 py-3 text-right font-medium">Total</th>
                <th className="px-4 py-3 text-left font-medium">Items</th>
              </tr>
            </thead>
            <tbody>
              {displayed.map((order, idx) => (
                <tr
                  key={order.orderId}
                  className={`border-t border-[var(--color-border)] hover:bg-[var(--color-muted)]/40 transition ${idx % 2 === 0 ? '' : 'bg-gray-50/30'}`}
                  data-testid={`manager-order-row-${order.orderId}`}
                >
                  <td className="px-4 py-3 text-xs text-gray-800">{order.orderNumber}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-800 text-xs">{order.buyerName ?? '—'}</p>
                    <p className="text-[10px] text-gray-400">{order.buyerEmail ?? ''}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">{formatDate(order.createdAtUtc)}</td>
                  <td className="px-4 py-3"><StatusBadge status={order.status} /></td>
                  <td className="px-4 py-3 text-xs text-gray-600 capitalize">
                    {order.paymentMethod === 'paypal' ? 'PayPal' : 'Credit Card'}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-gray-900 text-xs" dir="ltr">
                    {fmt(order.totalAmount)}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    {order.items.length} item{order.items.length !== 1 ? 's' : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="border-t border-[var(--color-border)] px-4 py-2 text-xs text-gray-400">
            Showing {displayed.length} of {orders.length} orders
          </div>
        </div>
      )}
    </div>
  );
}
