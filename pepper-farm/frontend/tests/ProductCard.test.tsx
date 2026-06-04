import { render, screen } from '@testing-library/react';
import React from 'react';
import ProductCard from '@/components/products/ProductCard';
import { ProductResponse } from '@/services/productService';
import { LanguageProvider } from '@/context/LanguageContext';

// next/navigation is already mocked globally in jest.setup.ts
// Override to ensure useRouter is available for this component
jest.mock('next/navigation', () => ({
  redirect:        jest.fn(),
  useRouter:       () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), prefetch: jest.fn() }),
  usePathname:     () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

function renderCard(ui: React.ReactElement) {
  return render(<LanguageProvider>{ui}</LanguageProvider>);
}

const baseProduct: ProductResponse = {
  ProductId: 1,
  ProductName: 'Jalapeño Sauce',
  ProductDescription: 'Mild green pepper sauce',
  Category: 'Sauce',
  Price: 25.0,
  FinalPrice: 25.0,
  ImageUrl: null,
  PepperId: null,
  IsActive: true,
  AllocatedQuantity: 10,
  DiscountPercentage: 0,
  DiscountActive: false,
  DiscountStartDate: null,
  DiscountEndDate: null,
  DiscountIsCurrentlyValid: false,
};

describe('ProductCard', () => {
  it('renders product name and price without discount', () => {
    renderCard(<ProductCard product={baseProduct} />);
    expect(screen.getByText('Jalapeño Sauce')).toBeInTheDocument();
    expect(screen.getByText('$25.00')).toBeInTheDocument();
  });

  it('renders category badge when provided', () => {
    renderCard(<ProductCard product={baseProduct} />);
    expect(screen.getByText('Sauce')).toBeInTheDocument();
  });

  it('does not render discount badge when discount is not active', () => {
    renderCard(<ProductCard product={baseProduct} />);
    expect(screen.queryByText(/OFF/i)).not.toBeInTheDocument();
  });

  it('shows discount badge and discounted price when discount is valid', () => {
    const discountedProduct: ProductResponse = {
      ...baseProduct,
      Price: 100.0,
      FinalPrice: 80.0,
      DiscountPercentage: 20,
      DiscountActive: true,
      DiscountIsCurrentlyValid: true,
    };
    renderCard(<ProductCard product={discountedProduct} />);
    expect(screen.getByText(/20.*OFF/i)).toBeInTheDocument();
    expect(screen.getByText('$80.00')).toBeInTheDocument();
    expect(screen.getByText('$100.00')).toBeInTheDocument();
  });

  it('shows strikethrough original price when discount is active', () => {
    const discountedProduct: ProductResponse = {
      ...baseProduct,
      Price: 100.0,
      FinalPrice: 75.0,
      DiscountPercentage: 25,
      DiscountActive: true,
      DiscountIsCurrentlyValid: true,
    };
    const { container } = renderCard(<ProductCard product={discountedProduct} />);
    const strikethrough = container.querySelector('.line-through');
    expect(strikethrough).toBeInTheDocument();
    expect(strikethrough?.textContent).toContain('100.00');
  });

  it('shows "Unlimited offer" label when discount has no end date', () => {
    const unlimitedProduct: ProductResponse = {
      ...baseProduct,
      Price: 50.0,
      FinalPrice: 40.0,
      DiscountPercentage: 20,
      DiscountActive: true,
      DiscountIsCurrentlyValid: true,
      DiscountEndDate: null,
    };
    renderCard(<ProductCard product={unlimitedProduct} />);
    expect(screen.getByText('Unlimited offer')).toBeInTheDocument();
  });

  it('shows expiry date when discount has an end date', () => {
    const futureDate = new Date(Date.now() + 86400000 * 7).toISOString(); // 7 days from now
    const timedProduct: ProductResponse = {
      ...baseProduct,
      Price: 50.0,
      FinalPrice: 45.0,
      DiscountPercentage: 10,
      DiscountActive: true,
      DiscountIsCurrentlyValid: true,
      DiscountEndDate: futureDate,
    };
    renderCard(<ProductCard product={timedProduct} />);
    expect(screen.getByText(/Ends/i)).toBeInTheDocument();
  });

  it('does not show discount badge when DiscountIsCurrentlyValid is false even if DiscountActive is true', () => {
    const expiredProduct: ProductResponse = {
      ...baseProduct,
      Price: 100.0,
      FinalPrice: 100.0,
      DiscountPercentage: 30,
      DiscountActive: true,
      DiscountIsCurrentlyValid: false,
      DiscountEndDate: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
    };
    renderCard(<ProductCard product={expiredProduct} />);
    expect(screen.queryByText(/OFF/i)).not.toBeInTheDocument();
    expect(screen.getByText('$100.00')).toBeInTheDocument();
  });

  it('shows out-of-stock badge when AllocatedQuantity is 0', () => {
    const outOfStockProduct: ProductResponse = { ...baseProduct, AllocatedQuantity: 0 };
    renderCard(<ProductCard product={outOfStockProduct} />);
    expect(screen.getAllByText(/out of stock/i).length).toBeGreaterThan(0);
  });

  it('shows edit button when showEditButton is true', () => {
    renderCard(<ProductCard product={baseProduct} showEditButton />);
    expect(screen.getByRole('link', { name: /edit/i })).toBeInTheDocument();
  });

  it('does not show edit button by default', () => {
    renderCard(<ProductCard product={baseProduct} />);
    expect(screen.queryByRole('link', { name: /edit/i })).not.toBeInTheDocument();
  });

  it('does not apply discount when start date is in the future (frontend safety check)', () => {
    const futureStart = new Date(Date.now() + 86400000).toISOString();
    const notStartedProduct: ProductResponse = {
      ...baseProduct,
      Price: 100.0,
      FinalPrice: 80.0,
      DiscountPercentage: 20,
      DiscountActive: true,
      DiscountIsCurrentlyValid: true, // backend says valid, but start is in the future
      DiscountStartDate: futureStart,
    };
    renderCard(<ProductCard product={notStartedProduct} />);
    // Frontend safety check should block the discount display
    expect(screen.queryByText(/OFF/i)).not.toBeInTheDocument();
  });

  it('unlimited discount shows correct percentage badge', () => {
    const unlimitedProduct: ProductResponse = {
      ...baseProduct,
      Price: 200.0,
      FinalPrice: 150.0,
      DiscountPercentage: 25,
      DiscountActive: true,
      DiscountIsCurrentlyValid: true,
    };
    renderCard(<ProductCard product={unlimitedProduct} />);
    expect(screen.getByText(/25.*OFF/i)).toBeInTheDocument();
    expect(screen.getByText('Unlimited offer')).toBeInTheDocument();
  });
});
