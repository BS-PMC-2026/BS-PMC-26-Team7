'use client';

import { useState, useRef, useEffect } from 'react';

interface FarmSection {
  id: string;
  name: string;
  nameEn: string;
  area?: string;
  type: 'greenhouse' | 'nursery' | 'building' | 'growing' | 'germination' | 'visitor' | 'production';
  color: string;
  position: { x: number; y: number; width: number; height: number };
}

const MAP_WIDTH = 1200;
const MAP_HEIGHT = 400;

const sections: FarmSection[] = [
  { id: 'GH-01', name: 'Greenhouse 1', nameEn: 'Greenhouse 1', area: '400 m²', type: 'greenhouse', color: '#a8d5a3', position: { x: 40, y: 40, width: 58, height: 320 } },
  { id: 'GH-02', name: 'Greenhouse 2', nameEn: 'Greenhouse 2', area: '400 m²', type: 'greenhouse', color: '#a8d5a3', position: { x: 105, y: 40, width: 58, height: 320 } },
  { id: 'GH-03', name: 'Greenhouse 3', nameEn: 'Greenhouse 3', area: '400 m²', type: 'greenhouse', color: '#a8d5a3', position: { x: 170, y: 40, width: 58, height: 320 } },
  { id: 'GH-04', name: 'Greenhouse 4', nameEn: 'Greenhouse 4', area: '400 m²', type: 'greenhouse', color: '#a8d5a3', position: { x: 235, y: 40, width: 58, height: 320 } },
  { id: 'GH-05', name: 'Greenhouse 5', nameEn: 'Greenhouse 5', area: '400 m²', type: 'greenhouse', color: '#a8d5a3', position: { x: 300, y: 40, width: 58, height: 320 } },
  { id: 'GH-06', name: 'Greenhouse 6', nameEn: 'Greenhouse 6', area: '400 m²', type: 'greenhouse', color: '#a8d5a3', position: { x: 365, y: 40, width: 58, height: 320 } },
  { id: 'GH-07', name: 'Greenhouse 7', nameEn: 'Greenhouse 7', area: '400 m²', type: 'greenhouse', color: '#a8d5a3', position: { x: 430, y: 40, width: 58, height: 320 } },
  { id: 'GH-08', name: 'Greenhouse 8', nameEn: 'Greenhouse 8', area: '400 m²', type: 'greenhouse', color: '#a8d5a3', position: { x: 495, y: 40, width: 58, height: 320 } },
  { id: 'NURSERY', name: 'Nursery', nameEn: 'Nursery', type: 'nursery', color: '#9ed9a3', position: { x: 580, y: 40, width: 45, height: 180 } },
  { id: 'SHED-MAIN', name: 'Parking', nameEn: 'Main Shed', type: 'building', color: '#c9c4b8', position: { x: 635, y: 40, width: 140, height: 180 } },
  { id: 'GH-09', name: 'Growing House 9', nameEn: 'Greenhouse 9', area: '300 m²', type: 'growing', color: '#b8d96f', position: { x: 635, y: 230, width: 140, height: 60 } },
  { id: 'GH-10', name: 'Growing House 10', nameEn: 'Greenhouse 10', area: '300 m²', type: 'growing', color: '#b8d96f', position: { x: 635, y: 300, width: 140, height: 60 } },
  { id: 'GERM-01', name: 'Germination 1', nameEn: 'Germination 1', type: 'germination', color: '#a8e6cf', position: { x: 790, y: 40, width: 110, height: 48 } },
  { id: 'GERM-02', name: 'Germination 2', nameEn: 'Germination 2', type: 'germination', color: '#a8e6cf', position: { x: 790, y: 95, width: 110, height: 48 } },
  { id: 'GERM-03', name: 'Germination 3', nameEn: 'Germination 3', type: 'germination', color: '#a8e6cf', position: { x: 790, y: 150, width: 110, height: 48 } },
  { id: 'GERM-04', name: 'Germination 4', nameEn: 'Germination 4', type: 'germination', color: '#a8e6cf', position: { x: 790, y: 205, width: 110, height: 48 } },
  { id: 'VIS-CENTER', name: 'Visitor Center', nameEn: 'Visitor Center', type: 'visitor', color: '#c7e9c0', position: { x: 790, y: 260, width: 110, height: 100 } },
  { id: 'FACTORY', name: 'Production Facility', nameEn: 'Production Facility', type: 'production', color: '#3d4a4d', position: { x: 1055, y: 40, width: 110, height: 320 } },
];

const TYPE_ICONS: Record<FarmSection['type'], string> = {
  greenhouse: '🌿',
  nursery: '🌱',
  building: '🏗️',
  growing: '🌾',
  germination: '🌰',
  visitor: '👥',
  production: '🏭',
};

const LEGEND_ITEMS = [
  { color: '#a8d5a3', label: 'Greenhouse' },
  { color: '#9ed9a3', label: 'Nursery' },
  { color: '#b8d96f', label: 'Growing House' },
  { color: '#a8e6cf', label: 'Germination' },
  { color: '#c7e9c0', label: 'Visitor Center' },
  { color: '#c9c4b8', label: 'Facility / Parking' },
  { color: '#3d4a4d', label: 'Production' },
];

export default function FarmMap() {
  const [selected, setSelected] = useState<FarmSection | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
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

  const scaledHeight = Math.round(MAP_HEIGHT * scale);

  return (
    <div className="w-full">
      {/* Map canvas */}
      <div
        ref={containerRef}
        style={{ height: scaledHeight, position: 'relative', overflow: 'hidden' }}
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
            transform: `scale(${scale})`,
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
                onClick={() => setSelected(section)}
                onMouseEnter={() => setHovered(section.id)}
                onMouseLeave={() => setHovered(null)}
                style={{
                  position: 'absolute',
                  left: section.position.x,
                  top: section.position.y,
                  width: section.position.width,
                  height: section.position.height,
                  backgroundColor: section.color,
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
                      fontSize: section.type === 'production' ? '0.85rem' : '0.75rem',
                      fontWeight: 600,
                      pointerEvents: 'none',
                    }}
                  >
                    <div>{section.nameEn}</div>
                    {section.area && (
                      <div style={{ fontSize: '0.65rem', marginTop: 4 }}>{section.area}</div>
                    )}
                  </div>
                ) : section.type === 'growing' ? (
                  <div style={{ textAlign: 'center', pointerEvents: 'none' }}>
                    <div style={{ color: '#2d3a2e', fontSize: '0.75rem', fontWeight: 600 }}>
                      {section.nameEn}
                    </div>
                    {section.area && (
                      <div style={{ color: '#2d3a2e', fontSize: '0.65rem', marginTop: 2 }}>
                        {section.area}
                      </div>
                    )}
                  </div>
                ) : (
                  <div
                    style={{
                      textAlign: 'center',
                      color: '#2d3a2e',
                      fontSize: section.type === 'building' ? '0.9rem' : '0.7rem',
                      fontWeight: 600,
                      pointerEvents: 'none',
                      padding: '4px',
                    }}
                  >
                    {section.nameEn}
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
            className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 relative"
            style={{ border: `4px solid ${selected.color}` }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelected(null)}
              className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors text-gray-500 text-lg"
              aria-label="Close"
            >
              ×
            </button>

            <div className="flex items-start gap-4 mb-5">
              <div
                className="w-12 h-12 rounded-lg flex items-center justify-center text-2xl shrink-0"
                style={{ backgroundColor: selected.color }}
              >
                {TYPE_ICONS[selected.type]}
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">{selected.nameEn}</h2>
                <p className="text-sm text-gray-500 mt-0.5">ID: {selected.id}</p>
              </div>
            </div>

            {selected.area && (
              <div className="mb-4 p-3 rounded-lg bg-gray-50">
                <p className="text-xs text-gray-400 mb-1">Area</p>
                <p className="text-2xl font-bold text-gray-900">{selected.area}</p>
              </div>
            )}

            <div className="flex items-center gap-2 text-xs text-gray-400 pt-3 border-t border-gray-100">
              <span>📍</span>
              <span>Farm Facility · Interactive Map</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
