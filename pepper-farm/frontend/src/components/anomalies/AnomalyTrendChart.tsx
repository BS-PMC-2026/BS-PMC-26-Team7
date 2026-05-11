'use client';

import { TrendPoint } from '@/types/anomaly';

interface Props {
  data: TrendPoint[];
}

const W = 600;
const H = 200;
const PAD = { top: 20, right: 20, bottom: 36, left: 44 };

function toCoords(values: number[], max: number): { x: number; y: number }[] {
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  return values.map((v, i) => ({
    x: PAD.left + (i / Math.max(values.length - 1, 1)) * innerW,
    y: PAD.top + innerH - (max === 0 ? 0 : (v / max) * innerH),
  }));
}

function toPolyline(coords: { x: number; y: number }[]): string {
  return coords.map((c) => `${c.x},${c.y}`).join(' ');
}

function toAreaPath(coords: { x: number; y: number }[]): string {
  if (coords.length === 0) return '';
  const bottomY = PAD.top + (H - PAD.top - PAD.bottom);
  const start = `M${coords[0].x},${bottomY}`;
  const line = coords.map((c) => `L${c.x},${c.y}`).join(' ');
  const close = `L${coords[coords.length - 1].x},${bottomY}Z`;
  return `${start} ${line} ${close}`;
}

export default function AnomalyTrendChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-44 text-sm text-gray-400">
        No trend data available
      </div>
    );
  }

  const maxCount = Math.max(...data.map((d) => d.count), 1);
  const innerH = H - PAD.top - PAD.bottom;

  const totalCoords = toCoords(data.map((d) => d.count), maxCount);
  const highCoords = toCoords(data.map((d) => d.highCount), maxCount);

  const midTick = Math.round(maxCount / 2);
  const yTicks = maxCount <= 1 ? [0, maxCount] : [0, midTick, maxCount];

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ height: H }}
        role="img"
        aria-label="Anomaly trend chart"
      >
        <defs>
          <linearGradient id="totalGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#94a3b8" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#94a3b8" stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id="highGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ef4444" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#ef4444" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Horizontal grid */}
        {yTicks.map((tick) => {
          const y = PAD.top + innerH - (maxCount === 0 ? 0 : (tick / maxCount) * innerH);
          return (
            <g key={tick}>
              <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} stroke="#f1f5f9" strokeWidth={1.5} />
              <text x={PAD.left - 8} y={y + 4} fontSize={10} fill="#94a3b8" textAnchor="end">
                {tick}
              </text>
            </g>
          );
        })}

        {/* X axis baseline */}
        <line
          x1={PAD.left} y1={PAD.top + innerH}
          x2={W - PAD.right} y2={PAD.top + innerH}
          stroke="#e2e8f0" strokeWidth={1}
        />

        {/* Area fills */}
        <path d={toAreaPath(totalCoords)} fill="url(#totalGrad)" />
        <path d={toAreaPath(highCoords)} fill="url(#highGrad)" />

        {/* Total polyline */}
        <polyline
          points={toPolyline(totalCoords)}
          fill="none"
          stroke="#94a3b8"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* High severity polyline */}
        <polyline
          points={toPolyline(highCoords)}
          fill="none"
          stroke="#ef4444"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Dots — total */}
        {totalCoords.map((c, i) => (
          <circle key={`t-${i}`} cx={c.x} cy={c.y} r={3.5} fill="white" stroke="#94a3b8" strokeWidth={2}>
            <title>{data[i].date}: {data[i].count} total</title>
          </circle>
        ))}

        {/* Dots — high severity */}
        {highCoords.map((c, i) => (
          <circle key={`h-${i}`} cx={c.x} cy={c.y} r={3.5} fill="white" stroke="#ef4444" strokeWidth={2}>
            <title>{data[i].date}: {data[i].highCount} high severity</title>
          </circle>
        ))}

        {/* X-axis labels */}
        {data.map((d, i) => {
          const x = PAD.left + (i / Math.max(data.length - 1, 1)) * (W - PAD.left - PAD.right);
          return (
            <text key={d.date} x={x} y={H - 6} fontSize={10} fill="#94a3b8" textAnchor="middle">
              {d.date.slice(5)}
            </text>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="flex gap-5 mt-1 justify-end text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-4 h-0.5 bg-gray-300 rounded" />
          Total
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-4 h-0.5 bg-red-400 rounded" />
          High severity
        </span>
      </div>
    </div>
  );
}
