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

export default function VisitorPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const vi = t.visitor;
  const [peppers,    setPeppers]   = useState<Pepper[]>([]);
  const [isLoading,  setIsLoading] = useState(true);
  const [loadError,  setLoadError] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

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
        ) : (
          <>
            <p className="text-xs text-[var(--color-muted-foreground)] mb-4" dir="ltr">
              {peppers.length} {peppers.length === 1 ? t.common.variety : t.common.varieties}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {peppers.map((pepper) => (
                <PepperCard key={pepper.PepperId} pepper={pepper} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
