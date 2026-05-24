'use client';

import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getAllPeppers } from '@/services/peppers';
import {
  getProductById,
  updateProduct,
  ProductCreatePayload,
} from '@/services/productService';

type PepperOption = {
  PepperId: number;
  PepperName: string;
  IsActive: boolean;
};

type FormState = {
  ProductName: string;
  ProductDescription: string;
  Category: string;
  Price: string;
  ImageUrl: string;
  PepperId: string;
  IsActive: boolean;
};

function normalizeOptionalText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function validateForm(form: FormState): string | null {
  if (!form.ProductName.trim()) return 'Product name is required.';
  if (!form.Price.trim()) return 'Price is required.';
  const parsedPrice = Number(form.Price);
  if (Number.isNaN(parsedPrice)) return 'Price must be a valid number.';
  if (parsedPrice < 0) return 'Price must be non-negative.';
  const imageUrl = form.ImageUrl.trim();
  if (
    imageUrl &&
    !(imageUrl.startsWith('http://') || imageUrl.startsWith('https://') || imageUrl.startsWith('/uploads/'))
  ) {
    return 'Image URL must start with http://, https://, or /uploads/.';
  }
  if (form.PepperId) {
    const pepperId = Number(form.PepperId);
    if (Number.isNaN(pepperId) || pepperId <= 0) return 'Selected pepper variety is invalid.';
  }
  return null;
}

export default function EditProductPage() {
  const { productId } = useParams<{ productId: string }>();
  const router = useRouter();

  const [form, setForm] = useState<FormState>({
    ProductName: '',
    ProductDescription: '',
    Category: '',
    Price: '',
    ImageUrl: '',
    PepperId: '',
    IsActive: true,
  });
  const [peppers, setPeppers] = useState<PepperOption[]>([]);
  const [loadingProduct, setLoadingProduct] = useState(true);
  const [loadingPeppers, setLoadingPeppers] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Load existing product
  useEffect(() => {
    async function loadProduct() {
      try {
        setLoadingProduct(true);
        const product = await getProductById(Number(productId));
        setForm({
          ProductName: product.ProductName,
          ProductDescription: product.ProductDescription ?? '',
          Category: product.Category ?? '',
          Price: String(product.Price),
          ImageUrl: product.ImageUrl ?? '',
          PepperId: product.PepperId ? String(product.PepperId) : '',
          IsActive: product.IsActive,
        });
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : 'Failed to load product.'
        );
      } finally {
        setLoadingProduct(false);
      }
    }
    loadProduct();
  }, [productId]);

  // Load pepper options
  useEffect(() => {
    async function loadPeppers() {
      try {
        setLoadingPeppers(true);
        const data = await getAllPeppers();
        setPeppers(data.filter((p) => p.IsActive));
      } catch {
        // Non-critical — pepper dropdown just stays empty
      } finally {
        setLoadingPeppers(false);
      }
    }
    loadPeppers();
  }, []);

  function handleChange(
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    const { name, value, type } = event.target;
    if (type === 'checkbox') {
      const checked = (event.target as HTMLInputElement).checked;
      setForm((prev) => ({ ...prev, [name]: checked }));
      return;
    }
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    const validationError = validateForm(form);
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    const payload: ProductCreatePayload = {
      ProductName: form.ProductName.trim(),
      ProductDescription: normalizeOptionalText(form.ProductDescription),
      Category: normalizeOptionalText(form.Category),
      Price: Number(form.Price),
      ImageUrl: normalizeOptionalText(form.ImageUrl),
      PepperId: form.PepperId ? Number(form.PepperId) : null,
      IsActive: form.IsActive,
    };

    try {
      setSubmitting(true);
      const updated = await updateProduct(Number(productId), payload);
      setSuccessMessage(`Product "${updated.ProductName}" updated successfully.`);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Failed to update product.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loadingProduct) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <div className="h-6 bg-[var(--color-muted)] rounded w-1/3 animate-pulse mb-4" />
        <div className="space-y-4 rounded-lg border border-[var(--color-border)] bg-white p-6 shadow-sm">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-10 bg-[var(--color-muted)] rounded animate-pulse" />
          ))}
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl p-6">
      <div className="mb-6">
        <button
          type="button"
          onClick={() => router.back()}
          className="mb-3 text-sm text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] transition"
        >
          ← Back
        </button>
        <h1 className="text-3xl font-bold">Edit Product</h1>
        <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">
          Update the product details below.
        </p>
      </div>

      {successMessage && (
        <div className="mb-4 rounded-md border border-[var(--color-border)] bg-[var(--color-secondary-light)] px-4 py-3 text-[var(--color-primary)]">
          {successMessage}
        </div>
      )}

      {errorMessage && (
        <div className="mb-4 rounded-md border border-[var(--color-border)] bg-[var(--color-error-bg)] px-4 py-3 text-[var(--color-error)]">
          {errorMessage}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="space-y-5 rounded-lg border border-[var(--color-border)] bg-white p-6 shadow-sm"
      >
        <div>
          <label htmlFor="ProductName" className="mb-1 block text-sm font-medium">
            Product Name *
          </label>
          <input
            id="ProductName"
            name="ProductName"
            type="text"
            value={form.ProductName}
            onChange={handleChange}
            maxLength={150}
            className="w-full rounded-md border border-[var(--color-border)] px-3 py-2 outline-none focus:border-[var(--color-primary)]"
            placeholder="e.g. Jalapeño Sauce"
          />
        </div>

        <div>
          <label htmlFor="ProductDescription" className="mb-1 block text-sm font-medium">
            Description
          </label>
          <textarea
            id="ProductDescription"
            name="ProductDescription"
            value={form.ProductDescription}
            onChange={handleChange}
            maxLength={1000}
            rows={4}
            className="w-full rounded-md border border-[var(--color-border)] px-3 py-2 outline-none focus:border-[var(--color-primary)]"
            placeholder="Short product description"
          />
        </div>

        <div>
          <label htmlFor="Category" className="mb-1 block text-sm font-medium">
            Category
          </label>
          <input
            id="Category"
            name="Category"
            type="text"
            value={form.Category}
            onChange={handleChange}
            maxLength={100}
            className="w-full rounded-md border border-[var(--color-border)] px-3 py-2 outline-none focus:border-[var(--color-primary)]"
            placeholder="e.g. Sauce / Powder / Fresh Produce"
          />
        </div>

        <div>
          <label htmlFor="Price" className="mb-1 block text-sm font-medium">
            Price *
          </label>
          <input
            id="Price"
            name="Price"
            type="number"
            step="0.01"
            min="0"
            value={form.Price}
            onChange={handleChange}
            className="w-full rounded-md border border-[var(--color-border)] px-3 py-2 outline-none focus:border-[var(--color-primary)]"
            placeholder="0.00"
          />
        </div>

        <div>
          <label htmlFor="ImageUrl" className="mb-1 block text-sm font-medium">
            Image URL
          </label>
          <input
            id="ImageUrl"
            name="ImageUrl"
            type="text"
            value={form.ImageUrl}
            onChange={handleChange}
            maxLength={500}
            className="w-full rounded-md border border-[var(--color-border)] px-3 py-2 outline-none focus:border-[var(--color-primary)]"
            placeholder="https://... or /uploads/..."
          />
        </div>

        <div>
          <label htmlFor="PepperId" className="mb-1 block text-sm font-medium">
            Related Pepper Variety
          </label>
          <select
            id="PepperId"
            name="PepperId"
            value={form.PepperId}
            onChange={handleChange}
            disabled={loadingPeppers}
            className="w-full rounded-md border border-[var(--color-border)] px-3 py-2 outline-none focus:border-[var(--color-primary)] disabled:bg-[var(--color-muted)]"
          >
            <option value="">No linked pepper variety</option>
            {peppers.map((pepper) => (
              <option key={pepper.PepperId} value={pepper.PepperId}>
                {pepper.PepperName}
              </option>
            ))}
          </select>
          {loadingPeppers && (
            <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">Loading pepper varieties...</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <input
            id="IsActive"
            name="IsActive"
            type="checkbox"
            checked={form.IsActive}
            onChange={handleChange}
          />
          <label htmlFor="IsActive" className="text-sm font-medium">
            Active
          </label>
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-[var(--color-primary)] px-5 py-2 text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Saving...' : 'Save Changes'}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-md border border-[var(--color-border)] px-5 py-2 text-sm text-[var(--color-foreground)] hover:bg-[var(--color-muted)] transition"
          >
            Cancel
          </button>
        </div>
      </form>
    </main>
  );
}