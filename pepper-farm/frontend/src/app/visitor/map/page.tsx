'use client';

import { useState, useEffect } from 'react';
import FarmMap, { FarmSection } from '@/components/map/FarmMap';
import PageHeader from '@/components/ui/PageHeader';
import Card from '@/components/ui/Card';
import { getAllPlants, PlantData } from '@/services/plants';
import { getPublicRestrictedZones } from '@/services/spray';
import { ZoneSprayStatusData } from '@/types/spray';
import { ShieldAlert } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

/* Visitor-friendly spray status overlays (entry permission → simple colour). */
const RESTRICTED_FILL = 'rgba(220,38,38,0.18)';
const CAUTION_FILL    = 'rgba(249,115,22,0.15)';

export default function FarmMapPage() {
  const { t, locale } = useLanguage();
  const vi = t.visitor;
  const [plants, setPlants] = useState<PlantData[]>([]);
  const [zones,  setZones]  = useState<ZoneSprayStatusData[]>([]);

  useEffect(() => {
    getAllPlants('').then(setPlants).catch(() => {});
    // Public spray data only — no internal operational details.
    getPublicRestrictedZones().then(setZones).catch(() => {});
  }, []);

  // Colour only restricted / caution zones; everything else stays "open".
  const sectionColors: Record<string, string> = {};
  for (const z of zones) {
    if (z.entryPermissionStatus === 'restricted') sectionColors[z.zoneCode] = RESTRICTED_FILL;
    else if (z.entryPermissionStatus === 'caution') sectionColors[z.zoneCode] = CAUTION_FILL;
  }

  const renderPopupExtra = (section: FarmSection) => {
    const zone = zones.find((z) => z.zoneCode === section.id);
    if (!zone) return null;
    const isRestricted = zone.entryPermissionStatus === 'restricted';
    const isCaution    = zone.entryPermissionStatus === 'caution';
    if (!isRestricted && !isCaution) return null;

    const safeTime =
      zone.safeToReEnterAtUtc && new Date(zone.safeToReEnterAtUtc) > new Date()
        ? new Date(zone.safeToReEnterAtUtc).toLocaleString(locale === 'he' ? 'he-IL' : undefined, {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
          })
        : null;

    return (
      <div
        className={`mb-3 rounded-lg border px-3 py-2 text-sm ${
          isRestricted
            ? 'bg-[var(--color-error-bg)] border-[var(--color-error)] text-[var(--color-error)]'
            : 'bg-[var(--color-warning-bg)] border-[var(--color-warning)] text-[var(--color-warning)]'
        }`}
      >
        <div className="flex items-start gap-2">
          <ShieldAlert size={16} className="shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">{isRestricted ? vi.mapStatusRestricted : vi.mapStatusCaution}</p>
            <p className="mt-0.5">{isRestricted ? vi.mapRestrictedWarning : vi.mapCautionWarning}</p>
            {safeTime && (
              <p className="mt-1" dir="ltr">{vi.mapSafeReentry}: {safeTime}</p>
            )}
          </div>
        </div>
      </div>
    );
  };

  const legend = [
    { label: vi.mapStatusOpen,       color: 'transparent',   border: '#9ca3af' },
    { label: vi.mapStatusRestricted, color: RESTRICTED_FILL, border: '#dc2626' },
    { label: vi.mapStatusCaution,    color: CAUTION_FILL,    border: '#f97316' },
  ];

  return (
    <div className="app-page-bg">
      <div className="bg-white border-b border-[var(--color-border)]">
        <div className="max-w-7xl mx-auto px-6 py-10">
          <PageHeader
            label={vi.label}
            title={vi.farmMapTitle}
            subtitle={vi.farmMapSubtitle}
          />
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-6 py-8">
        <Card>
          {/* Visitor spray-safety legend (public info only) */}
          <div className="mb-4 flex flex-wrap gap-3">
            {legend.map((item) => (
              <div key={item.label} className="flex items-center gap-1.5">
                <span
                  style={{
                    display: 'inline-block',
                    width: 14,
                    height: 14,
                    backgroundColor: item.color,
                    border: `2px solid ${item.border}`,
                    borderRadius: 2,
                    flexShrink: 0,
                  }}
                />
                <span className="text-xs text-gray-600">{item.label}</span>
              </div>
            ))}
          </div>

          {/* showAlerts={false} keeps internal task/sensor info hidden from visitors */}
          <FarmMap
            plants={plants}
            showAlerts={false}
            sectionColors={sectionColors}
            renderPopupExtra={renderPopupExtra}
          />
        </Card>
      </div>
    </div>
  );
}
