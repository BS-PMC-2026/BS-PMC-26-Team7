'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import { getPepperById } from '@/services/peppers';
import { Pepper } from '@/types/pepper';
import { useLanguage } from '@/context/LanguageContext';

/**
 * One labelled detail row; renders nothing when the value is empty.
 * `ltrValue` forces the value to render left-to-right (for metric/numeric
 * ranges) so it isn't visually reversed when the page direction is RTL.
 */
function DetailRow({
  label,
  value,
  ltrValue = false,
}: {
  label: string;
  value: React.ReactNode;
  ltrValue?: boolean;
}) {
  if (value == null || value === '') return null;
  return (
    <div className="flex flex-col gap-1 py-3 border-b border-[var(--color-border)] last:border-b-0">
      <span className="text-xs font-semibold text-[var(--color-muted-foreground)] uppercase tracking-widest">
        {label}
      </span>
      <span
        className="text-sm text-gray-700"
        dir={ltrValue ? 'ltr' : undefined}
        style={ltrValue ? { unicodeBidi: 'isolate' } : undefined}
      >
        {value}
      </span>
    </div>
  );
}

/** Format a min/max numeric range with a unit; returns null when both are empty. */
function formatRange(
  min: number | null | undefined,
  max: number | null | undefined,
  unit: string,
): string | null {
  if (min == null && max == null) return null;
  if (min != null && max != null) return `${min.toLocaleString()}–${max.toLocaleString()} ${unit}`;
  return `${(min ?? max)!.toLocaleString()} ${unit}`;
}

export default function PepperDetailsPage() {
  const params = useParams<{ id: string }>();
  const { t } = useLanguage();
  const vi = t.visitor;

  const pd = t.peppers;

  const [pepper, setPepper] = useState<Pepper | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!params?.id) return;
    setIsLoading(true);
    setLoadError(null);
    getPepperById(Number(params.id))
      .then(setPepper)
      .catch(() => setLoadError(pd.detailsNotFound))
      .finally(() => setIsLoading(false));
  }, [params?.id, pd.detailsNotFound]);

  const scoville = pepper
    ? formatRange(pepper.HeatLevelScovilleMin, pepper.HeatLevelScovilleMax, 'SHU')
    : null;
  const par = pepper
    ? formatRange(pepper.OptimalPARMin, pepper.OptimalPARMax, 'µmol/m²/s')
    : null;
  const temp = pepper
    ? formatRange(pepper.OptimalTempMinC, pepper.OptimalTempMaxC, '°C')
    : null;
  const moisture = pepper
    ? formatRange(pepper.OptimalSoilMoistureMin, pepper.OptimalSoilMoistureMax, '%')
    : null;

  return (
    <div className="app-page-bg min-h-screen">
      {/* Header band — consistent with other visitor pages */}
      <div className="bg-white border-b border-[var(--color-border)]">
        <div className="max-w-4xl mx-auto px-6 py-10">
          <Link
            href="/visitor"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] transition mb-4"
          >
            <ArrowLeft size={16} />
            {pd.detailsBackToVarieties}
          </Link>
          <PageHeader
            label={vi.label}
            title={pepper?.PepperName ?? vi.pepperVarietiesTitle}
            subtitle={pepper?.ScientificName ?? vi.pepperVarietiesSubtitle}
          />
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Loading state */}
        {isLoading ? (
          <Card noPadding className="overflow-hidden animate-pulse">
            <div className="w-full h-64 bg-[var(--color-muted)]" />
            <div className="p-6 flex flex-col gap-3">
              <div className="h-4 bg-[var(--color-muted)] rounded w-1/2" />
              <div className="h-3 bg-[var(--color-muted)] rounded w-1/3" />
              <div className="h-3 bg-[var(--color-muted)] rounded w-full mt-2" />
              <div className="h-3 bg-[var(--color-muted)] rounded w-5/6" />
            </div>
          </Card>
        ) : loadError || !pepper ? (
          /* Error / not-found state */
          <Card className="text-center flex flex-col items-center gap-4 py-12">
            <span className="text-5xl">🌶️</span>
            <Alert variant="info" className="max-w-md">
              {loadError ?? pd.detailsNotFound}
            </Alert>
            <Link href="/visitor">
              <Button variant="primary">{pd.detailsReturnToVarieties}</Button>
            </Link>
          </Card>
        ) : (
          /* Success state */
          <Card noPadding className="overflow-hidden">
            {/* Image */}
            <div className="w-full h-64 bg-gray-50 flex items-center justify-center overflow-hidden border-b border-[var(--color-border)]">
              {pepper.ImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={pepper.ImageUrl}
                  alt={pepper.PepperName}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    const img = e.currentTarget as HTMLImageElement;
                    img.style.display = 'none';
                    const parent = img.parentElement as HTMLElement;
                    parent.innerHTML = '<span style="font-size:3.5rem">🌶️</span>';
                  }}
                />
              ) : (
                <span className="text-6xl opacity-30">🌶️</span>
              )}
            </div>

            <div className="p-6">
              <div className="flex items-start justify-between gap-3 mb-1">
                <h2 className="text-xl font-semibold text-gray-900">{pepper.PepperName}</h2>
                {scoville && (
                  <Badge className="bg-gray-100 text-gray-600 border border-gray-200 shrink-0">
                    🌶 <span dir="ltr" style={{ unicodeBidi: 'isolate' }}>{scoville}</span>
                  </Badge>
                )}
              </div>
              {pepper.ScientificName && (
                <p className="text-sm text-gray-400 italic mb-4">{pepper.ScientificName}</p>
              )}

              {pepper.GeneralDescription && (
                <p className="text-sm text-gray-600 leading-relaxed mb-4">
                  {pepper.GeneralDescription}
                </p>
              )}

              <div className="mt-2">
                <DetailRow label={pd.detailsScovilleRange} value={scoville} ltrValue />
                <DetailRow label={pd.detailsOptimalPar} value={par} ltrValue />
                <DetailRow label={pd.detailsOptimalTemperature} value={temp} ltrValue />
                <DetailRow label={pd.detailsOptimalSoilMoisture} value={moisture} ltrValue />
                <DetailRow label={pd.zoneLabel} value={pepper.Zone} />
              </div>

              <div className="mt-6">
                <Link href="/visitor">
                  <Button variant="outline">
                    <ArrowLeft size={16} className="mr-1.5" />
                    {pd.detailsReturnToVarieties}
                  </Button>
                </Link>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
