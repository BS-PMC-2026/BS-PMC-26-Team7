'use client';

import { useState, useEffect, useCallback } from 'react';
import ProductCard from '@/components/products/ProductCard';
import Alert from '@/components/ui/Alert';
import EmptyState from '@/components/ui/EmptyState';
import PageHeader from '@/components/ui/PageHeader';
import { getProducts } from '@/services/productService';
import { ProductResponse } from '@/services/productService';

export default function WorkerProductsPage() {
  const [products, setProducts] = useState<ProductResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
const [selectedCategory, setSelectedCategory] = useState('');
const [sortBy, setSortBy] = useState('');

  const loadProducts = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await getProducts();
      setProducts(data);
    } catch {
      setLoadError('Failed to load products. Is the backend running?');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);
  const categories = [
  ...new Set(products.map((p) => p.Category).filter(Boolean)),
];

const filteredAndSortedProducts = products
  .filter((product) => {
    const name = product.ProductName?.toLowerCase() || '';
    const description = product.ProductDescription?.toLowerCase() || '';
    const search = searchTerm.toLowerCase();

    const matchesSearch =
      name.includes(search) || description.includes(search);

    const matchesCategory =
      selectedCategory === '' || product.Category === selectedCategory;

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
          <PageHeader
            label="PepperFarm"
            title="Product Catalog"
            subtitle="Browse all products available from our farm"
          />
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="mb-6 flex flex-col md:flex-row gap-4">
  <input
    type="text"
    placeholder="Search products..."
    value={searchTerm}
    onChange={(e) => setSearchTerm(e.target.value)}
    className="flex-1 rounded-lg border border-[var(--color-border)] px-4 py-3 bg-white"
  />

  <select
    value={selectedCategory}
    onChange={(e) => setSelectedCategory(e.target.value)}
    className="rounded-lg border border-[var(--color-border)] px-4 py-3 bg-white"
  >
    <option value="">All Categories</option>
    {categories.map((category) => (
      <option key={category} value={category ?? ''}>
        {category}
      </option>
    ))}
  </select>

  <select
    value={sortBy}
    onChange={(e) => setSortBy(e.target.value)}
    className="rounded-lg border border-[var(--color-border)] px-4 py-3 bg-white"
  >
    <option value="">Sort By</option>
    <option value="name">Name A-Z</option>
    <option value="priceLow">Price Low to High</option>
    <option value="priceHigh">Price High to Low</option>
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
            title="No products available"
            description="Check back later."
          />
          ) : filteredAndSortedProducts.length === 0 ? (
  <EmptyState
    icon="🔍"
    title="No products found"
    description="Try changing the search, category, or sorting."
  />
        ) : (
          <>
            <p className="text-xs text-[var(--color-muted-foreground)] mb-4">
              {filteredAndSortedProducts.length}{' '} {products.length === 1 ? 'product' : 'products'}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredAndSortedProducts.map((product) => (
                <ProductCard key={product.ProductId} product={product} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
