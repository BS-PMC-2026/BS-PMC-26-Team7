import fs from 'fs';
import path from 'path';
import type { SVGProps } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import BackButton from '@/components/ui/BackButton';

const mockBack = jest.fn();
const mockPush = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ back: mockBack, push: mockPush }),
}));

jest.mock('@/context/LanguageContext', () => ({
  useLanguage: () => ({
    dir: 'ltr',
    t: { common: { back: 'Back' } },
  }),
}));

jest.mock('lucide-react', () => ({
  ChevronLeft: (props: SVGProps<SVGSVGElement>) => <svg data-testid="chevron-left" {...props} />,
  ChevronRight: (props: SVGProps<SVGSVGElement>) => <svg data-testid="chevron-right" {...props} />,
  Loader2: (props: SVGProps<SVGSVGElement>) => <svg data-testid="loader-icon" {...props} />,
}));

describe('US47 design cleanup', () => {
  beforeEach(() => {
    mockBack.mockClear();
    mockPush.mockClear();
  });

  it('does not render homepage floating pepper decorations', () => {
    const root = path.resolve(__dirname, '..');
    const hero = fs.readFileSync(path.join(root, 'src/components/landing/HeroSection.tsx'), 'utf8');
    const appPage = fs.readFileSync(path.join(root, 'src/app/page.tsx'), 'utf8');

    expect(hero).not.toContain('FloatingPepper');
    expect(hero).not.toContain('PEPPER_PARTICLES');
    expect(appPage).not.toContain("fontFamily: 'Raleway");
  });

  it('enforces one inherited global app font', () => {
    const root = path.resolve(__dirname, '..');
    const css = fs.readFileSync(path.join(root, 'src/app/globals.css'), 'utf8');

    expect(css).toContain("--font-body:    'Raleway', system-ui, sans-serif;");
    expect(css).toContain("--font-heading: 'Raleway', system-ui, sans-serif;");
    expect(css).toContain('font-family: inherit;');

    const sourceRoot = path.join(root, 'src');
    const files = fs.readdirSync(sourceRoot, { recursive: true })
      .filter((file) => typeof file === 'string' && /\.(tsx|ts|css)$/.test(file))
      .map((file) => path.join(sourceRoot, file as string));
    const localFontOverrides = files.filter((file) => {
      const text = fs.readFileSync(file, 'utf8');
      return /font-mono|font-serif|font-sans|fontFamily/.test(text);
    });
    expect(localFontOverrides).toEqual([]);
  });

  it('renders a consistent BackButton and calls router.back when history exists', () => {
    const originalHistory = window.history;
    Object.defineProperty(window, 'history', {
      configurable: true,
      value: { length: 2 },
    });

    render(<BackButton fallbackHref="/manager/products" />);

    fireEvent.click(screen.getByRole('button', { name: /back/i }));

    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockPush).not.toHaveBeenCalled();

    Object.defineProperty(window, 'history', {
      configurable: true,
      value: originalHistory,
    });
  });

  it('uses fallbackHref when there is no useful browser history', () => {
    const originalHistory = window.history;
    Object.defineProperty(window, 'history', {
      configurable: true,
      value: { length: 1 },
    });

    render(<BackButton fallbackHref="/manager/products" />);
    fireEvent.click(screen.getByRole('button', { name: /back/i }));

    expect(mockBack).not.toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith('/manager/products');

    Object.defineProperty(window, 'history', {
      configurable: true,
      value: originalHistory,
    });
  });
});
