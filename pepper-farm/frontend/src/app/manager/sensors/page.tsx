'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Download, RefreshCw } from 'lucide-react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import ExportModal, { ExportOptions } from '@/components/sensors/ExportModal';
import {
  getLatestSensorReading,
  getSensorReadingsByRange,
  refreshSensorLive,
} from '@/services/sensors';
import { SensorLiveResponse, SensorReading } from '@/types/sensor';

const SENSOR_ID = 1;
const API_BASE   = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:8000';

const METRIC_CONFIG = [
  { key: 'Temperature'  as const, label: 'Temperature', unit: '°C', color: '#F59E0B', digits: 2 },
  { key: 'Humidity'     as const, label: 'Humidity',    unit: '%',  color: '#3B82F6', digits: 2 },
  { key: 'Leak'         as const, label: 'Leak',        unit: '',   color: '#EF4444', digits: 3 },
  { key: 'BatteryLevel' as const, label: 'Battery',     unit: '%',  color: '#10B981', digits: 0 },
];

type MetricKey = typeof METRIC_CONFIG[number]['key'];

// ── helpers ──────────────────────────────────────────────────────────────────

function formatNumber(value?: number | null, digits = 2): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return value.toFixed(digits);
}

function formatDateTime(value?: string | null): string {
  if (!value) return '—';
  const utcValue = value.endsWith('Z') ? value : `${value}Z`;
  const date = new Date(utcValue);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' });
}

function formatDateForInput(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function getStatusLabel(status?: string): string {
  switch (status) {
    case 'live':    return 'Live';
    case 'recent':  return 'Recent';
    case 'stale':   return 'Stale';
    case 'no_data': return 'No Data';
    default:        return 'Unknown';
  }
}

function getStatusStyle(status?: string) {
  switch (status) {
    case 'live':   return { bg: 'bg-green-50',  border: 'border-green-200',  text: 'text-green-700',  dot: 'bg-green-500'  };
    case 'recent': return { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-700', dot: 'bg-yellow-500' };
    case 'stale':  return { bg: 'bg-red-50',    border: 'border-red-200',    text: 'text-red-700',    dot: 'bg-red-500'    };
    default:       return { bg: 'bg-gray-50',   border: 'border-gray-200',   text: 'text-gray-700',   dot: 'bg-gray-400'   };
  }
}

// ── component ─────────────────────────────────────────────────────────────────

export default function SensorDashboardPage() {
  const router = useRouter();

  // dashboard state
  const [liveData,   setLiveData]   = useState<SensorLiveResponse | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [syncError,  setSyncError]  = useState<string | null>(null);

  // data explorer state
  const defaultEnd   = new Date();
  const defaultStart = new Date(defaultEnd.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [startDate, setStartDate] = useState(formatDateForInput(defaultStart));
  const [endDate,   setEndDate]   = useState(formatDateForInput(defaultEnd));
  const [selectedMetrics, setSelectedMetrics] = useState<Set<MetricKey>>(
    new Set<MetricKey>(['Temperature', 'Humidity'])
  );
  const [viewMode,         setViewMode]         = useState<'table' | 'graph'>('table');
  const [explorerReadings, setExplorerReadings] = useState<SensorReading[]>([]);
  const [explorerLoading,  setExplorerLoading]  = useState(false);
  const [explorerError,    setExplorerError]    = useState<string | null>(null);
  const [explorerLoaded,   setExplorerLoaded]   = useState(false);

  // export state
  const [showExportModal, setShowExportModal] = useState(false);
  const [isExporting,     setIsExporting]     = useState(false);
  const [exportError,     setExportError]     = useState<string | null>(null);
  const [exportSuccess,   setExportSuccess]   = useState<string | null>(null);

  // ref for chart PDF capture
  const chartRef = useRef<HTMLDivElement>(null);

  // ── dashboard load ──────────────────────────────────────────────────────────

  async function loadDashboard(isManualRefresh = false) {
    try {
      setError(null);

      if (isManualRefresh) {
        setRefreshing(true);
        setSyncError(null);
        try {
          const live = await refreshSensorLive(SENSOR_ID);
          setLiveData(live);
        } catch (err) {
          setSyncError(
            err instanceof Error ? err.message : 'Failed to sync from Atomation.'
          );
        }
      } else {
        setLoading(true);
      }

      const latest = await getLatestSensorReading(SENSOR_ID);

      if (latest) {
        const sampleTime   = new Date(`${latest.SampleTimeUtc}Z`);
        const staleMinutes = Math.floor((Date.now() - sampleTime.getTime()) / 60000);

        let status: SensorLiveResponse['status'] = 'stale';
        let isStale = true;
        let message = 'Sensor data is stale.';

        if (staleMinutes <= 30) {
          status = 'live';   isStale = false; message = 'Sensor data is up to date.';
        } else if (staleMinutes <= 360) {
          status = 'recent'; isStale = false; message = 'Sensor data is recent, but not fully live.';
        }

        setLiveData({ sensorId: SENSOR_ID, macAddress: latest.MacAddress, sync: null,
          latestReading: latest, status, isStale, staleMinutes, message });
      } else {
        setLiveData({ sensorId: SENSOR_ID, macAddress: '', sync: null, latestReading: null,
          status: 'no_data', isStale: true, staleMinutes: null,
          message: 'No readings found for this sensor.' });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sensor dashboard.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  // ── data explorer load ──────────────────────────────────────────────────────

  async function loadExplorerData() {
    if (!startDate || !endDate) return;
    if (startDate > endDate) {
      setExplorerError('"From" date must be before "To" date.');
      return;
    }
    setExplorerLoading(true);
    setExplorerError(null);
    try {
      const start = new Date(`${startDate}T00:00:00`);
      const end   = new Date(`${endDate}T23:59:59`);
      const data  = await getSensorReadingsByRange(SENSOR_ID, start, end);
      setExplorerReadings(
        [...data].sort(
          (a, b) =>
            new Date(`${a.SampleTimeUtc}Z`).getTime() -
            new Date(`${b.SampleTimeUtc}Z`).getTime()
        )
      );
      setExplorerLoaded(true);
    } catch (err) {
      setExplorerError(err instanceof Error ? err.message : 'Failed to load readings.');
    } finally {
      setExplorerLoading(false);
    }
  }

  useEffect(() => { loadDashboard(false); }, []);

  // ── metric toggle ───────────────────────────────────────────────────────────

  function toggleMetric(key: MetricKey) {
    setSelectedMetrics(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size > 1) next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  // ── export ──────────────────────────────────────────────────────────────────

  async function handleExport(opts: ExportOptions) {
    setExportError(null);
    setIsExporting(true);

    try {
      const attachments: { filename: string; content: string; contentType: string }[] = [];

      // Excel table
      if (opts.includeTable) {
        const XLSX = await import('xlsx');

        const activeMetrics = METRIC_CONFIG.filter(m => selectedMetrics.has(m.key));
        const rows = explorerReadings.map(r => {
          const row: Record<string, string | number | null> = {
            'Sample Time': formatDateTime(r.SampleTimeUtc),
          };
          activeMetrics.forEach(m => {
            const val = r[m.key as keyof SensorReading] as number | null | undefined;
            const header = `${m.label}${m.unit ? ` (${m.unit})` : ''}`;
            row[header] = val ?? null;
          });
          return row;
        });

        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Sensor Readings');

        if (opts.delivery === 'download') {
          XLSX.writeFile(wb, 'sensor-readings.xlsx');
        } else {
          attachments.push({
            filename: 'sensor-readings.xlsx',
            content: XLSX.write(wb, { type: 'base64', bookType: 'xlsx' }),
            contentType:
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          });
        }
      }

      // PDF graph
      if (opts.includeGraph && chartRef.current) {
        const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
          import('html2canvas'),
          import('jspdf'),
        ]);

        const canvas = await html2canvas(chartRef.current, {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff',
        });

        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
        const pdfW = pdf.internal.pageSize.getWidth();
        const pdfH = pdf.internal.pageSize.getHeight();
        const ratio = Math.min((pdfW - 20) / canvas.width, (pdfH - 20) / canvas.height);
        const imgW  = canvas.width  * ratio;
        const imgH  = canvas.height * ratio;
        pdf.addImage(imgData, 'PNG', (pdfW - imgW) / 2, (pdfH - imgH) / 2, imgW, imgH);

        if (opts.delivery === 'download') {
          pdf.save('sensor-graph.pdf');
        } else {
          const ab = pdf.output('arraybuffer');
          const bytes = new Uint8Array(ab);
          let binary = '';
          bytes.forEach(b => (binary += String.fromCharCode(b)));
          attachments.push({
            filename: 'sensor-graph.pdf',
            content: btoa(binary),
            contentType: 'application/pdf',
          });
        }
      }

      // Send email
      if (opts.delivery === 'email') {
        const res = await fetch(`${API_BASE}/api/sensors/export/email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ to: opts.email, attachments }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error((data as { detail?: string }).detail ?? 'Failed to send email.');
        }
        setExportSuccess(`Export sent to ${opts.email} successfully.`);
      } else {
        setExportSuccess('Export downloaded successfully.');
      }

      setShowExportModal(false);
      setTimeout(() => setExportSuccess(null), 5000);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Export failed.');
    } finally {
      setIsExporting(false);
    }
  }

  // ── chart data ──────────────────────────────────────────────────────────────

  const chartData = useMemo(
    () =>
      explorerReadings.map(r => ({
        time:         formatDateTime(r.SampleTimeUtc),
        Temperature:  r.Temperature  ?? null,
        Humidity:     r.Humidity     ?? null,
        Leak:         r.Leak         ?? null,
        BatteryLevel: r.BatteryLevel ?? null,
      })),
    [explorerReadings]
  );

  const latest = liveData?.latestReading ?? null;

  // ── derived booleans for export ─────────────────────────────────────────────

  const canExportTable = explorerLoaded && explorerReadings.length > 0;
  const canExportGraph =
    explorerLoaded && explorerReadings.length > 0 && viewMode === 'graph';

  // ── loading skeleton ────────────────────────────────────────────────────────

  if (loading) {
    return (
      <main className="mx-auto max-w-7xl px-6 py-8">
        <p className="text-gray-500 text-sm">Loading sensor dashboard…</p>
      </main>
    );
  }

  const statusStyle = getStatusStyle(liveData?.status);

  return (
    <main className="mx-auto max-w-7xl px-6 py-8 space-y-6">

      {/* ── Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push('/manager')}
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back
          </Button>

          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-0.5">
              Manager
            </p>
            <h1 className="text-2xl font-semibold text-gray-900">Sensor Dashboard</h1>
            {liveData?.macAddress && (
              <p className="text-sm text-gray-400 mt-0.5">Device: {liveData.macAddress}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            onClick={() => { setExportError(null); setShowExportModal(true); }}
          >
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>

          <Button onClick={() => loadDashboard(true)} disabled={refreshing}>
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Syncing…' : 'Sync from Atomation'}
          </Button>
        </div>
      </div>

      {error       && <Alert variant="error">{error}</Alert>}
      {syncError   && (
        <Alert variant="info">
          Atomation sync failed — showing latest data from DB. Details: {syncError}
        </Alert>
      )}
      {exportSuccess && <Alert variant="success">{exportSuccess}</Alert>}

      {/* ── Status banner ── */}
      {liveData && (
        <div className={`rounded-xl border px-5 py-4 ${statusStyle.bg} ${statusStyle.border}`}>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${statusStyle.dot}`} />
              <span className={`font-semibold ${statusStyle.text}`}>
                Status: {getStatusLabel(liveData.status)}
              </span>
            </div>
            <p className={`text-sm ${statusStyle.text}`}>{liveData.message}</p>
            {liveData.staleMinutes !== null && (
              <p className={`text-sm ${statusStyle.text}`}>
                Last update:{' '}
                <span className="font-semibold">{liveData.staleMinutes} min ago</span>
              </p>
            )}
          </div>
        </div>
      )}

      {!latest ? (
        <Alert variant="info">No readings found for this sensor.</Alert>
      ) : (
        <>
          {/* ── Live metric cards ── */}
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {METRIC_CONFIG.map(({ key, label, unit, color, digits }) => {
              const val = latest[key as keyof SensorReading] as number | null | undefined;
              return (
                <Card key={key}>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      {label}
                    </p>
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                  </div>
                  <p className="text-3xl font-bold text-gray-900">
                    {formatNumber(val, digits)}
                    {unit && (
                      <span className="text-base font-normal text-gray-400 ml-1">{unit}</span>
                    )}
                  </p>
                </Card>
              );
            })}
          </section>

          {/* ── Latest reading details ── */}
          <Card>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">
              Latest Reading Details
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { label: 'Reading ID',        value: String(latest.ReadingId) },
                { label: 'Type',              value: latest.ReadingType ?? '—' },
                { label: 'Sample Time',       value: formatDateTime(latest.SampleTimeUtc) },
                { label: 'Gateway Read',      value: formatDateTime(latest.GatewayReadTimeUtc) },
                { label: 'Atomation Created', value: formatDateTime(latest.AtomationCreatedAtUtc) },
                {
                  label: 'Location',
                  value: `${formatNumber(latest.Latitude, 5)}, ${formatNumber(latest.Longitude, 5)}`,
                },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-lg bg-gray-50 px-4 py-3">
                  <p className="text-xs text-gray-400 mb-0.5">{label}</p>
                  <p className="text-sm font-medium text-gray-800">{value}</p>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}

      {/* ── Data Explorer ── */}
      <Card>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-5">
          Data Explorer
        </p>

        {/* Controls */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:flex-wrap mb-6">

          {/* Date range */}
          <div className="flex items-end gap-2">
            <div>
              <label className="block text-xs text-gray-500 mb-1">From</label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="rounded-lg border border-[#DDE5DC] px-3 py-2 text-sm text-gray-700
                  focus:outline-none focus:ring-2 focus:ring-[#2F6F4E]/30"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">To</label>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="rounded-lg border border-[#DDE5DC] px-3 py-2 text-sm text-gray-700
                  focus:outline-none focus:ring-2 focus:ring-[#2F6F4E]/30"
              />
            </div>
            <Button size="sm" onClick={loadExplorerData} disabled={explorerLoading}>
              {explorerLoading ? 'Loading…' : 'Load Data'}
            </Button>
          </div>

          {/* Metric checkboxes */}
          <div className="flex items-center gap-4 flex-wrap">
            {METRIC_CONFIG.map(({ key, label, color }) => (
              <label key={key} className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={selectedMetrics.has(key)}
                  onChange={() => toggleMetric(key)}
                  className="w-4 h-4 rounded accent-[#2F6F4E]"
                />
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                <span className="text-sm text-gray-600">{label}</span>
              </label>
            ))}
          </div>

          {/* View toggle */}
          <div className="flex rounded-lg border border-[#DDE5DC] overflow-hidden shrink-0">
            {(['table', 'graph'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-4 py-2 text-sm font-medium capitalize transition-colors ${
                  viewMode === mode
                    ? 'bg-[#2F6F4E] text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        {explorerError && <Alert variant="error" className="mb-4">{explorerError}</Alert>}

        {/* Results */}
        {!explorerLoaded ? (
          <div className="py-12 text-center text-gray-400 text-sm">
            Select a date range and click &quot;Load Data&quot; to view readings.
          </div>
        ) : explorerReadings.length === 0 ? (
          <div className="py-12 text-center text-gray-400 text-sm">
            No readings found for the selected date range.
          </div>
        ) : viewMode === 'table' ? (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                    Sample Time
                  </th>
                  {METRIC_CONFIG.filter(m => selectedMetrics.has(m.key)).map(m => (
                    <th
                      key={m.key}
                      className="px-3 py-3 text-xs font-semibold uppercase tracking-wide whitespace-nowrap"
                      style={{ color: m.color }}
                    >
                      {m.label}{m.unit ? ` (${m.unit})` : ''}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {explorerReadings.map(r => (
                  <tr
                    key={r.ReadingId}
                    className="border-b last:border-b-0 hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">
                      {formatDateTime(r.SampleTimeUtc)}
                    </td>
                    {METRIC_CONFIG.filter(m => selectedMetrics.has(m.key)).map(m => {
                      const val = r[m.key as keyof SensorReading] as number | null | undefined;
                      return (
                        <td key={m.key} className="px-3 py-2.5 font-medium text-gray-800">
                          {val !== null && val !== undefined
                            ? `${formatNumber(val, m.digits)}${m.unit}`
                            : '—'}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          /* ref is attached here so html2canvas can capture it */
          <div ref={chartRef} style={{ height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 11, fill: '#9CA3AF' }}
                  interval="preserveStartEnd"
                />
                <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} />
                <Tooltip
                  contentStyle={{
                    borderRadius: '8px',
                    border: '1px solid #DDE5DC',
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {METRIC_CONFIG.filter(m => selectedMetrics.has(m.key)).map(m => (
                  <Line
                    key={m.key}
                    type="monotone"
                    dataKey={m.key}
                    name={`${m.label}${m.unit ? ` (${m.unit})` : ''}`}
                    stroke={m.color}
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {explorerLoaded && explorerReadings.length > 0 && (
          <p className="mt-3 text-xs text-gray-400 text-right">
            {explorerReadings.length} readings loaded
          </p>
        )}
      </Card>

      {/* ── Export Modal ── */}
      {showExportModal && (
        <ExportModal
          onClose={() => setShowExportModal(false)}
          canExportTable={canExportTable}
          canExportGraph={canExportGraph}
          isExporting={isExporting}
          exportError={exportError}
          onExport={handleExport}
        />
      )}
    </main>
  );
}
