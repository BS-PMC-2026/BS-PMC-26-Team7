'use client';

import { Pepper } from '@/types/pepper';
import Badge from '@/components/ui/Badge';
import Card from '@/components/ui/Card';
import { useLanguage } from '@/context/LanguageContext';

interface PepperCardProps {
  pepper: Pepper;
}

function HeatBadge({ min, max }: { min?: number | null; max?: number | null }) {
  if (min == null && max == null) return null;
  const label =
    max != null
      ? `${(min ?? 0).toLocaleString()}–${max.toLocaleString()} SHU`
      : `${min?.toLocaleString()} SHU`;

  return (
    <Badge className="self-start w-fit bg-gray-100 text-gray-600 border border-gray-200 shrink-0">
      🌶 <span dir="ltr" style={{ unicodeBidi: 'isolate' }}>{label}</span>
    </Badge>
  );
}

export default function PepperCard({ pepper }: PepperCardProps) {
  const { t } = useLanguage();
  return (
    <Card className="overflow-hidden flex flex-col h-full transition-shadow hover:shadow-md rounded-2xl">
      {/* Image */}
      <div className="w-full h-48 bg-gray-50 flex items-center justify-center overflow-hidden border-b border-gray-100">
        {pepper.ImageUrl ? (
          <img
            src={pepper.ImageUrl}
            alt={pepper.PepperName}
            className="w-full h-full object-cover"
            onError={(e) => {
              const img = e.currentTarget as HTMLImageElement;
              img.style.display = 'none';
              const parent = img.parentElement as HTMLElement;
              parent.innerHTML = '<span style="font-size:2.5rem">🌶️</span>';
            }}
          />
        ) : (
          <span className="text-5xl opacity-30">🌶️</span>
        )}
      </div>

      {/* Body */}
      <div className="p-4 flex flex-col gap-2 flex-1">
        {/* Name on its own full-width line (up to 2 lines) */}
        <h3 className="text-sm font-semibold text-gray-900 leading-snug line-clamp-2">{pepper.PepperName}</h3>

        {/* SHU badge on its own row below the name */}
        <HeatBadge min={pepper.HeatLevelScovilleMin} max={pepper.HeatLevelScovilleMax} />

        {pepper.ScientificName && (
          <p className="text-xs text-gray-400 italic leading-none">{pepper.ScientificName}</p>
        )}

        {pepper.GeneralDescription && (
          <p className="text-xs text-gray-500 leading-relaxed line-clamp-3 mt-0.5">
            {pepper.GeneralDescription}
          </p>
        )}

        {(pepper.OptimalPARMin != null || pepper.OptimalPARMax != null) && (
          <p className="text-xs text-gray-400 pt-1" dir="ltr">
            PAR:{' '}
            <span className="text-purple-600 font-medium" dir="ltr" style={{ unicodeBidi: 'isolate' }}>
              {pepper.OptimalPARMin != null ? pepper.OptimalPARMin : '—'}
              {' – '}
              {pepper.OptimalPARMax != null ? pepper.OptimalPARMax : '—'}
              {' µmol/m²/s'}
            </span>
          </p>
        )}

        {pepper.Zone && (
          <p className="text-xs text-gray-400 mt-auto pt-2 border-t border-gray-100">
            {t.peppers.zoneLabel}: <span className="text-gray-600 font-medium">{pepper.Zone}</span>
          </p>
        )}
      </div>
    </Card>
  );
}
