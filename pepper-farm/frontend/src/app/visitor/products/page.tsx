'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import ProductCard from '@/components/products/ProductCard';
import Alert from '@/components/ui/Alert';
import EmptyState from '@/components/ui/EmptyState';
import PageHeader from '@/components/ui/PageHeader';
import { getProducts } from '@/services/productService';
import { ProductResponse } from '@/services/productService';
import { useLanguage } from '@/context/LanguageContext';

export default function VisitorProductsPage() {
  const { t } = useLanguage();
  const vi = t.visitor;
  const [products, setProducts] = useState<ProductResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadProducts = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await getProducts();
      setProducts(data);
    } catch {
      setLoadError(vi.failedToLoadProducts);
    } finally {
      setIsLoading(false);
    }
  }, [vi.failedToLoadProducts]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  return (
    <div className="min-h-screen bg-[var(--color-muted)]">
      <div className="bg-white border-b border-[var(--color-border)]">
        <div className="max-w-6xl mx-auto px-6 py-10">
          <div className="flex items-start justify-between">
            <PageHeader
              label={vi.label}
              title={vi.productCatalogTitle}
              subtitle={vi.productCatalogSubtitle}
            />
            <div className="flex gap-3 mt-1">
              <Link
                href="/login"
                className="border border-[var(--color-primary)] text-[var(--color-primary)] px-4 py-2 rounded-lg text-sm font-medium hover:bg-[var(--color-secondary-light)] transition"
              >
                {vi.login}
              </Link>
              <Link
                href="/register"
                className="bg-[var(--color-primary)] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[var(--color-primary-hover)] transition"
              >
                {vi.register}
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {loadError && (
          <Alert variant="info" className="mb-6">
            {loadError}
          </Alert>
        )}

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="bg-white rounded-2xl border border-[var(--color-border)] shadow-sm overflow-hidden animate-pulse"
              >
                <div className="w-full h-48 bg-[var(--color-muted)]" />
                <div className="p-4 flex flex-col gap-2">
                  <div className="h-3.5 bg-[var(--color-muted)] rounded w-3/4" />
                  <div className="h-3 bg-[var(--color-muted)] rounded w-1/2" />
                  <div className="h-3 bg-[var(--color-muted)] rounded w-full mt-1" />
                  <div className="h-3 bg-[var(--color-muted)] rounded w-5/6" />
                </div>
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <EmptyState
            icon="🛒"
            title={vi.noProductsAvailable}
            description={vi.checkBackLater}
          />
        ) : (
          <>
            <p className="text-xs text-[var(--color-muted-foreground)] mb-4" dir="ltr">
              {products.length} {products.length === 1 ? t.common.product : t.common.products}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {products.map((product) => (
                <ProductCard key={product.ProductId} product={product} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}