'use client';

import { useState, useRef, useEffect } from 'react';
import { FARM_SECTIONS, type FarmSectionData } from '@/data/farmSections';
import { PlantData } from '@/services/plants';

interface ZoneData {
  ZoneName: string;
  ZoneCode: string;
  AreaSquareMeters: number | null;
  Description: string | null;
  SoilType: string | null;
  IrrigationMethod: string | null;
  Notes: string | null;
  pepper: {
    PepperId: number;
    PepperName: string;
    ScientificName: string | null;
    HeatLevelScovilleMin: number | null;
    HeatLevelScovilleMax: number | null;
    GeneralDescription: string | null;
    ImageUrl: string | null;
  } | null;
}

export type FarmSection = FarmSectionData;

const MAP_WIDTH = 1200;
const MAP_HEIGHT = 400;

const sections = FARM_SECTIONS;

const ZONE_CODE_TO_ID: Record<string, number> = {
  'GH-01': 1,  'GH-02': 2,  'GH-03': 3,  'GH-04': 4,
  'GH-05': 5,  'GH-06': 6,  'GH-07': 7,  'GH-08': 8,
  'NURSERY': 9, 'SHED-MAIN': 10, 'GH-09': 11, 'GH-10': 12,
  'GERM-01': 13, 'GERM-02': 14, 'VIS-CENTER': 15,
  'GERM-03': 16, 'GERM-04': 17, 'FACTORY': 18,
};

const TYPE_ICONS: Record<FarmSection['type'], string> = {
  greenhouse: '🌿',
  nursery: '🌱',
  building: '🏠',
  growing: '🌾',
  germination: '🌰',
  visitor: '👥',
  production: '🏭',
};

const LEGEND_ITEMS = [
  { color: '#a8d5a3', label: 'חממה גדולה' },
  { color: '#2b8333', label: 'משתלה' },
  { color: '#b8d96f', label: 'חממה קטנה' },
  { color: '#a8e6cf', label: 'חממת מבקרים' },
  { color: '#c7e9c0', label: 'מרכז מבקרים' },
  { color: '#c9c4b8', label: 'חניה' },
  { color: '#3d4a4d', label: 'מפעל ייצור' },
];

interface FarmMapProps {
  sectionColors?: Record<string, string>;
  plants?: PlantData[];
  renderPopupExtra?: (section: FarmSection, zoneData: ZoneData | null, zoneLoading: boolean) => React.ReactNode;
}

export default function FarmMap({ sectionColors, plants = [], renderPopupExtra }: FarmMapProps = {}) {
  const [selected,    setSelected]    = useState<FarmSection | null>(null);
  const [zoneData,    setZoneData]    = useState<ZoneData | null>(null);
  const [zoneLoading, setZoneLoading] = useState(false);
  const [hovered,     setHovered]     = useState<string | null>(null);
  const [scale,       setScale]       = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const update = () => {
      if (containerRef.current) {
        const w = containerRef.current.offsetWidth;
        setScale(Math.min(1, w / MAP_WIDTH));
      }
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const handleSectionClick = (section: FarmSection) => {
    setSelected(section);
    setZoneData(null);
    setZoneLoading(true);
    fetch(`http://localhost:8000/api/zones/${section.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setZoneData(data))
      .catch(() => setZoneData(null))
      .finally(() => setZoneLoading(false));
  };

  const MIN_SCALE = 0.28;
  const effectiveScale = Math.max(MIN_SCALE, scale);
  const scaledHeight = Math.round(MAP_HEIGHT * effectiveScale);
  const needsScroll = scale < MIN_SCALE;

  return (
    <div className="w-full">
      {/* Map canvas */}
      <div
        ref={containerRef}
        style={{
          height: scaledHeight,
          position: 'relative',
          overflowX: needsScroll ? 'auto' : 'hidden',
          overflowY: 'hidden',
          WebkitOverflowScrolling: 'touch' as React.CSSProperties['WebkitOverflowScrolling'],
        }}
      >
        <div
          style={{
            width: MAP_WIDTH,
            height: MAP_HEIGHT,
            position: 'relative',
            backgroundColor: '#fafaf8',
            border: '2px solid #3d4a4d',
            borderRadius: '2px',
            transformOrigin: 'top left',
            transform: `scale(${effectiveScale})`,
          }}
        >
          {sections.map((section) => {
            const isVertical =
              section.type === 'greenhouse' ||
              section.type === 'nursery' ||
              section.type === 'production';
            const isHovered = hovered === section.id;

            return (
              <div
                key={section.id}
                onClick={() => handleSectionClick(section)}
                onMouseEnter={() => setHovered(section.id)}
                onMouseLeave={() => setHovered(null)}
                style={{
                  position: 'absolute',
                  left: section.position.x,
                  top: section.position.y,
                  width: section.position.width,
                  height: section.position.height,
                  backgroundColor: (sectionColors && sectionColors[section.id]) ?? section.color,
                  border: isHovered ? '2px solid #2d3a2e' : '1px solid rgba(45,58,46,0.2)',
                  borderRadius: 2,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: isHovered ? '0 8px 16px rgba(0,0,0,0.2)' : '0 2px 6px rgba(0,0,0,0.08)',
                  transform: isHovered ? 'scale(1.04)' : 'scale(1)',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease, border 0.1s',
                  zIndex: isHovered ? 2 : 1,
                  userSelect: 'none',
                }}
              >
                {isVertical ? (
                  <div
                    style={{
                      writingMode: 'vertical-rl',
                      transform: 'rotate(180deg)',
                      textAlign: 'center',
                      color: section.type === 'production' ? '#fff' : '#2d3a2e',
                      fontSize: `${(section.type === 'production' ? 0.85 : 0.75) / effectiveScale}rem`,
                      fontWeight: 600,
                      pointerEvents: 'none',
                    }}
                  >
                    <div>{section.name}</div>
                    {section.area && (
                      <div style={{ fontSize: `${0.65 / effectiveScale}rem`, marginTop: 4 }}>{section.area}</div>
                    )}
                  </div>
                ) : section.type === 'growing' ? (
                  <div style={{ textAlign: 'center', pointerEvents: 'none' }}>
                    <div style={{ color: '#2d3a2e', fontSize: `${0.75 / effectiveScale}rem`, fontWeight: 600 }}>
                      {section.name}
                    </div>
                    {section.area && (
                      <div style={{ color: '#2d3a2e', fontSize: `${0.65 / effectiveScale}rem`, marginTop: 2 }}>
                        {section.area}
                      </div>
                    )}
                  </div>
                ) : (
                  <div
                    style={{
                      textAlign: 'center',
                      color: '#2d3a2e',
                      fontSize: `${(section.type === 'building' ? 0.9 : 0.7) / effectiveScale}rem`,
                      fontWeight: 600,
                      pointerEvents: 'none',
                      padding: '4px',
                    }}
                  >
                    {section.name}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-3">
        {LEGEND_ITEMS.map((item) => (
          <div key={item.label} className="flex items-center gap-1.5">
            <span
              style={{
                display: 'inline-block',
                width: 14,
                height: 14,
                backgroundColor: item.color,
                border: '1px solid rgba(45,58,46,0.25)',
                borderRadius: 2,
                flexShrink: 0,
              }}
            />
            <span className="text-xs text-gray-600">{item.label}</span>
          </div>
        ))}
      </div>

      {/* Detail modal */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 relative overflow-y-auto max-h-[90vh]"
            style={{ border: `4px solid ${selected.color}` }}
            dir="rtl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelected(null)}
              className="absolute top-3 left-3 w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors text-gray-500 text-lg"
              aria-label="Close"
            >
              ✕
            </button>

            <div className="flex items-start gap-4 mb-5">
              <div
                className="w-12 h-12 rounded-lg flex items-center justify-center text-2xl shrink-0"
                style={{ backgroundColor: selected.color }}
              >
                {TYPE_ICONS[selected.type]}
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">{selected.name}</h2>
              </div>
            </div>

            {selected.area && (
              <div className="mb-3 p-3 rounded-lg bg-gray-50">
                <p className="text-xs text-gray-400 mb-1">שטח</p>
                <p className="text-xl font-bold text-gray-900">{selected.area}</p>
              </div>
            )}

            {zoneData?.Description && (
              <p className="text-sm text-gray-600 mb-3">{zoneData.Description}</p>
            )}

            {/* Pepper info */}
            <div className="mb-3">
              {zoneLoading ? (
                <p className="text-xs text-gray-400 animate-pulse">טוען מידע על גידול...</p>
              ) : zoneData?.pepper ? (
                <div className="p-3 rounded-lg bg-green-50 border border-green-100">
                  <p className="text-xs text-green-600 font-medium mb-2">🌶 גידול נוכחי</p>
                  <p className="text-base font-bold text-gray-900">{zoneData.pepper.PepperName}</p>
                  {zoneData.pepper.ScientificName && (
                    <p className="text-xs text-gray-500 italic mt-0.5">{zoneData.pepper.ScientificName}</p>
                  )}
                  {(zoneData.pepper.HeatLevelScovilleMin != null || zoneData.pepper.HeatLevelScovilleMax != null) && (
                    <p className="text-xs text-orange-600 mt-1">
                      🔥 {zoneData.pepper.HeatLevelScovilleMin?.toLocaleString()} – {zoneData.pepper.HeatLevelScovilleMax?.toLocaleString()} SHU
                    </p>
                  )}
                  {zoneData.pepper.GeneralDescription && (
                    <p className="text-xs text-gray-500 mt-2 line-clamp-2">{zoneData.pepper.GeneralDescription}</p>
                  )}
                </div>
              ) : zoneData && !zoneData.pepper ? (
                <p className="text-xs text-gray-400">אין גידול משויך לאזור זה.</p>
              ) : null}
            </div>

            {/* Plants list */}
            {(() => {
              const zoneId = ZONE_CODE_TO_ID[selected.id];
              const zonePlants = plants.filter(p => p.ZoneId === zoneId);
              if (zonePlants.length === 0) return null;
              return (
                <div className="mb-3 border-t border-gray-100 pt-3">
                  <p className="text-xs text-gray-500 font-medium mb-2">🌿 צמחים באזור זה ({zonePlants.length}):</p>
                  <div className="flex flex-col gap-1 max-h-32 overflow-y-auto">
                    {zonePlants.map(plant => (
                      <div key={plant.PlantId} className="flex items-center gap-2 px-2 py-1 rounded bg-green-50 text-xs text-gray-700">
                        <span>🌱</span>
                        <span className="font-medium">{plant.PlantCode}</span>
                        {plant.Status && <span className="text-gray-400">— {plant.Status}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {renderPopupExtra && renderPopupExtra(selected, zoneData, zoneLoading)}

            <div className="flex items-center gap-2 text-xs text-gray-400 pt-3 border-t border-gray-100">
              <span>📍</span>
              <span>מפת חווה · אינטראקטיבי</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
