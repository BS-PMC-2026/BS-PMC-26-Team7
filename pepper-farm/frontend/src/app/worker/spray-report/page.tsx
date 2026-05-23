'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import PageHeader from '@/components/ui/PageHeader';
import Card from '@/components/ui/Card';
import SprayReportForm from '@/components/spray/SprayReportForm';
import SpraySafetyMapSection from '@/components/spray/SpraySafetyMapSection';
import { useLanguage } from '@/context/LanguageContext';

export default function WorkerSprayReportPage() {
  const router = useRouter();
  const { t } = useLanguage();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.replace('/login');
    }
  }, [router]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="mb-6">
        <PageHeader
          label={t.spray.safetyLabel}
          title={t.spray.sprayWorkflowTitle}
          subtitle={t.spray.sprayWorkflowSubtitle}
        />
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(360px,0.9fr)_minmax(0,1.4fr)] items-start">
        <Card>
          <h2 className="text-base font-semibold text-[var(--color-foreground)] mb-4">{t.spray.sprayReportTitle}</h2>
          <SprayReportForm />
        </Card>
        <SpraySafetyMapSection />
      </div>
    </div>
  );
}
