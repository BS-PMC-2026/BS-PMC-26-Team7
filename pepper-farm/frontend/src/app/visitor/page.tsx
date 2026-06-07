'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import PepperCard from '@/components/peppers/PepperCard';
import Alert from '@/components/ui/Alert';
import EmptyState from '@/components/ui/EmptyState';
import PageHeader from '@/components/ui/PageHeader';
import { getAllPeppers } from '@/services/peppers';
import { Pepper } from '@/types/pepper';
import { useLanguage } from '@/context/LanguageContext';
import ChatWidget from '@/components/chat/ChatWidget';

export default function VisitorPage() {
  const { t } = useLanguage();
  const vi = t.visitor;
  const [peppers,    setPeppers]   = useState<Pepper[]>([]);
  const [isLoading,  setIsLoading] = useState(true);
  const [loadError,  setLoadError] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [heatFilter, setHeatFilter] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    const role  = localStorage.getItem('role');
    setIsLoggedIn(!!token && role === 'Visitor');
  }, []);

  const loadPeppers = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await getAllPeppers();
      setPeppers(data);
    } catch {
      setLoadError(vi.failedToLoad);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPeppers();
  }, [loadPeppers]);

  const filteredPeppers = peppers.filter((pepper) => {
  const matchesSearch =
    pepper.PepperName?.toLowerCase().includes(searchTerm.toLowerCase());

  let matchesHeat = true;

  const scoville = pepper.HeatLevelScovilleMax || 0;

  if (heatFilter === 'Mild')
    matchesHeat = scoville < 5000;

  if (heatFilter === 'Medium')
    matchesHeat = scoville >= 5000 && scoville < 50000;

  if (heatFilter === 'Hot')
    matchesHeat = scoville >= 50000 && scoville < 300000;

  if (heatFilter === 'Extreme')
    matchesHeat = scoville >= 300000;

  return matchesSearch && matchesHeat;
});

  return (
    <div className="app-page-bg">
      <div className="bg-white border-b border-[var(--color-border)]">
        <div className="max-w-6xl mx-auto px-6 py-10">
          <div className="flex items-start justify-between">
            <PageHeader
              label={vi.label}
              title={vi.pepperVarietiesTitle}
              subtitle={vi.pepperVarietiesSubtitle}
            />
            {/* Products / Farm Map now live only in the visitor navbar (no duplicate here).
                Logged-out visitors still get Login / Register, which are not in the navbar. */}
            {!isLoggedIn && (
              <div className="flex flex-wrap justify-end gap-3 mt-1">
                <Link
                  href="/login"
                  className="border border-[var(--color-primary)] text-[var(--color-primary)] px-4 py-2 rounded-lg text-sm font-medium hover:bg-[var(--color-secondary-light)] transition"
                >
                  {vi.login}
                </Link>
                <Link
                  href="/register"
                  className="bg-[var(--color-primary)] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[var(--color-primary-hover)] transition"
                >
                  {vi.register}
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 pt-8 pb-28">
        <div className="mb-6 flex flex-col md:flex-row gap-4">
          <input
          type="text"
          placeholder={vi.searchPlaceholder}
          aria-label={vi.searchPlaceholder}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 rounded-lg border border-[var(--color-border)] px-4 py-3 bg-white"
          />
          <select
          value={heatFilter}
          aria-label={vi.allHeatLevels}
          onChange={(e) => setHeatFilter(e.target.value)}
          className="rounded-lg border border-[var(--color-border)] px-4 py-3 bg-white">
            <option value="">{vi.allHeatLevels}</option>
            <option value="Mild">{vi.heatMild}</option>
            <option value="Medium">{vi.heatMedium}</option>
            <option value="Hot">{vi.heatHot}</option>
            <option value="Extreme">{vi.heatExtreme}</option>
            </select>
          </div>
        {loadError && <Alert variant="info" className="mb-6">{loadError}</Alert>}

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-[var(--color-border)] shadow-sm overflow-hidden animate-pulse">
                <div className="w-full h-48 bg-[var(--color-muted)]" />
                <div className="p-4 flex flex-col gap-2">
                  <div className="h-3.5 bg-[var(--color-muted)] rounded w-3/4" />
                  <div className="h-3 bg-[var(--color-muted)] rounded w-1/2" />
                  <div className="h-3 bg-[var(--color-muted)] rounded w-full mt-1" />
                  <div className="h-3 bg-[var(--color-muted)] rounded w-5/6" />
                </div>
              </div>
            ))}
          </div>
        ) : peppers.length === 0 ? (
          <EmptyState icon="🌶️" title={vi.noPepperVariants} description={vi.checkBackLater} />
          ) : filteredPeppers.length === 0 ? (
          <EmptyState
          icon="🔍"
          title={vi.noPepperVariants}
          description={vi.noResultsDesc}
          />
        ) : (
          <>
            <p className="text-xs text-[var(--color-muted-foreground)] mb-4" dir="ltr">
             {filteredPeppers.length} {peppers.length === 1 ? t.common.variety : t.common.varieties}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredPeppers.map((pepper) => (
                <Link
                  key={pepper.PepperId}
                  href={`/visitor/peppers/${pepper.PepperId}`}
                  className="block h-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] rounded-2xl"
                >
                  <PepperCard pepper={pepper} />
                </Link>
              ))}
            </div>
          </>
        )}
      </div>

      <ChatWidget />
    </div>
  );
}
