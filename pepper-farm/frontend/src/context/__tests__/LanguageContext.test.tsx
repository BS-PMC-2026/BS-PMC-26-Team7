import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { LanguageProvider, useLanguage } from '@/context/LanguageContext';

const STORAGE_KEY = 'pepper-farm-locale';

function TestConsumer() {
  const { locale, setLocale, dir } = useLanguage();
  return (
    <div>
      <span data-testid="locale">{locale}</span>
      <span data-testid="dir">{dir}</span>
      <button onClick={() => setLocale('he')}>Switch to HE</button>
      <button onClick={() => setLocale('en')}>Switch to EN</button>
    </div>
  );
}

describe('LanguageContext', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.lang = '';
    document.documentElement.dir = '';
    document.body.dir = '';
  });

  it('default language is English when no saved locale exists', async () => {
    render(
      <LanguageProvider>
        <TestConsumer />
      </LanguageProvider>
    );
    await waitFor(() => {
      expect(screen.getByTestId('locale').textContent).toBe('en');
    });
  });

  it('loads saved locale from localStorage', async () => {
    localStorage.setItem(STORAGE_KEY, 'he');
    render(
      <LanguageProvider>
        <TestConsumer />
      </LanguageProvider>
    );
    await waitFor(() => {
      expect(screen.getByTestId('locale').textContent).toBe('he');
    });
  });

  it('switching to Hebrew sets locale, documentElement.lang, documentElement.dir, and body.dir', async () => {
    render(
      <LanguageProvider>
        <TestConsumer />
      </LanguageProvider>
    );

    await act(async () => {
      fireEvent.click(screen.getByText('Switch to HE'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('locale').textContent).toBe('he');
      expect(document.documentElement.lang).toBe('he');
      expect(document.documentElement.dir).toBe('rtl');
      expect(document.body.dir).toBe('rtl');
    });
  });

  it('switching to English sets locale, documentElement.lang, documentElement.dir, and body.dir', async () => {
    localStorage.setItem(STORAGE_KEY, 'he');
    render(
      <LanguageProvider>
        <TestConsumer />
      </LanguageProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('locale').textContent).toBe('he');
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Switch to EN'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('locale').textContent).toBe('en');
      expect(document.documentElement.lang).toBe('en');
      expect(document.documentElement.dir).toBe('ltr');
      expect(document.body.dir).toBe('ltr');
    });
  });

  it('selected locale is saved to localStorage', async () => {
    render(
      <LanguageProvider>
        <TestConsumer />
      </LanguageProvider>
    );

    await act(async () => {
      fireEvent.click(screen.getByText('Switch to HE'));
    });

    await waitFor(() => {
      expect(localStorage.getItem(STORAGE_KEY)).toBe('he');
    });
  });

  it('invalid localStorage value falls back safely to English', async () => {
    localStorage.setItem(STORAGE_KEY, 'fr');
    render(
      <LanguageProvider>
        <TestConsumer />
      </LanguageProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('locale').textContent).toBe('en');
    });
  });

  it('dir is ltr for English', async () => {
    render(
      <LanguageProvider>
        <TestConsumer />
      </LanguageProvider>
    );
    await waitFor(() => {
      expect(screen.getByTestId('dir').textContent).toBe('ltr');
    });
  });

  it('dir is rtl for Hebrew', async () => {
    localStorage.setItem(STORAGE_KEY, 'he');
    render(
      <LanguageProvider>
        <TestConsumer />
      </LanguageProvider>
    );
    await waitFor(() => {
      expect(screen.getByTestId('dir').textContent).toBe('rtl');
    });
  });

  it('provides English defaults when used outside LanguageProvider', async () => {
    render(<TestConsumer />);
    await waitFor(() => {
      expect(screen.getByTestId('locale').textContent).toBe('en');
      expect(screen.getByTestId('dir').textContent).toBe('ltr');
    });
  });
});
