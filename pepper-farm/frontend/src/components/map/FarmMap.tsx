'use client';

import { useState, useRef, useEffect } from 'react';
import { FARM_SECTIONS, TYPE_BORDER_COLORS, TYPE_LABELS, type FarmSectionData } from '@/data/farmSections';
import { PlantData } from '@/services/plants';
import { useLanguage } from '@/context/LanguageContext';
import { Task } from '@/types/task';
import { ZoneHealth } from '@/types/anomaly';
import { API_URL } from '@/lib/constants';

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
export type MapFilter = 'pepper' | 'task' | 'sensor' | null;

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

const OPEN_STATUSES = new Set(['todo', 'in_progress']);

function getZoneOverlay(
  sectionId: string,
  activeFilter: MapFilter,
  tasks: Task[],
  zoneHealth: ZoneHealth[],
  plants: PlantData[],
): { fill: string | null; pulse: boolean } {
  const zoneId = ZONE_CODE_TO_ID[sectionId];

  if (activeFilter === null) {
    const hasTask   = tasks.some(t => t.zoneCode === sectionId && OPEN_STATUSES.has(t.status));
    const health    = zoneHealth.find(z => z.zoneCode === sectionId);
    const hasSensor = health != null && health.health !== 'normal';
    if (hasTask && hasSensor) return { fill: 'rgba(220,38,38,0.15)',  pulse: true  };
    if (hasTask)              return { fill: 'rgba(239,68,68,0.12)',  pulse: false };
    if (hasSensor)            return { fill: 'rgba(249,115,22,0.12)', pulse: false };
    return { fill: null, pulse: false };
  }

  if (activeFilter === 'pepper') {
    const has = zoneId != null && plants.some(p => p.ZoneId === zoneId);
    return { fill: has ? 'rgba(22,163,74,0.15)' : 'rgba(209,213,219,0.35)', pulse: false };
  }

  if (activeFilter === 'task') {
    const has = tasks.some(t => t.zoneCode === sectionId && OPEN_STATUSES.has(t.status));
    return { fill: has ? 'rgba(239,68,68,0.15)' : 'rgba(209,213,219,0.35)', pulse: false };
  }

  if (activeFilter === 'sensor') {
    const health = zoneHealth.find(z => z.zoneCode === sectionId);
    if (!health) return { fill: 'rgba(229,231,235,0.5)', pulse: false };
    if (health.health === 'high')   return { fill: 'rgba(239,68,68,0.18)',   pulse: false };
    if (health.health === 'medium') return { fill: 'rgba(249,115,22,0.15)',  pulse: false };
    return { fill: 'rgba(74,222,128,0.18)', pulse: false };
  }

  return { fill: null, pulse: false };
}

interface FarmMapProps {
  sectionColors?: Record<string, string>;
  plants?: PlantData[];
  renderPopupExtra?: (section: FarmSection, zoneData: ZoneData | null, zoneLoading: boolean) => React.ReactNode;
  activeFilter?: MapFilter;
  tasks?: Task[];
  zoneHealth?: ZoneHealth[];
  showLegend?: boolean;
}

export default function FarmMap({
  sectionColors,
  plants = [],
  renderPopupExtra,
  activeFilter = null,
  tasks = [],
  zoneHealth = [],
  showLegend = true,
}: FarmMapProps = {}) {
  const [selected,    setSelected]    = useState<FarmSection | null>(null);
  const [zoneData,    setZoneData]    = useState<ZoneData | null>(null);
  const [zoneLoading, setZoneLoading] = useState(false);
  const [hovered,     setHovered]     = useState<string | null>(null);
  const [scale,       setScale]       = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);
  const { t, locale, dir } = useLanguage();
  const ma = t.map;

  // ── Legends ────────────────────────────────────────────────────────────────

  const ALERT_LEGEND = [
    { color: 'rgba(220,38,38,0.2)',   border: '#dc2626', label: ma.legendBothAlerts,  pulse: true  },
    { color: 'rgba(239,68,68,0.15)',  border: '#ef4444', label: ma.legendTaskAlert,   pulse: false },
    { color: 'rgba(249,115,22,0.15)', border: '#f97316', label: ma.legendSensorAlert, pulse: false },
    { color: 'transparent',           border: '#9ca3af', label: ma.legendNeutral,     pulse: false },
  ];

  const FILTER_LEGENDS: Record<NonNullable<MapFilter>, { color: string; border: string; label: string }[]> = {
    pepper: [
      { color: 'rgba(22,163,74,0.18)',  border: '#16a34a', label: ma.legendHasPepper },
      { color: 'rgba(209,213,219,0.5)', border: '#9ca3af', label: ma.legendNoPepper  },
    ],
    task: [
      { color: 'rgba(239,68,68,0.18)',  border: '#ef4444', label: ma.legendHasTasks },
      { color: 'rgba(209,213,219,0.5)', border: '#9ca3af', label: ma.legendNoTasks  },
    ],
    sensor: [
      { color: 'rgba(239,68,68,0.2)',   border: '#ef4444', label: ma.legendSensorHigh   },
      { color: 'rgba(249,115,22,0.18)', border: '#f97316', label: ma.legendSensorMedium },
      { color: 'rgba(74,222,128,0.2)',  border: '#4ade80', label: ma.legendSensorNormal },
      { color: 'rgba(229,231,235,0.6)', border: '#9ca3af', label: ma.legendNoSensorData },
    ],
  };

  const activeLegend = activeFilter ? FILTER_LEGENDS[activeFilter] : ALERT_LEGEND;

  // Unique zone types in the order they appear
  const uniqueTypes = Array.from(new Set(sections.map(s => s.type)));

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
    fetch(`${API_URL}/api/zones/${section.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setZoneData(data))
      .catch(() => setZoneData(null))
      .finally(() => setZoneLoading(false));
  };

  const sectionLabel = (section: FarmSection) =>
    locale === 'he' ? section.name : section.nameEn;

  const sectionArea = (section: FarmSection) =>
    locale === 'he' ? (section.area ?? null) : (section.areaEn ?? section.area ?? null);

  const MIN_SCALE = 0.28;
  const effectiveScale = Math.max(MIN_SCALE, scale);
  const scaledHeight = Math.round(MAP_HEIGHT * effectiveScale);
  const needsScroll = scale < MIN_SCALE;

  // ── Popup helpers ───────────────────────────────────────────────────────────

  const renderAlertSummary = (section: FarmSection) => {
    const openTasks      = tasks.filter(t => t.zoneCode === section.id && OPEN_STATUSES.has(t.status));
    const health         = zoneHealth.find(z => z.zoneCode === section.id);
    const hasSensorAlert = health != null && health.health !== 'normal';

    if (openTasks.length === 0 && !hasSensorAlert) {
      return <p className="text-sm text-green-600 py-2">{ma.mapNoAlerts}</p>;
    }
    return (
      <div className="flex flex-col gap-2">
        {openTasks.length > 0 && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-red-50 border border-red-100 text-sm">
            <span>📋</span>
            <span className="font-medium text-red-700">{openTasks.length} {ma.mapOpenTasksCount}</span>
          </div>
        )}
        {hasSensorAlert && health && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-orange-50 border border-orange-100 text-sm">
            <span>⚠️</span>
            <span className="font-medium text-orange-700">
              {health.totalAlerts} {ma.mapSensorAlertsCount}
              {health.health === 'high' && (
                <span className="ml-1 text-xs text-red-600 font-semibold">(High)</span>
              )}
            </span>
          </div>
        )}
      </div>
    );
  };

  const renderTaskPanel = (section: FarmSection) => {
    const openTasks = tasks.filter(t => t.zoneCode === section.id && OPEN_STATUSES.has(t.status));
    if (openTasks.length === 0) {
      return <p className="text-xs text-gray-400 py-1">{ma.noOpenTasksInZone}</p>;
    }
    return (
      <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto">
        {openTasks.map(task => (
          <div key={task.id} className="p-2 rounded-lg bg-gray-50 border border-gray-100 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-gray-800 truncate">{task.title}</span>
              <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${
                task.priority === 'critical' ? 'bg-red-100 text-red-700'    :
                task.priority === 'high'     ? 'bg-orange-100 text-orange-700' :
                task.priority === 'medium'   ? 'bg-yellow-100 text-yellow-700' :
                                               'bg-gray-100 text-gray-600'
              }`}>{task.priority}</span>
            </div>
            {task.description && (
              <p className="text-gray-500 mt-0.5 line-clamp-1">{task.description}</p>
            )}
            <p className="text-gray-400 mt-0.5 capitalize">{task.status.replace('_', ' ')}</p>
          </div>
        ))}
      </div>
    );
  };

  const renderSensorPanel = (section: FarmSection) => {
    const health = zoneHealth.find(z => z.zoneCode === section.id);
    if (!health) {
      return <p className="text-xs text-gray-400 py-1">{ma.legendNoSensorData}</p>;
    }
    const colorMap = {
      high:   'text-red-700 bg-red-50',
      medium: 'text-orange-700 bg-orange-50',
      normal: 'text-green-700 bg-green-50',
    };
    return (
      <div className={`p-3 rounded-lg text-sm font-medium ${colorMap[health.health] ?? 'text-gray-600 bg-gray-50'}`}>
        <div className="flex items-center gap-2">
          <span>{health.health === 'normal' ? '✅' : health.health === 'medium' ? '⚠️' : '🔴'}</span>
          <span className="capitalize">
            {health.health === 'high'   ? ma.legendSensorHigh   :
             health.health === 'medium' ? ma.legendSensorMedium :
                                         ma.legendSensorNormal}
          </span>
        </div>
        <p className="text-xs mt-1 font-normal opacity-80">
          {health.totalAlerts} total alerts · {health.highAlerts} high severity
        </p>
      </div>
    );
  };

  const renderPepperContent = (section: FarmSection) => {
    const zoneId     = ZONE_CODE_TO_ID[section.id];
    const zonePlants = plants.filter(p => p.ZoneId === zoneId);
    return (
      <>
        {zoneData?.Description && (
          <p className="text-sm text-gray-600 mb-3">{zoneData.Description}</p>
        )}
        <div className="mb-3">
          {zoneLoading ? (
            <p className="text-xs text-gray-400 animate-pulse">{ma.mapLoadingCropInfo}</p>
          ) : zoneData?.pepper ? (
            <div className="p-3 rounded-lg bg-green-50 border border-green-100">
              <p className="text-xs text-green-600 font-medium mb-2">{ma.mapCurrentCrop}</p>
              <p className="text-base font-bold text-gray-900">{zoneData.pepper.PepperName}</p>
              {zoneData.pepper.ScientificName && (
                <p className="text-xs text-gray-500 italic mt-0.5">{zoneData.pepper.ScientificName}</p>
              )}
              {(zoneData.pepper.HeatLevelScovilleMin != null || zoneData.pepper.HeatLevelScovilleMax != null) && (
                <p className="text-xs text-orange-600 mt-1" dir="ltr">
                  🔥 {zoneData.pepper.HeatLevelScovilleMin?.toLocaleString()} –{' '}
                  {zoneData.pepper.HeatLevelScovilleMax?.toLocaleString()} SHU
                </p>
              )}
              {zoneData.pepper.GeneralDescription && (
                <p className="text-xs text-gray-500 mt-2 line-clamp-2">{zoneData.pepper.GeneralDescription}</p>
              )}
            </div>
          ) : zoneData && !zoneData.pepper ? (
            <p className="text-xs text-gray-400">{ma.mapNoCropAssigned}</p>
          ) : null}
        </div>
        {zonePlants.length > 0 && (
          <div className="mb-3 border-t border-gray-100 pt-3">
            <p className="text-xs text-gray-500 font-medium mb-2">
              {ma.mapPlantsInZone} ({zonePlants.length}):
            </p>
            <div className="flex flex-col gap-1 max-h-32 overflow-y-auto">
              {zonePlants.map(plant => (
                <div key={plant.PlantId} className="flex items-center gap-2 px-2 py-1 rounded bg-green-50 text-xs text-gray-700">
                  <span>🌱</span>
                  <span className="font-medium" dir="ltr">{plant.PlantCode}</span>
                  {plant.Status && <span className="text-gray-400">— {plant.Status}</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </>
    );
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="w-full">

      {/* ── Map canvas ── */}
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
        <style>{`
          @keyframes farmPulse {
            0%, 100% { opacity: 1; }
            50%       { opacity: 0.5; }
          }
          .zone-pulse { animation: farmPulse 1.4s ease-in-out infinite; }
        `}</style>

        <div
          style={{
            width: MAP_WIDTH,
            height: MAP_HEIGHT,
            position: 'relative',
            backgroundColor: '#f9f9f7',
            border: '2px solid #3d4a4d',
            borderRadius: '2px',
            transformOrigin: 'top left',
            transform: `scale(${effectiveScale})`,
          }}
        >
          {sections.map((section) => {
            const isVertical =
              section.type === 'greenhouse' ||
              section.type === 'nursery'    ||
              section.type === 'production';

            const isHovered    = hovered === section.id;
            const isProduction = section.type === 'production';
            const label        = sectionLabel(section);
            const area         = sectionArea(section);

            const borderColor = TYPE_BORDER_COLORS[section.type];
            const { fill: overlayFill, pulse } = getZoneOverlay(
              section.id, activeFilter, tasks, zoneHealth, plants
            );

            // Production keeps a dark fill; all others are white
            const bgColor   = isProduction ? '#3d4a4d' : '#ffffff';
            const textColor = isProduction ? '#ffffff'  : '#2d3a2e';

            return (
              <div
                key={section.id}
                className={pulse ? 'zone-pulse' : undefined}
                onClick={() => handleSectionClick(section)}
                onMouseEnter={() => setHovered(section.id)}
                onMouseLeave={() => setHovered(null)}
                style={{
                  position: 'absolute',
                  left:   section.position.x,
                  top:    section.position.y,
                  width:  section.position.width,
                  height: section.position.height,
                  backgroundColor: bgColor,
                  border: `${isHovered ? 3 : 2}px solid ${borderColor}`,
                  borderRadius: 3,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  boxShadow: isHovered
                    ? `0 6px 18px rgba(0,0,0,0.15), inset 0 0 0 1px ${borderColor}33`
                    : '0 1px 3px rgba(0,0,0,0.05)',
                  transform: isHovered ? 'scale(1.04)' : 'scale(1)',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease, border-width 0.1s, background-color 0.3s ease',
                  zIndex: isHovered ? 2 : 1,
                  userSelect: 'none',
                }}
              >
                {/* Translucent filter/alert overlay — only for non-production zones */}
                {overlayFill && !isProduction && (
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      backgroundColor: overlayFill,
                      pointerEvents: 'none',
                    }}
                  />
                )}

                {/* Zone label */}
                {isVertical ? (
                  <div
                    style={{
                      writingMode: 'vertical-rl',
                      transform: 'rotate(180deg)',
                      textAlign: 'center',
                      color: textColor,
                      fontSize: `${(isProduction ? 0.85 : 0.75) / effectiveScale}rem`,
                      fontWeight: 600,
                      pointerEvents: 'none',
                      position: 'relative',
                      zIndex: 1,
                    }}
                  >
                    <div>{label}</div>
                    {area && (
                      <div style={{ fontSize: `${0.65 / effectiveScale}rem`, marginTop: 4, fontWeight: 400 }}>
                        {area}
                      </div>
                    )}
                  </div>
                ) : section.type === 'growing' ? (
                  <div style={{ textAlign: 'center', pointerEvents: 'none', position: 'relative', zIndex: 1 }}>
                    <div style={{ color: textColor, fontSize: `${0.75 / effectiveScale}rem`, fontWeight: 600 }}>
                      {label}
                    </div>
                    {area && (
                      <div style={{ color: textColor, fontSize: `${0.65 / effectiveScale}rem`, marginTop: 2, fontWeight: 400 }}>
                        {area}
                      </div>
                    )}
                  </div>
                ) : (
                  <div
                    style={{
                      textAlign: 'center',
                      color: textColor,
                      fontSize: `${(section.type === 'building' ? 0.9 : 0.7) / effectiveScale}rem`,
                      fontWeight: 600,
                      pointerEvents: 'none',
                      padding: '4px',
                      position: 'relative',
                      zIndex: 1,
                    }}
                  >
                    {label}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Legends ── */}
      {showLegend && (
      <div className="mt-4 flex flex-col gap-3">

        {/* Status legend (alert view or active filter) */}
        <div className="flex flex-wrap gap-3">
          {activeLegend.map((item) => (
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

        {/* Zone-type legend — always visible */}
        <div className="flex flex-wrap gap-3 pt-2 border-t border-gray-100">
          {uniqueTypes.map((type) => {
            const bc    = TYPE_BORDER_COLORS[type];
            const label = locale === 'he' ? TYPE_LABELS[type].he : TYPE_LABELS[type].en;
            return (
              <div key={type} className="flex items-center gap-1.5">
                <span
                  style={{
                    display: 'inline-block',
                    width: 14,
                    height: 14,
                    backgroundColor: type === 'production' ? '#3d4a4d' : '#ffffff',
                    border: `2px solid ${bc}`,
                    borderRadius: 2,
                    flexShrink: 0,
                  }}
                />
                <span className="text-xs text-gray-500">{label}</span>
              </div>
            );
          })}
        </div>
      </div>
      )}

      {/* ── Detail modal ── */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 relative overflow-y-auto max-h-[90vh]"
            style={{ border: `3px solid ${TYPE_BORDER_COLORS[selected.type]}` }}
            dir={dir}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelected(null)}
              className="absolute top-3 left-3 w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors text-gray-500 text-lg"
              aria-label="Close"
            >
              ✕
            </button>

            {/* Header */}
            <div className="flex items-start gap-4 mb-5">
              <div
                className="w-12 h-12 rounded-lg flex items-center justify-center text-2xl shrink-0"
                style={{
                  border: `2px solid ${TYPE_BORDER_COLORS[selected.type]}`,
                  backgroundColor: 'transparent',
                }}
              >
                {TYPE_ICONS[selected.type]}
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">{sectionLabel(selected)}</h2>
              </div>
            </div>

            {/* Area */}
            {sectionArea(selected) && (
              <div className="mb-3 p-3 rounded-lg bg-gray-50">
                <p className="text-xs text-gray-400 mb-1">{ma.mapArea}</p>
                <p className="text-xl font-bold text-gray-900" dir="ltr">{sectionArea(selected)}</p>
              </div>
            )}

            {/* Filter-aware body */}
            {activeFilter === null && (
              <div className="mb-3">
                <p className="text-xs text-gray-500 font-semibold mb-2">{ma.mapZoneAlerts}</p>
                {renderAlertSummary(selected)}
              </div>
            )}

            {activeFilter === 'pepper' && renderPepperContent(selected)}

            {activeFilter === 'task' && (
              <div className="mb-3">
                <p className="text-xs text-gray-500 font-semibold mb-2">{ma.mapTasksInZone}</p>
                {renderTaskPanel(selected)}
              </div>
            )}

            {activeFilter === 'sensor' && (
              <div className="mb-3">
                <p className="text-xs text-gray-500 font-semibold mb-2">{ma.mapSensorHealthInZone}</p>
                {renderSensorPanel(selected)}
              </div>
            )}

            {renderPopupExtra && renderPopupExtra(selected, zoneData, zoneLoading)}

            <div className="flex items-center gap-2 text-xs text-gray-400 pt-3 border-t border-gray-100">
              <span>📍</span>
              <span>{ma.mapInteractive}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
