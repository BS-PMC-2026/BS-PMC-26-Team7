'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import PageHeader from '@/components/ui/PageHeader';
import SprayReportForm from '@/components/spray/SprayReportForm';

export default function WorkerSprayReportPage() {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.replace('/login');
    }
  }, [router]);

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <PageHeader
          title="Spray Report"
          subtitle="Report a completed spray or plan one for later"
        />
      </div>
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <SprayReportForm />
      </div>
    </div>
  );
}
