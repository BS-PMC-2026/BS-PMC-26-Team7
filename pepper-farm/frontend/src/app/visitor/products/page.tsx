'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import ProductCard from '@/components/products/ProductCard';
import Alert from '@/components/ui/Alert';
import EmptyState from '@/components/ui/EmptyState';
import PageHeader from '@/components/ui/PageHeader';
import { getProducts } from '@/services/productService';
import { ProductResponse } from '@/services/productService';
import { getMyConsent, updateMyConsent } from '@/services/emailConsentService';
import { useLanguage } from '@/context/LanguageContext';
import { normalizeProductCategoryForDisplay } from '@/lib/displayNormalization';

export default function VisitorProductsPage() {
  const { t, locale } = useLanguage();
  const vi = t.visitor;
  const router = useRouter();
  const [products,        setProducts]        = useState<ProductResponse[]>([]);
  const [isLoading,       setIsLoading]       = useState(true);
  const [loadError,       setLoadError]       = useState<string | null>(null);

  // Fix D+G: determine auth state without clearing it
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    setIsAuthenticated(!!token);
  }, []);

  // Fix D: email subscription state for logged-in visitors
  const [subscribed,      setSubscribed]      = useState<boolean | null>(null);
  const [subLoading,      setSubLoading]      = useState(false);
  const [subMsg,          setSubMsg]          = useState('');
  const [subErr,          setSubErr]          = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [sortBy, setSortBy] = useState('');

  useEffect(() => {
    if (!isAuthenticated) return;
    getMyConsent()
      .then((s) => setSubscribed(s.emailConsent))
      .catch(() => {/* consent API unavailable — hide section */});
  }, [isAuthenticated]);

  async function handleSubscribe() {
    setSubLoading(true); setSubMsg(''); setSubErr('');
    try {
      const updated = await updateMyConsent(true);
      setSubscribed(updated.emailConsent);
      setSubMsg(t.consent.subscriptionUpdated);
    } catch (e) {
      setSubErr(e instanceof Error ? e.message : vi.failedToUpdateSubscription);
    } finally {
      setSubLoading(false); }
  }

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

  const categories = [
  ...new Set(products.map((p) => p.Category).filter(Boolean)),
];

const filteredProducts = products
  .filter((product) => {
    const name = product.ProductName?.toLowerCase() || '';
    const description = product.ProductDescription?.toLowerCase() || '';

    const matchesSearch =
      name.includes(searchTerm.toLowerCase()) ||
      description.includes(searchTerm.toLowerCase());

    const matchesCategory =
      selectedCategory === '' ||
      product.Category === selectedCategory;

    return matchesSearch && matchesCategory;
  })
  .sort((a, b) => {
    if (sortBy === 'name') {
      return a.ProductName.localeCompare(b.ProductName);
    }

    if (sortBy === 'priceLow') {
      return a.Price - b.Price;
    }

    if (sortBy === 'priceHigh') {
      return b.Price - a.Price;
    }

    return 0;
  });

  return (
    <div className="app-page-bg">
      <div className="bg-white border-b border-[var(--color-border)]">
        <div className="max-w-6xl mx-auto px-6 py-10">
          <div className="flex items-start justify-between">
            <PageHeader
              label={vi.label}
              title={vi.productCatalogTitle}
              subtitle={vi.productCatalogSubtitle}
            />
            {/* Fix D: Show Login/Register only when NOT authenticated */}
            {!isAuthenticated && (
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
            )}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="mb-6 flex flex-col md:flex-row gap-4">
  <input
    type="text"
    placeholder={vi.productSearchPlaceholder}
    aria-label={vi.productSearchPlaceholder}
    value={searchTerm}
    onChange={(e) => setSearchTerm(e.target.value)}
    className="flex-1 rounded-lg border border-[var(--color-border)] px-4 py-3 bg-white"
  />

  <select
    value={selectedCategory}
    aria-label={vi.productsAllCategories}
    onChange={(e) => setSelectedCategory(e.target.value)}
    className="rounded-lg border border-[var(--color-border)] px-4 py-3 bg-white"
  >
    <option value="">{vi.productsAllCategories}</option>

    {categories.map((category) => (
      <option key={category} value={category ?? ''}>
        {normalizeProductCategoryForDisplay(category, locale)}
      </option>
    ))}
  </select>
  <select
  value={sortBy}
  aria-label={vi.productsSortBy}
  onChange={(e) => setSortBy(e.target.value)}
  className="rounded-lg border border-[var(--color-border)] px-4 py-3 bg-white"
>
  <option value="">{vi.productsSortBy}</option>
  <option value="name">{vi.productsSortName}</option>
  <option value="priceLow">{vi.productsSortPriceLow}</option>
  <option value="priceHigh">{vi.productsSortPriceHigh}</option>
</select>
</div>
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
          ) : filteredProducts.length === 0 ? (
  <EmptyState
    icon="🔍"
    title={vi.noProductsFound}
    description={vi.noProductsFoundDesc}
  />
          
        ) : (
          <>
            <p className="text-xs text-[var(--color-muted-foreground)] mb-4" dir="ltr">
              {filteredProducts.length} {products.length === 1 ? t.common.product : t.common.products}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredProducts.map((product) => (
                <ProductCard key={product.ProductId} product={product} />
              ))}
            </div>
          </>
        )}

        {/* Fix D: Subscribe-again section — only for logged-in Visitor/Customer */}
        {isAuthenticated && subscribed !== null && (
          <div className="mt-12 border-t border-[var(--color-border)] pt-8" data-testid="subscribe-section">
            {subscribed ? (
              <p className="text-sm text-[var(--color-muted-foreground)]" data-testid="subscribe-status-subscribed">
                ✓ {t.consent.subscribed} — {t.consent.receiveNewsletterEmails.toLowerCase()}.
                {' '}
                <span className="text-xs text-[var(--color-muted-foreground)]">
                  ({vi.unsubscribeAvailableHint})
                </span>
              </p>
            ) : (
              <div>
                <p className="text-sm text-[var(--color-muted-foreground)] mb-3" data-testid="subscribe-status-unsubscribed">
                  {t.consent.unsubscribed} — {t.consent.receiveNewsletterEmails}.
                </p>
                {subMsg && <p className="text-sm text-green-700 mb-2" data-testid="subscribe-success">{subMsg}</p>}
                {subErr && <p className="text-sm text-red-600 mb-2" data-testid="subscribe-error">{subErr}</p>}
                <button
                  onClick={handleSubscribe}
                  disabled={subLoading}
                  className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm text-white hover:opacity-90 disabled:opacity-50 transition"
                  data-testid="subscribe-again-btn"
                >
                  {subLoading ? t.common.saving : t.consent.updateSubscription}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
