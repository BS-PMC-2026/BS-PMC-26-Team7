import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { LanguageProvider, useLanguage } from '@/context/LanguageContext';
import { getDictionary } from '@/i18n/dictionaries';

const STORAGE_KEY = 'pepper-farm-locale';

// A minimal test page that mirrors real UI: dictionary-translated label + technical value
function TestPage() {
  const { t, dir, locale, setLocale } = useLanguage();
  const technicalValue = 'sensor-42@farm.local | Zone-A | 2024-01-15 | 37.5°C';

  return (
    <div data-testid="page-root" dir={dir}>
      <h1 data-testid="page-title">{t.nav.dashboard}</h1>
      <p data-testid="page-tasks">{t.nav.tasks}</p>
      <p data-testid="page-sensors">{t.nav.sensors}</p>
      <p data-testid="manager-title">{t.manager.title}</p>
      <p data-testid="add-task">{t.tasks.addTask}</p>
      <p data-testid="current-locale">{locale}</p>
      {/* Technical value that must always render LTR even in RTL context */}
      <span data-testid="technical-value" dir="ltr">
        {technicalValue}
      </span>
      <button onClick={() => setLocale('he')}>HE</button>
      <button onClick={() => setLocale('en')}>EN</button>
    </div>
  );
}

function renderWithProvider(initialLocale?: string) {
  if (initialLocale) localStorage.setItem(STORAGE_KEY, initialLocale);
  return render(
    <LanguageProvider>
      <TestPage />
    </LanguageProvider>
  );
}

describe('Language Layout Integration', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.lang = '';
    document.documentElement.dir = '';
    document.body.dir = '';
  });

  describe('English layout (default)', () => {
    it('renders English UI text by default', async () => {
      renderWithProvider();
      await waitFor(() => {
        expect(screen.getByTestId('page-title').textContent).toBe(getDictionary('en').nav.dashboard);
        expect(screen.getByTestId('page-tasks').textContent).toBe(getDictionary('en').nav.tasks);
        expect(screen.getByTestId('page-sensors').textContent).toBe(getDictionary('en').nav.sensors);
      });
    });

    it('sets global direction to LTR for English', async () => {
      renderWithProvider();
      await waitFor(() => {
        expect(document.documentElement.dir).toBe('ltr');
        expect(document.body.dir).toBe('ltr');
      });
    });

    it('page root has dir=ltr in English', async () => {
      renderWithProvider();
      await waitFor(() => {
        expect(screen.getByTestId('page-root')).toHaveAttribute('dir', 'ltr');
      });
    });
  });

  describe('Switching to Hebrew', () => {
    it('updates UI text to Hebrew after switching', async () => {
      renderWithProvider();
      await act(async () => {
        fireEvent.click(screen.getByText('HE'));
      });
      await waitFor(() => {
        expect(screen.getByTestId('page-title').textContent).toBe(getDictionary('he').nav.dashboard);
        expect(screen.getByTestId('page-tasks').textContent).toBe(getDictionary('he').nav.tasks);
        expect(screen.getByTestId('page-sensors').textContent).toBe(getDictionary('he').nav.sensors);
      });
    });

    it('sets global direction to RTL after switching to Hebrew', async () => {
      renderWithProvider();
      await act(async () => {
        fireEvent.click(screen.getByText('HE'));
      });
      await waitFor(() => {
        expect(document.documentElement.dir).toBe('rtl');
        expect(document.body.dir).toBe('rtl');
        expect(document.documentElement.lang).toBe('he');
      });
    });

    it('page root has dir=rtl after switching to Hebrew', async () => {
      renderWithProvider();
      await act(async () => {
        fireEvent.click(screen.getByText('HE'));
      });
      await waitFor(() => {
        expect(screen.getByTestId('page-root')).toHaveAttribute('dir', 'rtl');
      });
    });

    it('Hebrew translations differ from English for UI labels', async () => {
      renderWithProvider();
      await act(async () => {
        fireEvent.click(screen.getByText('HE'));
      });
      await waitFor(() => {
        const heTitle = getDictionary('he').nav.dashboard;
        const enTitle = getDictionary('en').nav.dashboard;
        expect(screen.getByTestId('page-title').textContent).toBe(heTitle);
        expect(heTitle).not.toBe(enTitle);
      });
    });
  });

  describe('Switching back to English', () => {
    it('restores English text after switching back', async () => {
      renderWithProvider();
      await act(async () => { fireEvent.click(screen.getByText('HE')); });
      await waitFor(() => {
        expect(screen.getByTestId('current-locale').textContent).toBe('he');
      });

      await act(async () => { fireEvent.click(screen.getByText('EN')); });
      await waitFor(() => {
        expect(screen.getByTestId('page-title').textContent).toBe(getDictionary('en').nav.dashboard);
        expect(document.documentElement.dir).toBe('ltr');
        expect(document.body.dir).toBe('ltr');
      });
    });
  });

  describe('Technical values remain readable', () => {
    it('technical value has explicit dir=ltr to stay readable in RTL context', async () => {
      renderWithProvider();
      await act(async () => { fireEvent.click(screen.getByText('HE')); });
      await waitFor(() => {
        const techEl = screen.getByTestId('technical-value');
        expect(techEl).toHaveAttribute('dir', 'ltr');
        expect(techEl.textContent).toContain('sensor-42@farm.local');
        expect(techEl.textContent).toContain('Zone-A');
        expect(techEl.textContent).toContain('37.5°C');
      });
    });

    it('technical value is rendered in both English and Hebrew contexts', async () => {
      for (const locale of ['en', 'he'] as const) {
        localStorage.setItem(STORAGE_KEY, locale);
        const { unmount } = render(
          <LanguageProvider>
            <TestPage />
          </LanguageProvider>
        );
        await waitFor(() => {
          expect(screen.getByTestId('technical-value').textContent).toContain('Zone-A');
        });
        unmount();
        localStorage.clear();
      }
    });
  });

  describe('Locale loaded from localStorage', () => {
    it('renders Hebrew immediately when localStorage has "he"', async () => {
      renderWithProvider('he');
      await waitFor(() => {
        expect(screen.getByTestId('current-locale').textContent).toBe('he');
        expect(screen.getByTestId('page-title').textContent).toBe(getDictionary('he').nav.dashboard);
        expect(document.documentElement.dir).toBe('rtl');
      });
    });
  });
});
