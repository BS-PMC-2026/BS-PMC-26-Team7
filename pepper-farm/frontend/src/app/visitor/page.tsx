'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import PepperCard from '@/components/peppers/PepperCard';
import Alert from '@/components/ui/Alert';
import EmptyState from '@/components/ui/EmptyState';
import PageHeader from '@/components/ui/PageHeader';
import { getAllPeppers } from '@/services/peppers';
import { Pepper } from '@/types/pepper';
import { useLanguage } from '@/context/LanguageContext';
import { Map, ShieldAlert } from 'lucide-react';
import ChatWidget from '@/components/chat/ChatWidget';

export default function VisitorPage() {
  const router = useRouter();
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

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('fullName');
    document.cookie = 'token=; path=/; max-age=0';
    document.cookie = 'role=; path=/; max-age=0';
    setIsLoggedIn(false);
    router.push('/');
  };

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
    <div className="min-h-screen bg-[var(--color-muted)]">
      <div className="bg-white border-b border-[var(--color-border)]">
        <div className="max-w-6xl mx-auto px-6 py-10">
          <div className="flex items-start justify-between">
            <PageHeader
              label={vi.label}
              title={vi.pepperVarietiesTitle}
              subtitle={vi.pepperVarietiesSubtitle}
            />
            <div className="flex gap-3 mt-1">
              {/* Always visible — public safety information, no login required */}
              <Link
                href="/visitor/spray-restrictions"
                className="inline-flex items-center gap-1.5 border border-[var(--color-warning)] text-[var(--color-warning)] px-4 py-2 rounded-lg text-sm font-medium hover:bg-[var(--color-warning-bg)] transition"
              >
                <ShieldAlert size={14} />
                {vi.safetyMap}
              </Link>

              {isLoggedIn ? (
                <>
                  <Link
                    href="/visitor/products"
                    className="border border-[var(--color-primary)] text-[var(--color-primary)] px-4 py-2 rounded-lg text-sm font-medium hover:bg-[var(--color-secondary-light)] transition"
                  >
                    {vi.products}
                  </Link>
                  <Link
                    href="/visitor/map"
                    className="inline-flex items-center gap-1.5 border border-[var(--color-primary)] text-[var(--color-primary)] px-4 py-2 rounded-lg text-sm font-medium hover:bg-[var(--color-secondary-light)] transition"
                  >
                    <Map size={14} />
                    {vi.map}
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="bg-[var(--color-accent)] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[var(--color-accent-hover)] transition"
                  >
                    {vi.logout}
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href="/visitor/products"
                    className="border border-[var(--color-primary)] text-[var(--color-primary)] px-4 py-2 rounded-lg text-sm font-medium hover:bg-[var(--color-secondary-light)] transition"
                  >
                    {vi.products}
                  </Link>
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
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="mb-6 flex flex-col md:flex-row gap-4">
          <input
          type="text"
          placeholder="Search pepper varieties..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 rounded-lg border border-[var(--color-border)] px-4 py-3 bg-white"
          />
          <select
          value={heatFilter}
          onChange={(e) => setHeatFilter(e.target.value)}
          className="rounded-lg border border-[var(--color-border)] px-4 py-3 bg-white">
            <option value="">All Heat Levels</option>
            <option value="Mild">Mild</option>
            <option value="Medium">Medium</option>
            <option value="Hot">Hot</option>
            <option value="Extreme">Extreme</option>
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
          title="No pepper varieties found"
          description="Try a different search term"
          />
        ) : (
          <>
            <p className="text-xs text-[var(--color-muted-foreground)] mb-4" dir="ltr">
             {filteredPeppers.length} {peppers.length === 1 ? t.common.variety : t.common.varieties}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredPeppers.map((pepper) => (
                <PepperCard key={pepper.PepperId} pepper={pepper} />
              ))}
            </div>
          </>
        )}
      </div>

      <ChatWidget />
    </div>
  );
}
