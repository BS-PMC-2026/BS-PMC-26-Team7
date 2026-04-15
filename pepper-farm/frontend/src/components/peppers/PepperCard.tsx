import { Pepper } from '@/types/pepper';
import Badge from '@/components/ui/Badge';
import Card from '@/components/ui/Card';

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
    <Badge className="bg-gray-100 text-gray-600 border border-gray-200 shrink-0">
      🌶 {label}
    </Badge>
  );
}

export default function PepperCard({ pepper }: PepperCardProps) {
  return (
    <Card className="overflow-hidden flex flex-col transition-shadow hover:shadow-md rounded-2xl">
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
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold text-gray-900 leading-snug">{pepper.PepperName}</h3>
          <HeatBadge min={pepper.HeatLevelScovilleMin} max={pepper.HeatLevelScovilleMax} />
        </div>

        {pepper.ScientificName && (
          <p className="text-xs text-gray-400 italic leading-none">{pepper.ScientificName}</p>
        )}

        {pepper.GeneralDescription && (
          <p className="text-xs text-gray-500 leading-relaxed line-clamp-3 mt-0.5">
            {pepper.GeneralDescription}
          </p>
        )}

        {pepper.Zone && (
          <p className="text-xs text-gray-400 mt-auto pt-2 border-t border-gray-100">
            Zone: <span className="text-gray-600 font-medium">{pepper.Zone}</span>
          </p>
        )}
      </div>
    </Card>
  );
}
