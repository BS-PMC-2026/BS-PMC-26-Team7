'use client';

import { useState, useRef, useEffect } from 'react';
import { FARM_SECTIONS, TYPE_BORDER_COLORS } from '@/data/farmSections';
import { ZoneSprayStatusData, ZoneSprayStatus } from '@/types/spray';

// ── Colour palette per safety status ─────────────────────────────────────────

const STATUS_COLORS: Record<
  ZoneSprayStatus,
  { fill: string; border: string; label: string; emoji: string }
> = {
  safe:              { fill: 'rgba(22,163,74,0.18)',   border: '#16a34a', label: 'Safe (re-entry allowed)',    emoji: '✅' },
  unsafe:            { fill: 'rgba(239,68,68,0.22)',   border: '#dc2626', label: 'Unsafe (within REI window)', emoji: '🚫' },
  requires_approval: { fill: 'rgba(245,158,11,0.22)',  border: '#d97706', label: 'Caution — Safety unverified', emoji: '⚠️' },
  pending:           { fill: 'rgba(99,102,241,0.18)',  border: '#6366f1', label: 'Spray planned',              emoji: '📅' },
  never_sprayed:     { fill: 'rgba(156,163,175,0.25)', border: '#9ca3af', label: 'Never sprayed',              emoji: '○' },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString([], {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString([], {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

const MAP_WIDTH  = 1200;
const MAP_HEIGHT = 400;
const MIN_SCALE  = 0.28;

interface SprayZoneMapProps {
  zones: ZoneSprayStatusData[];
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function SprayZoneMap({ zones }: SprayZoneMapProps) {
  const [selected, setSelected] = useState<ZoneSprayStatusData | null>(null);
  const [hovered,  setHovered]  = useState<string | null>(null);
  const [scale,    setScale]    = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);

  const byCode = Object.fromEntries(zones.map((z) => [z.zoneCode, z]));

  useEffect(() => {
    const update = () => {
      if (containerRef.current) {
        setScale(Math.min(1, containerRef.current.offsetWidth / MAP_WIDTH));
      }
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const effectiveScale = Math.max(MIN_SCALE, scale);
  const scaledHeight   = Math.round(MAP_HEIGHT * effectiveScale);
  const needsScroll    = scale < MIN_SCALE;

  const handleClick = (sectionId: string) => {
    const zone = byCode[sectionId] ?? null;
    setSelected(zone);
  };

  return (
    <div className="w-full">

      {/* ── Map canvas ────────────────────────────────────────────────────── */}
      <div
        ref={containerRef}
        style={{
          height: scaledHeight,
          position: 'relative',
          overflowX: needsScroll ? 'auto' : 'hidden',
          overflowY: 'hidden',
        }}
      >
        <div
          style={{
            width:           MAP_WIDTH,
            height:          MAP_HEIGHT,
            position:        'relative',
            backgroundColor: '#f9f9f7',
            border:          '2px solid #3d4a4d',
            borderRadius:    '2px',
            transformOrigin: 'top left',
            transform:       `scale(${effectiveScale})`,
          }}
        >
          {FARM_SECTIONS.map((section) => {
            const zone        = byCode[section.id];
            const status      = zone?.sprayStatus ?? 'never_sprayed';
            const palette     = STATUS_COLORS[status];
            const isHovered   = hovered === section.id;
            const isProduction = section.type === 'production';

            // Sprayable zones get the status fill; non-sprayable get zone-type border only.
            const isSprayable =
              section.id.startsWith('GH-') ||
              section.id.startsWith('GERM-') ||
              section.id === 'NURSERY';

            const borderColor = isSprayable ? palette.border : TYPE_BORDER_COLORS[section.type];
            const overlayFill = isSprayable && !isProduction ? palette.fill : null;

            return (
              <div
                key={section.id}
                onClick={() => handleClick(section.id)}
                onMouseEnter={() => setHovered(section.id)}
                onMouseLeave={() => setHovered(null)}
                style={{
                  position:        'absolute',
                  left:            section.position.x,
                  top:             section.position.y,
                  width:           section.position.width,
                  height:          section.position.height,
                  backgroundColor: isProduction ? '#3d4a4d' : '#ffffff',
                  border:          `${isHovered ? 3 : 2}px solid ${borderColor}`,
                  borderRadius:    3,
                  cursor:          'pointer',
                  display:         'flex',
                  alignItems:      'center',
                  justifyContent:  'center',
                  overflow:        'hidden',
                  boxShadow:       isHovered
                    ? `0 6px 18px rgba(0,0,0,0.15), inset 0 0 0 1px ${borderColor}33`
                    : '0 1px 3px rgba(0,0,0,0.05)',
                  transform:       isHovered ? 'scale(1.04)' : 'scale(1)',
                  transition:      'transform 0.15s ease, box-shadow 0.15s ease',
                  zIndex:          isHovered ? 2 : 1,
                  userSelect:      'none',
                }}
              >
                {/* Status colour overlay */}
                {overlayFill && (
                  <div
                    style={{
                      position:        'absolute',
                      inset:           0,
                      backgroundColor: overlayFill,
                      pointerEvents:   'none',
                    }}
                  />
                )}

                {/* Zone label */}
                <div
                  style={{
                    writingMode:    section.type === 'greenhouse' || section.type === 'nursery' || section.type === 'production'
                      ? 'vertical-rl' : undefined,
                    transform:      section.type === 'greenhouse' || section.type === 'nursery' || section.type === 'production'
                      ? 'rotate(180deg)' : undefined,
                    textAlign:      'center',
                    color:          isProduction ? '#ffffff' : '#2d3a2e',
                    fontSize:       `${0.72 / effectiveScale}rem`,
                    fontWeight:     600,
                    pointerEvents:  'none',
                    position:       'relative',
                    zIndex:         1,
                    padding:        '2px',
                  }}
                >
                  {section.nameEn}
                  {isSprayable && zone && (
                    <span style={{ display: 'block', fontSize: `${0.6 / effectiveScale}rem`, fontWeight: 400, marginTop: 2 }}>
                      {STATUS_COLORS[zone.sprayStatus].emoji}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Legend ────────────────────────────────────────────────────────── */}
      <div className="mt-4 flex flex-wrap gap-3">
        {(Object.entries(STATUS_COLORS) as [ZoneSprayStatus, (typeof STATUS_COLORS)[ZoneSprayStatus]][]).map(
          ([status, palette]) => (
            <div key={status} className="flex items-center gap-1.5">
              <span
                style={{
                  display:         'inline-block',
                  width:           14,
                  height:          14,
                  backgroundColor: palette.fill,
                  border:          `2px solid ${palette.border}`,
                  borderRadius:    2,
                  flexShrink:      0,
                }}
              />
              <span className="text-xs text-gray-600">
                {palette.emoji} {palette.label}
              </span>
            </div>
          ),
        )}
        <div className="text-xs text-gray-400 ml-2 flex items-center">
          (non-sprayable zones shown in zone-type colour)
        </div>
      </div>

      {/* ── Detail modal ──────────────────────────────────────────────────── */}
      {selected !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 relative overflow-y-auto max-h-[90vh]"
            style={{ border: `3px solid ${STATUS_COLORS[selected.sprayStatus].border}` }}
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
            <div className="flex items-center gap-3 mb-5 mt-1">
              <span className="text-3xl">{STATUS_COLORS[selected.sprayStatus].emoji}</span>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{selected.zoneName}</h2>
                <p className="text-xs text-gray-400 font-mono">{selected.zoneCode}</p>
              </div>
            </div>

            {/* Status badge */}
            <div
              className="rounded-lg px-3 py-2 mb-4 text-sm font-medium"
              style={{
                backgroundColor: STATUS_COLORS[selected.sprayStatus].fill,
                border:          `1px solid ${STATUS_COLORS[selected.sprayStatus].border}`,
                color:           selected.sprayStatus === 'safe' ? '#15803d' :
                                 selected.sprayStatus === 'unsafe' ? '#b91c1c' :
                                 selected.sprayStatus === 'requires_approval' ? '#92400e' :
                                 selected.sprayStatus === 'pending' ? '#4338ca' : '#6b7280',
              }}
            >
              {STATUS_COLORS[selected.sprayStatus].label}
            </div>

            {/* Spray details */}
            <dl className="grid grid-cols-1 gap-y-3 text-sm">
              {selected.lastCompletedAtUtc && (
                <div>
                  <dt className="text-gray-400 text-xs">Last sprayed</dt>
                  <dd className="font-medium text-gray-800">{fmt(selected.lastCompletedAtUtc)}</dd>
                </div>
              )}
              {selected.pesticideName && (
                <div>
                  <dt className="text-gray-400 text-xs">Pesticide used</dt>
                  <dd className="font-medium text-gray-800">{selected.pesticideName}</dd>
                </div>
              )}
              {selected.safeToReEnterAtUtc && (
                <div>
                  <dt className="text-gray-400 text-xs">Safe to re-enter</dt>
                  <dd className={`font-medium ${new Date(selected.safeToReEnterAtUtc) > new Date() ? 'text-red-600' : 'text-green-700'}`}>
                    {fmt(selected.safeToReEnterAtUtc)}
                  </dd>
                </div>
              )}
              {selected.safeToHarvestAtUtc && (
                <div>
                  <dt className="text-gray-400 text-xs">Safe to harvest</dt>
                  <dd className={`font-medium ${new Date(selected.safeToHarvestAtUtc) > new Date() ? 'text-red-600' : 'text-green-700'}`}>
                    {fmtDate(selected.safeToHarvestAtUtc)}
                  </dd>
                </div>
              )}
              {selected.ppeRequired && (
                <div>
                  <dt className="text-gray-400 text-xs">PPE required</dt>
                  <dd className="font-medium text-gray-800">{selected.ppeRequired}</dd>
                </div>
              )}
              {selected.hazardLevel && (
                <div>
                  <dt className="text-gray-400 text-xs">Hazard level</dt>
                  <dd className="font-medium text-gray-800 capitalize">{selected.hazardLevel}</dd>
                </div>
              )}
              {selected.nextPlannedAtUtc && (
                <div>
                  <dt className="text-gray-400 text-xs">Next planned spray</dt>
                  <dd className="font-medium text-indigo-700">{fmt(selected.nextPlannedAtUtc)}</dd>
                </div>
              )}
              {selected.requiresApproval && (
                <div className="mt-1 rounded-lg bg-yellow-50 border border-yellow-200 px-3 py-2 text-xs text-yellow-800">
                  ⚠️ Pesticide safety data unverified — consult the official product label before re-entry or harvest.
                </div>
              )}
              {selected.sprayStatus === 'never_sprayed' && (
                <p className="text-gray-400 text-sm italic">No spray history for this zone.</p>
              )}
            </dl>
          </div>
        </div>
      )}
    </div>
  );
}
