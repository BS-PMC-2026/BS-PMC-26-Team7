import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { LanguageProvider } from '@/context/LanguageContext';

const STORAGE_KEY = 'pepper-farm-locale';

function renderWithProvider(initialLocale?: string) {
  if (initialLocale) localStorage.setItem(STORAGE_KEY, initialLocale);
  return render(
    <LanguageProvider>
      <LanguageSwitcher />
    </LanguageProvider>
  );
}

describe('LanguageSwitcher', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders HE and EN buttons', () => {
    renderWithProvider();
    expect(screen.getByText('EN')).toBeInTheDocument();
    expect(screen.getByText('HE')).toBeInTheDocument();
  });

  it('does not crash when rendered inside LanguageProvider', () => {
    expect(() => renderWithProvider()).not.toThrow();
  });

  it('EN button has aria-pressed true by default', async () => {
    renderWithProvider();
    await waitFor(() => {
      expect(screen.getByLabelText('Switch to EN')).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByLabelText('Switch to HE')).toHaveAttribute('aria-pressed', 'false');
    });
  });

  it('clicking HE changes selected language to Hebrew', async () => {
    renderWithProvider();
    await act(async () => {
      fireEvent.click(screen.getByText('HE'));
    });
    await waitFor(() => {
      expect(screen.getByLabelText('Switch to HE')).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByLabelText('Switch to EN')).toHaveAttribute('aria-pressed', 'false');
    });
  });

  it('clicking EN changes selected language to English', async () => {
    renderWithProvider('he');
    await waitFor(() => {
      expect(screen.getByLabelText('Switch to HE')).toHaveAttribute('aria-pressed', 'true');
    });
    await act(async () => {
      fireEvent.click(screen.getByText('EN'));
    });
    await waitFor(() => {
      expect(screen.getByLabelText('Switch to EN')).toHaveAttribute('aria-pressed', 'true');
    });
  });

  it('active language button has active styling (bg-green-700 class)', async () => {
    renderWithProvider();
    await waitFor(() => {
      expect(screen.getByLabelText('Switch to EN')).toHaveClass('bg-green-700');
    });
  });

  it('inactive language button does not have active styling', async () => {
    renderWithProvider();
    await waitFor(() => {
      expect(screen.getByLabelText('Switch to HE')).not.toHaveClass('bg-green-700');
    });
  });

  it('active button switches after clicking HE', async () => {
    renderWithProvider();
    await act(async () => {
      fireEvent.click(screen.getByText('HE'));
    });
    await waitFor(() => {
      expect(screen.getByLabelText('Switch to HE')).toHaveClass('bg-green-700');
      expect(screen.getByLabelText('Switch to EN')).not.toHaveClass('bg-green-700');
    });
  });
});
