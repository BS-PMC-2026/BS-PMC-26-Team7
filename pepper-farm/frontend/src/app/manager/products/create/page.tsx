'use client';

import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import { getAllPeppers } from '@/services/peppers';
import {
  createProduct,
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

const initialForm: FormState = {
  ProductName: '',
  ProductDescription: '',
  Category: '',
  Price: '',
  ImageUrl: '',
  PepperId: '',
  IsActive: true,
};

function normalizeOptionalText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function validateForm(form: FormState): string | null {
  if (!form.ProductName.trim()) {
    return 'Product name is required.';
  }

  if (!form.Price.trim()) {
    return 'Price is required.';
  }

  const parsedPrice = Number(form.Price);
  if (Number.isNaN(parsedPrice)) {
    return 'Price must be a valid number.';
  }

  if (parsedPrice < 0) {
    return 'Price must be non-negative.';
  }

  const imageUrl = form.ImageUrl.trim();
  if (
    imageUrl &&
    !(
      imageUrl.startsWith('http://') ||
      imageUrl.startsWith('https://') ||
      imageUrl.startsWith('/uploads/')
    )
  ) {
    return 'Image URL must start with http://, https://, or /uploads/.';
  }

  if (form.PepperId) {
    const pepperId = Number(form.PepperId);
    if (Number.isNaN(pepperId) || pepperId <= 0) {
      return 'Selected pepper variety is invalid.';
    }
  }

  return null;
}

function getFriendlyErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return 'Something went wrong. Please try again.';
  }

  const message = error.message.toLowerCase();

  if (message.includes('already exists')) {
    return 'A product with this name already exists.';
  }

  if (message.includes('linked pepper variety not found')) {
    return 'The selected pepper variety could not be found.';
  }

  if (message.includes('database connection timeout')) {
    return 'The server is taking too long to respond. Please try again in a moment.';
  }

  if (message.includes('access denied') || message.includes('403')) {
    return 'You do not have permission to perform this action.';
  }

  return error.message;
}

export default function CreateProductPage() {
  const [form, setForm] = useState<FormState>(initialForm);
  const [peppers, setPeppers] = useState<PepperOption[]>([]);
  const [loadingPeppers, setLoadingPeppers] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    async function loadPeppers() {
      try {
        setLoadingPeppers(true);
        setErrorMessage('');

        const data = await getAllPeppers();
        setPeppers(data.filter((pepper) => pepper.IsActive));
      } catch (error) {
  setErrorMessage(getFriendlyErrorMessage(error));
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
      }));
      return;
    }

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
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
      const created = await createProduct(payload);

      setSuccessMessage(`Product "${created.ProductName}" created successfully.`);
      setForm(initialForm);
    } catch (error) {
  setErrorMessage(getFriendlyErrorMessage(error));
} finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Create Product Item</h1>
        <p className="mt-2 text-sm text-gray-600">
          Add a new product to the catalog and optionally link it to a pepper variety.
        </p>
      </div>

      {successMessage && (
        <div className="mb-4 rounded-md border border-green-300 bg-green-50 px-4 py-3 text-green-800">
          {successMessage}
        </div>
      )}

      {errorMessage && (
        <div className="mb-4 rounded-md border border-red-300 bg-red-50 px-4 py-3 text-red-800">
          {errorMessage}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="space-y-5 rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
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
            className="w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:border-black"
            placeholder="e.g. Jalapeño Sauce"
          />
        </div>

        <div>
          <label
            htmlFor="ProductDescription"
            className="mb-1 block text-sm font-medium"
          >
            Description
          </label>
          <textarea
            id="ProductDescription"
            name="ProductDescription"
            value={form.ProductDescription}
            onChange={handleChange}
            maxLength={1000}
            rows={4}
            className="w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:border-black"
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
            className="w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:border-black"
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
            className="w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:border-black"
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
            className="w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:border-black"
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
            className="w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:border-black disabled:bg-gray-100"
          >
            <option value="">No linked pepper variety</option>
            {peppers.map((pepper) => (
              <option key={pepper.PepperId} value={pepper.PepperId}>
                {pepper.PepperName}
              </option>
            ))}
          </select>
          {loadingPeppers && (
            <p className="mt-1 text-sm text-gray-500">Loading pepper varieties...</p>
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

        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-black px-5 py-2 text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? 'Creating...' : 'Create Product'}
        </button>
      </form>
    </main>
  );
}