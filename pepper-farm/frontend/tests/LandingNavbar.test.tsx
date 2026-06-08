/**
 * Integration tests for LandingNavbar (public / visitor navbar)
 * Covers: rendering, nav links, auth buttons, mobile menu toggle, scrolled state.
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import LandingNavbar from '@/components/landing/LandingNavbar';

/* -------------------------------------------------------------------------- */
/* Mocks                                                                        */
/* -------------------------------------------------------------------------- */

jest.mock('framer-motion', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const R = require('react');
  const cache: Record<string, unknown> = {};
  return {
    motion: new Proxy(
      {},
      {
        get: (_: unknown, tag: string) => {
          if (!cache[tag]) {
            const Comp = ({ children, ...props }: Record<string, unknown> & { children?: unknown }) => {
              const { initial, animate, exit, transition, whileHover, whileTap, ...rest } = props;
              void initial; void animate; void exit; void transition; void whileHover; void whileTap;
              return R.createElement(tag, rest, children);
            };
            Comp.displayName = `motion.${tag}`;
            cache[tag] = Comp;
          }
          return cache[tag];
        },
      },
    ),
    AnimatePresence: ({ children }: { children: unknown }) => children,
  };
});

jest.mock('lucide-react', () => {
  const icons = ['Leaf', 'Menu', 'X'];
  const mocks: Record<string, React.FC<{ size?: number; className?: string }>> = {};
  icons.forEach((name) => {
    mocks[name] = ({ size, className }: { size?: number; className?: string }) =>
      React.createElement('svg', { 'data-testid': `icon-${name}`, width: size, className });
  });
  return mocks;
});

jest.mock('@/components/LanguageSwitcher', () => () => React.createElement('div', { 'data-testid': 'language-switcher' }));

// Mock NavMenu — render links directly so we can test hrefs
jest.mock('@/components/ui/navbar', () => ({
  __esModule: true,
  default: ({ list }: { list: Array<{ id: number; title: string; url: string; dropdown?: boolean; items?: Array<{ id: number; title: string; url: string }> }> }) =>
    React.createElement(
      'nav',
      { 'data-testid': 'nav-menu' },
      list.map((item) =>
        item.dropdown
          ? React.createElement(
              'div',
              { key: item.id },
              React.createElement('span', null, item.title),
              ...(item.items ?? []).map((sub) => React.createElement('a', { key: sub.id, href: sub.url }, sub.title)),
            )
          : React.createElement('a', { key: item.id, href: item.url }, item.title),
      ),
    ),
}));

// Mock LanguageContext with English strings
jest.mock('@/context/LanguageContext', () => ({
  useLanguage: () => ({
    locale: 'en',
    dir:    'ltr',
    setLocale: jest.fn(),
    t: {
      landing: {
        navPeppers:      'Peppers',
        navExplore:      'Explore',
        navFarmMap:      'Farm Map',
        navProducts:     'Products',
        navAllVarieties: 'All Varieties',
        navOurFarm:      'Our Farm',
        signIn:          'Sign In',
        getStarted:      'Get Started',
        register:        'Register',
      },
    },
  }),
}));

/* -------------------------------------------------------------------------- */
/* Helpers                                                                      */
/* -------------------------------------------------------------------------- */

const renderNavbar = (scrolled = false) => render(React.createElement(LandingNavbar, { scrolled }));

/* -------------------------------------------------------------------------- */
/* Tests                                                                        */
/* -------------------------------------------------------------------------- */

describe('LandingNavbar — rendering', () => {
  it('renders the Hadinerim logo', () => {
    renderNavbar();
    expect(screen.getByText('Hadinerim')).toBeInTheDocument();
  });

  it('logo links to the home page', () => {
    renderNavbar();
    expect(screen.getByRole('link', { name: /hadinerim/i })).toHaveAttribute('href', '/');
  });

  it('renders the desktop NavMenu', () => {
    renderNavbar();
    expect(screen.getByTestId('nav-menu')).toBeInTheDocument();
  });

  it('renders the Sign In link', () => {
    renderNavbar();
    const signInLinks = screen.getAllByRole('link', { name: /sign in/i });
    expect(signInLinks.length).toBeGreaterThan(0);
  });

  it('renders the Get Started link', () => {
    renderNavbar();
    const links = screen.getAllByRole('link', { name: /get started/i });
    expect(links.length).toBeGreaterThan(0);
  });

  it('renders the language switcher', () => {
    renderNavbar();
    expect(screen.getAllByTestId('language-switcher').length).toBeGreaterThan(0);
  });

  it('renders the hamburger button', () => {
    renderNavbar();
    expect(screen.getByRole('button', { name: /open menu/i })).toBeInTheDocument();
  });

  it('does not show a Manager badge', () => {
    renderNavbar();
    expect(screen.queryByText('Manager')).not.toBeInTheDocument();
  });

  it('does not show a Worker badge', () => {
    renderNavbar();
    expect(screen.queryByText('Worker')).not.toBeInTheDocument();
  });

  it('does not show a sign-out button', () => {
    renderNavbar();
    expect(screen.queryByRole('button', { name: /sign out/i })).not.toBeInTheDocument();
  });
});

describe('LandingNavbar — nav link hrefs (desktop)', () => {
  it('Peppers links to /#peppers', () => {
    renderNavbar();
    expect(screen.getByRole('link', { name: /^peppers$/i })).toHaveAttribute('href', '/#peppers');
  });

  it('Our Farm links to /#farm', () => {
    renderNavbar();
    expect(screen.getByRole('link', { name: /our farm/i })).toHaveAttribute('href', '/#farm');
  });

  it('Farm Map links to /visitor/map', () => {
    renderNavbar();
    expect(screen.getByRole('link', { name: /farm map/i })).toHaveAttribute('href', '/visitor/map');
  });

  it('All Varieties links to /visitor', () => {
    renderNavbar();
    expect(screen.getByRole('link', { name: /all varieties/i })).toHaveAttribute('href', '/visitor');
  });

  it('Sign In links to /login', () => {
    renderNavbar();
    const links = screen.getAllByRole('link', { name: /sign in/i });
    expect(links[0]).toHaveAttribute('href', '/login');
  });

  it('Get Started links to /register', () => {
    renderNavbar();
    const links = screen.getAllByRole('link', { name: /get started/i });
    expect(links[0]).toHaveAttribute('href', '/register');
  });
});

describe('LandingNavbar — mobile menu', () => {
  /**
   * NOTE: AnimatePresence is mocked to always render children, so mobile-panel
   * elements are always present in the DOM. Tests verify toggle behaviour
   * through aria-labels.
   */

  it('hamburger starts as "Open menu"', () => {
    renderNavbar();
    expect(screen.getByRole('button', { name: /open menu/i })).toBeInTheDocument();
  });

  it('hamburger changes to "Close menu" after clicking', () => {
    renderNavbar();
    fireEvent.click(screen.getByRole('button', { name: /open menu/i }));
    expect(screen.getByRole('button', { name: /close menu/i })).toBeInTheDocument();
  });

  it('hamburger returns to "Open menu" after clicking again', () => {
    renderNavbar();
    fireEvent.click(screen.getByRole('button', { name: /open menu/i }));
    fireEvent.click(screen.getByRole('button', { name: /close menu/i }));
    expect(screen.getByRole('button', { name: /open menu/i })).toBeInTheDocument();
  });

  it('mobile panel contains Sign In and Register links after opening', () => {
    renderNavbar();
    fireEvent.click(screen.getByRole('button', { name: /open menu/i }));
    expect(screen.getAllByRole('link', { name: /sign in/i }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByRole('link', { name: /register/i }).length).toBeGreaterThanOrEqual(1);
  });

  it('mobile panel contains farm-related links', () => {
    renderNavbar();
    // Multiple Peppers links may exist (desktop NavMenu + mobile panel)
    const peppersLinks = screen.getAllByRole('link', { name: /^peppers$/i });
    expect(peppersLinks.length).toBeGreaterThanOrEqual(1);
    peppersLinks.forEach((link) => expect(link).toHaveAttribute('href', '/#peppers'));
  });

  it('clicking a mobile link toggles menu back to "Open menu"', () => {
    renderNavbar();
    fireEvent.click(screen.getByRole('button', { name: /open menu/i }));
    const ourFarmLinks = screen.getAllByRole('link', { name: /our farm/i });
    fireEvent.click(ourFarmLinks[ourFarmLinks.length - 1]);
    expect(screen.getByRole('button', { name: /open menu/i })).toBeInTheDocument();
  });
});

describe('LandingNavbar — scrolled visual state', () => {
  it('renders with transparent/dark background when not scrolled', () => {
    renderNavbar(false);
    const header = document.querySelector('header');
    expect(header?.className).toMatch(/bg-black\/30/);
  });

  it('renders with white/frosted background when scrolled', () => {
    renderNavbar(true);
    const header = document.querySelector('header');
    expect(header?.className).toMatch(/bg-white\/90/);
  });
});
