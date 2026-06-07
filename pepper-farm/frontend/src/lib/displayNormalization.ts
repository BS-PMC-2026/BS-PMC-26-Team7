/**
 * Frontend-only DISPLAY normalization for DB-driven values shown to visitors.
 *
 * These helpers ONLY affect what is rendered on screen. They never change the
 * raw DB/API values, never change filtering/equality logic, and never send
 * anything back to the backend. Unknown values fall back to the (cleaned) raw
 * string so no data ever disappears.
 */

import type { Locale } from '@/i18n/dictionaries';

interface LocalizedLabel {
  en: string;
  he: string;
}

/* ── Pepper growing zone ──────────────────────────────────────────────────── */

/**
 * Leading label prefixes that some DB Zone values embed (so they don't get
 * duplicated next to the UI "Zone:" / "אזור:" label). Matched case-insensitively
 * at the start of the string only.
 */
const ZONE_PREFIXES = [
  'אזור גידול:',
  'אזור:',
  'growing zone:',
  'zone:',
];

/** Known zone values keyed by their normalized (lowercased, trimmed) form. */
const ZONE_MAP: Record<string, LocalizedLabel> = {
  'full sun':       { en: 'Full sun', he: 'שמש מלאה' },
  'שמש מלאה':       { en: 'Full sun', he: 'שמש מלאה' },
  'partial shade':  { en: 'Partial shade', he: 'צל חלקי' },
  'partial sun':    { en: 'Partial shade', he: 'צל חלקי' },
  'צל חלקי':        { en: 'Partial shade', he: 'צל חלקי' },
  'shade':          { en: 'Shade', he: 'צל' },
  'צל':             { en: 'Shade', he: 'צל' },
};

function stripZonePrefix(value: string): string {
  const trimmed = value.trim();
  const lower = trimmed.toLowerCase();
  for (const prefix of ZONE_PREFIXES) {
    if (lower.startsWith(prefix.toLowerCase())) {
      return trimmed.slice(prefix.length).trim();
    }
  }
  return trimmed;
}

/**
 * Display-only label for a raw pepper Zone value.
 * - Strips an embedded "אזור גידול:" / "Zone:" prefix so the UI label isn't doubled.
 * - Maps known values to the selected UI language.
 * - Falls back to the cleaned raw value for anything unknown.
 */
export function normalizePepperZoneForDisplay(
  rawZone: string | null | undefined,
  locale: Locale,
): string {
  if (rawZone == null) return '';
  const cleaned = stripZonePrefix(rawZone);
  const match = ZONE_MAP[cleaned.toLowerCase()];
  if (match) return locale === 'he' ? match.he : match.en;
  return cleaned; // unknown — keep raw (cleaned) value, no data lost
}

/* ── Product category ─────────────────────────────────────────────────────── */

/** Known product categories keyed by their normalized (lowercased, trimmed) form. */
const CATEGORY_MAP: Record<string, LocalizedLabel> = {
  'sauce':         { en: 'Sauce', he: 'רוטב' },
  'sauces':        { en: 'Sauces', he: 'רטבים' },
  'powder':        { en: 'Powder', he: 'אבקה' },
  'gift set':      { en: 'Gift Set', he: 'מארז מתנה' },
  'seasoning':     { en: 'Seasoning', he: 'תיבול' },
  'spice':         { en: 'Spice', he: 'תבלין' },
  'dried peppers': { en: 'Dried Peppers', he: 'פלפלים מיובשים' },
  'paste':         { en: 'Paste', he: 'ממרח' },
  'fresh peppers': { en: 'Fresh Peppers', he: 'פלפלים טריים' },
  'condiment':     { en: 'Condiment', he: 'מוצר תיבול' },
  'dip':           { en: 'Dip', he: 'מטבל' },
};

/**
 * Display-only label for a raw product Category value.
 * Maps known categories to the selected UI language; unknown values are kept raw.
 *
 * NOTE: this is for DISPLAY ONLY. Filtering must continue to compare against the
 * raw DB category, never this localized label.
 */
export function normalizeProductCategoryForDisplay(
  rawCategory: string | null | undefined,
  locale: Locale,
): string {
  if (rawCategory == null) return '';
  const match = CATEGORY_MAP[rawCategory.trim().toLowerCase()];
  if (match) return locale === 'he' ? match.he : match.en;
  return rawCategory; // unknown — keep raw value, no data lost
}
