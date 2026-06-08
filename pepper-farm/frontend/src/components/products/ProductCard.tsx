'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import { ProductResponse , deleteProduct } from '@/services/productService';
import { addToCart } from '@/services/cartService';
import { useLanguage } from '@/context/LanguageContext';
import { normalizeProductCategoryForDisplay } from '@/lib/displayNormalization';

interface ProductCardProps {
  product: ProductResponse;
  showEditButton?: boolean;
}

/**
 * The backend stores datetimes as naive UTC and FastAPI serialises them without
 * a 'Z' suffix.  JavaScript's Date constructor treats strings without a timezone
 * marker as **local time**, not UTC, which breaks comparisons in non-UTC zones.
 * Appending 'Z' forces correct UTC interpretation.
 */
function parseUtcDate(isoStr: string): Date {
  return new Date(
    isoStr.endsWith('Z') || isoStr.includes('+') ? isoStr : isoStr + 'Z'
  );
}

/** Frontend safety check: re-validates expiry even if backend already computed it. */
function isDiscountCurrentlyActive(product: ProductResponse): boolean {
  if (!product.DiscountActive || !product.DiscountIsCurrentlyValid) return false;
  const now = new Date();
  if (product.DiscountStartDate && parseUtcDate(product.DiscountStartDate) > now) return false;
  if (product.DiscountEndDate && parseUtcDate(product.DiscountEndDate) < now) return false;
  return true;
}

export default function ProductCard({ product, showEditButton = false }: ProductCardProps) {
  const { t, locale } = useLanguage();
  const router = useRouter();
  const pathname = usePathname();
  const pr = t.products;
  const outOfStock = product.AllocatedQuantity === 0;
  const discountValid = isDiscountCurrentlyActive(product);
  const displayPrice = discountValid ? product.FinalPrice : product.Price;

  const [userRole, setUserRole] = useState<string | null>(null);
  const [addingToCart, setAddingToCart] = useState(false);
  const [cartMsg, setCartMsg] = useState<string | null>(null);

  useEffect(() => {
    try {
      const token = localStorage.getItem('token');
      if (token) {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setUserRole(payload.role ?? payload.Role ?? null);
      }
    } catch { /* ignore */ }
  }, []);

  const isWorker = userRole === 'Worker';

  function hasToken(): boolean {
    return typeof window !== 'undefined' && Boolean(localStorage.getItem('token'));
  }

  function goToLoginAfter(path: string) {
    router.push(`/login?redirect=${encodeURIComponent(path)}`);
  }

  async function handleAddToCart() {
    if (!hasToken()) {
      goToLoginAfter(pathname || '/visitor/products');
      return;
    }
    setAddingToCart(true);
    setCartMsg(null);
    try {
      await addToCart(product.ProductId, 1);
      setCartMsg('✓');
      setTimeout(() => setCartMsg(null), 1500);
    } catch {
      setCartMsg('!');
      setTimeout(() => setCartMsg(null), 2000);
    } finally {
      setAddingToCart(false);
    }
  }

  function handleBuyNow() {
    const checkoutPath = `/checkout?productId=${product.ProductId}&qty=1`;
    if (!hasToken()) {
      goToLoginAfter(checkoutPath);
      return;
    }
    router.push(checkoutPath);
  }
  async function handleDelete() {
  const confirmed = window.confirm(
    'Are you sure you want to delete this product?'
  );

  if (!confirmed) return;

  try {
    await deleteProduct(product.ProductId);

    alert('Product deleted successfully.');

    window.location.reload();
  } catch {
    alert('Failed to delete product.');
  }
}

  return (
    <Card
      className={`overflow-hidden flex flex-col transition rounded-2xl ${
        outOfStock ? 'opacity-50 hover:shadow-none' : 'hover:shadow-md'
      }`}
    >
      <div className="relative w-full h-48 bg-gray-50 flex items-center justify-center overflow-hidden border-b border-gray-100">
        {product.ImageUrl ? (
          <img
            src={product.ImageUrl}
            alt={product.ProductName}
            className="w-full h-full object-cover"
            onError={(e) => {
              const img = e.currentTarget as HTMLImageElement;
              img.style.display = 'none';
              const parent = img.parentElement as HTMLElement;
              parent.innerHTML = '<span style="font-size:2.5rem">🛒</span>';
            }}
          />
        ) : (
          <span className="text-5xl opacity-30">🛒</span>
        )}

        {outOfStock && (
          <span className="absolute top-2 left-2 rounded-full bg-red-600 text-white text-[10px] font-semibold px-2 py-0.5 uppercase tracking-wide">
            {pr.outOfStock}
          </span>
        )}

        {discountValid && (
          <span className="absolute top-2 right-2 rounded-full bg-green-600 text-white text-[10px] font-semibold px-2 py-0.5 uppercase tracking-wide">
            {Math.round(product.DiscountPercentage)}{pr.discountOff}
          </span>
        )}
      </div>

      <div className="p-4 flex flex-col gap-2 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold text-gray-900 leading-snug">{product.ProductName}</h3>
          {product.Category && (
            <Badge className="bg-gray-100 text-gray-600 border border-gray-200 shrink-0">{normalizeProductCategoryForDisplay(product.Category, locale)}</Badge>
          )}
        </div>

        {product.ProductDescription && (
          <p className="text-xs text-gray-500 leading-relaxed line-clamp-3 mt-0.5">{product.ProductDescription}</p>
        )}

        <div className="flex items-center justify-between mt-auto pt-2 border-t border-gray-100">
          <div>
            {discountValid ? (
              <>
                <p className="text-xs text-gray-400 line-through" dir="ltr">
                  ${Number(product.Price).toFixed(2)}
                </p>
                <p className="text-sm font-bold text-green-700" dir="ltr">
                  ${Number(displayPrice).toFixed(2)}
                </p>
                <p className="text-[10px] text-gray-500 mt-0.5">
                  {product.DiscountEndDate
                    ? `${pr.discountEnds} ${parseUtcDate(product.DiscountEndDate).toLocaleDateString()}`
                    : pr.discountUnlimited}
                </p>
              </>
            ) : (
              <p className="text-sm font-bold text-gray-900" dir="ltr">
                ${Number(product.Price).toFixed(2)}
              </p>
            )}
          </div>
          <p className={`text-xs font-medium ${outOfStock ? 'text-red-600' : 'text-gray-600'}`} dir="ltr">
            {outOfStock ? pr.outOfStock : `${product.AllocatedQuantity} ${pr.unitsLeft}`}
          </p>
        </div>

        {showEditButton && (
  <div className="mt-2 flex gap-2">
    <Link
      href={`/manager/products/${product.ProductId}/edit`}
      className="flex-1 text-center rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition"
    >
      {pr.editProduct}
    </Link>

    <button
      onClick={handleDelete}
      className="flex-1 rounded-md border border-red-500 text-red-600 px-3 py-1.5 text-xs font-medium hover:bg-red-50 transition"
    >
      Delete
    </button>
  </div>
)}

        {!showEditButton && (
          <div className="flex gap-2 mt-2">
            <button
              onClick={handleAddToCart}
              disabled={outOfStock || addingToCart}
              data-testid="add-to-cart-btn"
              className="flex-1 rounded-md bg-[var(--color-primary)] text-white px-3 py-1.5 text-xs font-medium hover:opacity-90 disabled:opacity-40 transition"
            >
              {addingToCart ? '...' : cartMsg === '✓' ? '✓' : st.addToCart}
            </button>
            <button
              onClick={handleBuyNow}
              disabled={outOfStock}
              data-testid="buy-now-btn"
              className="flex-1 rounded-md border border-[var(--color-primary)] text-[var(--color-primary)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--color-secondary-light)] disabled:opacity-40 transition"
            >
              {st.buyNow}
            </button>
          </div>
        )}
      </div>
    </Card>
  );
}
