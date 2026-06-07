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
  DiscountActive: boolean;
  DiscountPercentage: string;
  DiscountStartDate: string;
  DiscountEndDate: string;
};

function normalizeOptionalText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

/**
 * Convert an ISO datetime string to the value expected by <input type="datetime-local">.
 * The backend returns naive UTC datetimes without a 'Z' suffix; we append it so
 * JavaScript parses the value as UTC before extracting local-time components for
 * display (datetime-local inputs always show local time).
 */
function toDatetimeLocal(isoString: string | null | undefined): string {
  if (!isoString) return '';
  const s = isoString.endsWith('Z') || isoString.includes('+') ? isoString : isoString + 'Z';
  const d = new Date(s);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
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
  if (form.DiscountPercentage) {
    const pct = Number(form.DiscountPercentage);
    if (Number.isNaN(pct) || pct < 0 || pct > 100) {
      return 'Discount percentage must be between 0 and 100.';
    }
  }
  if (form.DiscountActive) {
    const pct = Number(form.DiscountPercentage);
    if (!form.DiscountPercentage || Number.isNaN(pct) || pct <= 0) {
      return 'Discount percentage must be greater than 0 when discount is active.';
    }
  }
  if (form.DiscountStartDate && form.DiscountEndDate) {
    if (new Date(form.DiscountEndDate) <= new Date(form.DiscountStartDate)) {
      return 'End date must be after start date.';
    }
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
    DiscountActive: false,
    DiscountPercentage: '',
    DiscountStartDate: '',
    DiscountEndDate: '',
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
          DiscountActive: product.DiscountActive,
          DiscountPercentage: product.DiscountPercentage > 0
            ? String(product.DiscountPercentage)
            : '',
          DiscountStartDate: toDatetimeLocal(product.DiscountStartDate),
          DiscountEndDate: toDatetimeLocal(product.DiscountEndDate),
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
      setForm((prev) => ({
        ...prev,
        [name]: checked,
        // Reset discount fields when discount is disabled
        ...(name === 'DiscountActive' && !checked
          ? { DiscountPercentage: '', DiscountStartDate: '', DiscountEndDate: '' }
          : {}),
      }));
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
      DiscountActive: form.DiscountActive,
      DiscountPercentage: form.DiscountPercentage ? Number(form.DiscountPercentage) : 0,
      DiscountStartDate: form.DiscountStartDate
        ? new Date(form.DiscountStartDate).toISOString()
        : null,
      DiscountEndDate: form.DiscountEndDate
        ? new Date(form.DiscountEndDate).toISOString()
        : null,
    };

    try {
      setSubmitting(true);
      const updated = await updateProduct(Number(productId), payload);
      let msg = `Product "${updated.ProductName}" updated successfully.`;
      if (updated.emailNotificationSent) {
        msg += ' Discount saved. Notification emails were sent to subscribed customers.';
      }
      setSuccessMessage(msg);
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
        aria-busy={submitting}
      >
        <fieldset disabled={submitting} className="space-y-5 disabled:opacity-70">
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

        {/* ── Discount Settings ── */}
        <div className="rounded-md border border-[var(--color-border)] p-4 space-y-4">
          <p className="text-sm font-semibold text-gray-700">Discount Settings</p>

          <div className="flex items-center gap-2">
            <input
              id="DiscountActive"
              name="DiscountActive"
              type="checkbox"
              checked={form.DiscountActive}
              onChange={handleChange}
            />
            <label htmlFor="DiscountActive" className="text-sm font-medium">
              Discount Active
            </label>
          </div>

          <div className={form.DiscountActive ? '' : 'opacity-40 pointer-events-none'}>
            <div>
              <label htmlFor="DiscountPercentage" className="mb-1 block text-sm font-medium">
                Discount Percentage (%)
              </label>
              <input
                id="DiscountPercentage"
                name="DiscountPercentage"
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={form.DiscountPercentage}
                onChange={handleChange}
                disabled={!form.DiscountActive}
                className="w-full rounded-md border border-[var(--color-border)] px-3 py-2 outline-none focus:border-[var(--color-primary)] disabled:bg-[var(--color-muted)]"
                placeholder="e.g. 20"
              />
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="DiscountStartDate" className="mb-1 block text-sm font-medium">
                  Start Date & Time
                </label>
                <input
                  id="DiscountStartDate"
                  name="DiscountStartDate"
                  type="datetime-local"
                  value={form.DiscountStartDate}
                  onChange={handleChange}
                  disabled={!form.DiscountActive}
                  className="w-full rounded-md border border-[var(--color-border)] px-3 py-2 outline-none focus:border-[var(--color-primary)] disabled:bg-[var(--color-muted)]"
                />
              </div>
              <div>
                <label htmlFor="DiscountEndDate" className="mb-1 block text-sm font-medium">
                  End Date & Time
                </label>
                <input
                  id="DiscountEndDate"
                  name="DiscountEndDate"
                  type="datetime-local"
                  value={form.DiscountEndDate}
                  onChange={handleChange}
                  disabled={!form.DiscountActive}
                  className="w-full rounded-md border border-[var(--color-border)] px-3 py-2 outline-none focus:border-[var(--color-primary)] disabled:bg-[var(--color-muted)]"
                />
                <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                  Leave empty for unlimited discount
                </p>
              </div>
            </div>
          </div>
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
        </fieldset>
      </form>
    </main>
  );
}
