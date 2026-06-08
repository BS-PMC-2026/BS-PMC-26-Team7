'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  getCart,
  updateCartItem,
  removeCartItem,
  CartSummary,
  CartLineItem,
} from '@/services/cartService';
import { useLanguage } from '@/context/LanguageContext';
import { useLoading } from '@/context/LoadingContext';
import PepperSpinnerLoader from '@/components/ui/PepperSpinnerLoader';

function fmt(n: number) {
  return `₪${Number(n).toFixed(2)}`;
}

/** Return the products route for the current user's role (read from JWT in localStorage). */
function productsRoute(): string {
  try {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) return '/visitor/products';
    const payload = JSON.parse(atob(token.split('.')[1]));
    const role = (payload.role ?? payload.Role ?? '') as string;
    if (role === 'Worker') return '/worker/products';
    if (role === 'FarmManager') return '/manager/products';
    return '/visitor/products';
  } catch {
    return '/visitor/products';
  }
}

export default function CartPage() {
  const { t } = useLanguage();
  const st = t.store;
  const router = useRouter();
  const { startRouteLoader } = useLoading();

  const [cart, setCart]         = useState<CartSummary | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [coupon, setCoupon]     = useState('');
  const [couponErr, setCouponErr] = useState<string | null>(null);
  const [updating, setUpdating] = useState<number | null>(null);

  const loadCart = useCallback(async (code?: string) => {
    if (typeof window !== 'undefined' && !localStorage.getItem('token')) {
      startRouteLoader();
      router.replace('/login?redirect=/cart');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await getCart(code);
      setCart(data);
      if (code && data.coupon && !data.coupon.valid) {
        setCouponErr(st.couponInvalid);
      } else {
        setCouponErr(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load cart.');
    } finally {
      setLoading(false);
    }
  }, [router, startRouteLoader, st.couponInvalid]);

  useEffect(() => { loadCart(); }, [loadCart]);

  async function handleQty(item: CartLineItem, delta: number) {
    const newQty = item.quantity + delta;
    if (newQty < 1) return handleRemove(item);
    setUpdating(item.cartItemId);
    try {
      const updated = await updateCartItem(item.cartItemId, newQty);
      setCart(updated);
    } catch { /* ignore */ }
    finally { setUpdating(null); }
  }

  async function handleRemove(item: CartLineItem) {
    setUpdating(item.cartItemId);
    try {
      const updated = await removeCartItem(item.cartItemId);
      setCart(updated);
    } catch { /* ignore */ }
    finally { setUpdating(null); }
  }

  function handleApplyCoupon() {
    if (!coupon.trim()) return;
    loadCart(coupon.trim());
  }

  function handleRemoveCoupon() {
    setCoupon('');
    loadCart();
  }

  if (loading) {
    return <PepperSpinnerLoader minDelay={250} />;
  }

  if (error) {
    return (
      <div className="app-page-bg flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 text-sm mb-3">{error}</p>
          <button onClick={() => loadCart()} className="text-sm text-[var(--color-primary)] underline">
            {t.common.refresh}
          </button>
        </div>
      </div>
    );
  }

  const isEmpty = !cart || cart.items.length === 0;

  return (
    <div className="app-page-bg">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Back to products */}
        <Link
          href={productsRoute()}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4 transition"
          data-testid="back-to-products"
        >
          ← {st.continueShopping}
        </Link>

        <h1 className="text-2xl font-bold text-gray-900 mb-6">{st.cart}</h1>

        {isEmpty ? (
          <div className="bg-white rounded-2xl border border-[var(--color-border)] p-12 text-center" data-testid="cart-empty">
            <p className="text-4xl mb-4">🛒</p>
            <p className="text-lg font-semibold text-gray-700 mb-1">{st.cartEmpty}</p>
            <p className="text-sm text-gray-500 mb-6">{st.cartEmptyDesc}</p>
            <Link
              href={productsRoute()}
              className="inline-block bg-[var(--color-primary)] text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:opacity-90 transition"
              data-testid="continue-shopping-link"
            >
              {st.continueShopping}
            </Link>
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Items list */}
            <div className="flex-1 flex flex-col gap-3">
              {cart!.items.map((item) => (
                <div
                  key={item.cartItemId}
                  className="bg-white rounded-xl border border-[var(--color-border)] p-4 flex gap-4"
                  data-testid={`cart-item-${item.productId}`}
                >
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.productName}
                      className="w-16 h-16 object-cover rounded-lg shrink-0"
                    />
                  ) : (
                    <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center shrink-0">
                      <span className="text-2xl">🌶️</span>
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{item.productName}</p>

                    {/* Price */}
                    <div className="mt-1 flex items-center gap-2 flex-wrap">
                      {item.unitPriceOriginal !== item.unitPriceForUser ? (
                        <>
                          <span className="text-xs text-gray-400 line-through" dir="ltr">
                            {fmt(item.unitPriceOriginal)}
                          </span>
                          <span className="text-sm font-bold text-green-700" dir="ltr">
                            {fmt(item.unitPriceForUser)}
                          </span>
                        </>
                      ) : (
                        <span className="text-sm font-bold text-gray-800" dir="ltr">
                          {fmt(item.unitPriceForUser)}
                        </span>
                      )}
                      {item.employeeDiscountPct && (
                        <span className="text-[10px] bg-blue-100 text-blue-700 rounded-full px-1.5 py-0.5 font-medium">
                          {st.employeeDiscount}
                        </span>
                      )}
                    </div>

                    {/* Stock warning */}
                    {item.stockWarning && (
                      <p className="text-[11px] text-amber-600 mt-0.5" data-testid="stock-warning">
                        {item.stockWarning}
                      </p>
                    )}
                    {!item.isAvailable && (
                      <p className="text-[11px] text-red-600 mt-0.5">{st.itemUnavailable}</p>
                    )}
                  </div>

                  {/* Qty controls */}
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleQty(item, -1)}
                        disabled={updating === item.cartItemId}
                        data-testid={`qty-minus-${item.cartItemId}`}
                        className="w-6 h-6 rounded border border-gray-300 text-gray-600 text-sm flex items-center justify-center hover:bg-gray-50 disabled:opacity-40"
                      >
                        −
                      </button>
                      <span className="text-sm font-medium w-6 text-center" data-testid={`qty-${item.cartItemId}`}>
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => handleQty(item, 1)}
                        disabled={updating === item.cartItemId || item.quantity >= item.availableStock}
                        data-testid={`qty-plus-${item.cartItemId}`}
                        className="w-6 h-6 rounded border border-gray-300 text-gray-600 text-sm flex items-center justify-center hover:bg-gray-50 disabled:opacity-40"
                      >
                        +
                      </button>
                    </div>
                    <p className="text-sm font-bold text-gray-900" dir="ltr">{fmt(item.lineTotal)}</p>
                    <button
                      onClick={() => handleRemove(item)}
                      disabled={updating === item.cartItemId}
                      data-testid={`remove-${item.cartItemId}`}
                      className="text-[11px] text-red-500 hover:underline disabled:opacity-40"
                    >
                      {st.removeItem}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Summary panel */}
            <div className="w-full lg:w-72 shrink-0">
              <div className="bg-white rounded-xl border border-[var(--color-border)] p-4 sticky top-4">
                {/* Coupon */}
                {cart!.coupon?.valid ? (
                  <div className="mb-4 p-2.5 bg-green-50 rounded-lg border border-green-200 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-green-700">{st.couponApplied}</p>
                      <p className="text-[11px] text-green-600">{cart!.coupon.couponCode}</p>
                    </div>
                    <button
                      onClick={handleRemoveCoupon}
                      data-testid="remove-coupon-btn"
                      className="text-[11px] text-red-500 hover:underline"
                    >
                      {st.removeCoupon}
                    </button>
                  </div>
                ) : (
                  <div className="mb-4">
                    <label className="text-xs font-medium text-gray-700 block mb-1">{st.couponCode}</label>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={coupon}
                        onChange={(e) => setCoupon(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleApplyCoupon()}
                        disabled={updating !== null}
                        placeholder="CODE"
                        data-testid="coupon-input"
                        className="flex-1 border border-gray-300 rounded-md px-2 py-1.5 text-xs focus:outline-none focus:border-[var(--color-primary)]"
                      />
                      <button
                        onClick={handleApplyCoupon}
                        disabled={updating !== null}
                        data-testid="apply-coupon-btn"
                        className="bg-[var(--color-primary)] text-white text-xs px-3 rounded-md hover:opacity-90 disabled:opacity-40"
                      >
                        {st.applyCoupon}
                      </button>
                    </div>
                    {couponErr && (
                      <p className="text-[11px] text-red-500 mt-1" data-testid="coupon-error">{couponErr}</p>
                    )}
                  </div>
                )}

                {/* Price breakdown */}
                <div className="flex flex-col gap-1.5 text-xs border-t border-gray-100 pt-3">
                  <div className="flex justify-between text-gray-600">
                    <span>{st.subtotal}</span>
                    <span dir="ltr">{fmt(cart!.originalSubtotal)}</span>
                  </div>
                  {cart!.productDiscountTotal > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>− {st.productDiscount}</span>
                      <span dir="ltr">−{fmt(cart!.productDiscountTotal)}</span>
                    </div>
                  )}
                  {cart!.employeeDiscountTotal > 0 && (
                    <div className="flex justify-between text-blue-600">
                      <span>− {st.employeeDiscount}</span>
                      <span dir="ltr">−{fmt(cart!.employeeDiscountTotal)}</span>
                    </div>
                  )}
                  {cart!.couponDiscountTotal > 0 && (
                    <div className="flex justify-between text-purple-600">
                      <span>− {st.couponDiscount}</span>
                      <span dir="ltr">−{fmt(cart!.couponDiscountTotal)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-gray-900 text-sm border-t border-gray-100 pt-2 mt-1">
                    <span>{st.total}</span>
                    <span dir="ltr">{fmt(cart!.finalTotal)}</span>
                  </div>
                </div>

                <button
                  onClick={() => {
                    startRouteLoader();
                    router.push('/checkout');
                  }}
                  disabled={cart!.hasBlockingIssues}
                  data-testid="proceed-to-checkout-btn"
                  className="mt-4 w-full bg-[var(--color-primary)] text-white rounded-lg py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-40 transition"
                >
                  {st.proceedToCheckout}
                </button>

                <Link
                  href="/visitor/products"
                  className="mt-2 block text-center text-xs text-[var(--color-primary)] hover:underline"
                >
                  {st.continueShopping}
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
