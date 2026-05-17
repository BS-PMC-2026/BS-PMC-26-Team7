'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import ProductCard from '@/components/products/ProductCard';
import Alert from '@/components/ui/Alert';
import EmptyState from '@/components/ui/EmptyState';
import PageHeader from '@/components/ui/PageHeader';
import { getProducts, ProductResponse } from '@/services/productService';

export default function ManagerProductsPage() {
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
      setLoadError('Failed to load products. Is the backend running?');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  return (
    <div className="min-h-screen">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-10">
          <div className="flex items-start justify-between">
            <PageHeader
              label="PepperFarm"
              title="Product Catalog"
              subtitle="Browse and manage all products"
            />
            <div className="mt-1">
              <Link
                href="/manager/products/create"
                className="bg-black text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition"
              >
                + Add New Product
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {loadError && (
          <Alert variant="info" className="mb-6">{loadError}</Alert>
        )}

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden animate-pulse">
                <div className="w-full h-48 bg-gray-100" />
                <div className="p-4 flex flex-col gap-2">
                  <div className="h-3.5 bg-gray-100 rounded w-3/4" />
                  <div className="h-3 bg-gray-100 rounded w-1/2" />
                  <div className="h-3 bg-gray-100 rounded w-full mt-1" />
                  <div className="h-3 bg-gray-100 rounded w-5/6" />
                </div>
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <EmptyState icon="🛒" title="No products available" description="Add your first product using the button above." />
        ) : (
          <>
            <p className="text-xs text-gray-400 mb-4">
              {products.length} {products.length === 1 ? 'product' : 'products'}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {products.map((product) => (
                <ProductCard key={product.ProductId} product={product} showEditButton />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}