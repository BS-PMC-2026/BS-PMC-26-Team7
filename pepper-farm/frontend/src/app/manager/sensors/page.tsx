'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, ChevronDown, ChevronUp, ChevronsUpDown, Download, MapPin, Radio, AlertTriangle, RefreshCw } from 'lucide-react';
import AnomalyDashboardEmbed from '@/components/anomalies/AnomalyDashboardEmbed';
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
  getSensorAlerts,
  getSensorReadingsByRange,
  getSensors,
  refreshSensorLive,
} from '@/services/sensors';
import { SensorAlert, SensorInfo, SensorLiveResponse, SensorReading } from '@/types/sensor';
import { useLanguage } from '@/context/LanguageContext';
function sensorLabel(s: SensorInfo, inactiveText: string): string {
  const name = s.DeviceName || s.MacAddress;
  return s.IsActive ? name : `${name} ${inactiveText}`;
}

const METRIC_CONFIG = [
  { key: 'Temperature'  as const, label: 'Temperature',       unit: '°C',          color: '#F59E0B', digits: 2 },
  { key: 'Humidity'     as const, label: 'Humidity',          unit: '%',            color: '#3B82F6', digits: 2 },
  { key: 'Leak'         as const, label: 'Leak',              unit: '',             color: '#EF4444', digits: 3 },
  { key: 'BatteryLevel' as const, label: 'Battery',           unit: '%',            color: '#10B981', digits: 0 },
  { key: 'PAR'          as const, label: 'PAR',               unit: 'µmol/m²/s',   color: '#A855F7', digits: 2 },
];

type MetricKey = typeof METRIC_CONFIG[number]['key'];

type SortKey =
  | 'SampleTimeUtc' | 'ReadingId' | 'ReadingType' | 'Latitude'
  | 'Temperature'   | 'Humidity'  | 'Leak'         | 'BatteryLevel' | 'PAR';
type SortDir = 'asc' | 'desc';

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

function mapsUrl(lat?: number | null, lng?: number | null): string | null {
  if (lat == null || lng == null) return null;
  return `https://maps.google.com/?q=${lat},${lng}`;
}

function getStatusLabel(status: string | undefined, se: { statusLive: string; statusRecent: string; statusStale: string; statusNoData: string; statusUnknown: string }): string {
  switch (status) {
    case 'live':    return se.statusLive;
    case 'recent':  return se.statusRecent;
    case 'stale':   return se.statusStale;
    case 'no_data': return se.statusNoData;
    default:        return se.statusUnknown;
  }
}

function getStatusStyle(status?: string) {
  switch (status) {
    case 'live':   return { bg: 'bg-[var(--color-secondary-light)]',  border: 'border-[var(--color-border)]',  text: 'text-[var(--color-primary)]',  dot: 'bg-green-500'  };
    case 'recent': return { bg: 'bg-[var(--color-warning-bg)]', border: 'border-[var(--color-border)]', text: 'text-[var(--color-warning)]', dot: 'bg-yellow-500' };
    case 'stale':  return { bg: 'bg-[var(--color-error-bg)]',    border: 'border-[var(--color-border)]',    text: 'text-[var(--color-error)]',    dot: 'bg-red-500'    };
    default:       return { bg: 'bg-[var(--color-muted)]',   border: 'border-[var(--color-border)]',   text: 'text-[var(--color-foreground)]',   dot: 'bg-gray-400'   };
  }
}

// ── component ─────────────────────────────────────────────────────────────────

function SensorDashboardPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const se = t.sensors;

  const searchParams = useSearchParams();
  const activeTab = searchParams.get("tab") === "anomalies" ? "anomalies" : "live";

  // sensor list state
  const [sensors,          setSensors]          = useState<SensorInfo[]>([]);
  const [selectedSensorId, setSelectedSensorId] = useState<number | null>(null);
  const [sensorsLoading,   setSensorsLoading]   = useState(true);

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
  const [explorerAlerts,   setExplorerAlerts]   = useState<SensorAlert[]>([]);

  // sort state for the explorer table
  const [sortKey, setSortKey] = useState<SortKey>('SampleTimeUtc');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  // export state
  const [showExportModal, setShowExportModal] = useState(false);
  const [isExporting,     setIsExporting]     = useState(false);
  const [exportError,     setExportError]     = useState<string | null>(null);
  const [exportSuccess,   setExportSuccess]   = useState<string | null>(null);

  // ref for chart PDF capture
  const chartRef = useRef<HTMLDivElement>(null);

  // ── dashboard load ──────────────────────────────────────────────────────────

  async function loadDashboard(sensorId: number, isManualRefresh = false) {
    try {
      setError(null);

      if (isManualRefresh) {
        setRefreshing(true);
        setSyncError(null);
        try {
          const live = await refreshSensorLive(sensorId);
          setLiveData(live);
        } catch (err) {
          setSyncError(
            err instanceof Error ? err.message : se.failedToSync
          );
        }
      } else {
        setLoading(true);
      }

      const latest = await getLatestSensorReading(sensorId);

      if (latest) {
        const sampleTime   = new Date(`${latest.SampleTimeUtc}Z`);
        const staleMinutes = Math.floor((Date.now() - sampleTime.getTime()) / 60000);

        let status: SensorLiveResponse['status'] = 'stale';
        let isStale = true;
        let message = se.msgStale;

        if (staleMinutes <= 30) {
          status = 'live';   isStale = false; message = se.msgUpToDate;
        } else if (staleMinutes <= 360) {
          status = 'recent'; isStale = false; message = se.msgRecent;
        }

        setLiveData({ sensorId, macAddress: latest.MacAddress, sync: null,
          latestReading: latest, status, isStale, staleMinutes, message });
      } else {
        setLiveData({ sensorId, macAddress: '', sync: null, latestReading: null,
          status: 'no_data', isStale: true, staleMinutes: null,
          message: se.msgNoData });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : se.failedToLoadDashboard);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  // ── data explorer load ──────────────────────────────────────────────────────

  async function loadExplorerData() {
    if (!startDate || !endDate) return;
    if (startDate > endDate) {
      setExplorerError(se.fromDateError);
      return;
    }
    setExplorerLoading(true);
    setExplorerError(null);
    try {
      const start = new Date(`${startDate}T00:00:00`);
      const end   = new Date(`${endDate}T23:59:59`);
      const [data, alerts] = await Promise.all([
        getSensorReadingsByRange(selectedSensorId!, start, end),
        getSensorAlerts(selectedSensorId!, start, end).catch(() => [] as SensorAlert[]),
      ]);
      setExplorerReadings(
        [...data].sort(
          (a, b) =>
            new Date(`${a.SampleTimeUtc}Z`).getTime() -
            new Date(`${b.SampleTimeUtc}Z`).getTime()
        )
      );
      setExplorerAlerts(alerts);
      setExplorerLoaded(true);
    } catch (err) {
      setExplorerError(err instanceof Error ? err.message : se.failedToLoadReadings);
    } finally {
      setExplorerLoading(false);
    }
  }

  useEffect(() => {
    async function init() {
      setSensorsLoading(true);
      try {
        const list = await getSensors();
        setSensors(list);
        if (list.length > 0) {
          const firstId = list[0].SensorId;
          setSelectedSensorId(firstId);
          await loadDashboard(firstId);
        } else {
          setLoading(false);
        }
      } catch {
        setError(se.failedToLoadSensorsList);
        setLoading(false);
      } finally {
        setSensorsLoading(false);
      }
    }
    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── sensor change ──────────────────────────────────────────────────────────

  function handleSensorChange(sensorId: number) {
    setSelectedSensorId(sensorId);
    setLiveData(null);
    setError(null);
    setSyncError(null);
    setExplorerReadings([]);
    setExplorerAlerts([]);
    setExplorerLoaded(false);
    setExplorerError(null);
    loadDashboard(sensorId);
  }

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

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
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
            'Reading ID':  r.ReadingId,
            'Type':        r.ReadingType ?? '—',
            'Location':    r.Latitude != null && r.Longitude != null
              ? `${r.Latitude}, ${r.Longitude}`
              : '—',
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
        const res = await fetch(`/api/sensors/export/email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ to: opts.email, attachments }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error((data as { detail?: string }).detail ?? 'Failed to send email.');
        }
        setExportSuccess(se.exportSentSuccess.replace('{email}', opts.email));
      } else {
        setExportSuccess(se.exportDownloadSuccess);
      }

      setShowExportModal(false);
      setTimeout(() => setExportSuccess(null), 5000);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : se.exportFailed);
    } finally {
      setIsExporting(false);
    }
  }

  // ── chart data ──────────────────────────────────────────────────────────────

  // ── alert lookup memos ─────────────────────────────────────────────────────

  const alertsByReadingId = useMemo(() => {
    const map = new Map<number, SensorAlert[]>();
    explorerAlerts.forEach(a => {
      if (!map.has(a.ReadingId)) map.set(a.ReadingId, []);
      map.get(a.ReadingId)!.push(a);
    });
    return map;
  }, [explorerAlerts]);

  // "${readingId}-${MetricName}" — O(1) cell-level check
  const alertedMetrics = useMemo(() => {
    const set = new Set<string>();
    explorerAlerts.forEach(a => set.add(`${a.ReadingId}-${a.MetricName}`));
    return set;
  }, [explorerAlerts]);

  // ── chart data ──────────────────────────────────────────────────────────────

  const chartData = useMemo(
    () =>
      explorerReadings.map(r => ({
        time:         formatDateTime(r.SampleTimeUtc),
        readingId:    r.ReadingId,
        Temperature:  r.Temperature  ?? null,
        Humidity:     r.Humidity     ?? null,
        Leak:         r.Leak         ?? null,
        BatteryLevel: r.BatteryLevel ?? null,
        PAR:          r.PAR          ?? null,
      })),
    [explorerReadings]
  );

  // ── custom recharts tooltip ─────────────────────────────────────────────────

  const renderTooltip = useCallback(
    (props: {
      active?: boolean;
      payload?: { dataKey: string; name: string; value: number | null; color: string; payload: { readingId?: number } }[];
      label?: string;
    }) => {
      const { active, payload, label } = props;
      if (!active || !payload?.length) return null;
      const readingId = payload[0]?.payload?.readingId;
      const alerts    = readingId ? (alertsByReadingId.get(readingId) ?? []) : [];

      return (
        <div className="bg-white border border-[#DDE5DC] rounded-xl p-3 shadow-lg text-xs min-w-[180px]">
          <p className="font-semibold text-[var(--color-muted-foreground)] mb-1">{label}</p>
          {readingId !== undefined && (
            <p className="text-[var(--color-muted-foreground)] text-[11px] mb-2" dir="ltr">{se.readingNumPrefix}{readingId}</p>
          )}
          <div className="space-y-1">
            {payload.map(p => {
              const hasAlert = alertedMetrics.has(`${readingId}-${p.dataKey}`);
              return (
                <div key={p.dataKey} className="flex items-center justify-between gap-4">
                  <span style={{ color: p.color }} className="font-medium">{p.name}</span>
                  <span className={hasAlert ? 'text-[var(--color-error)] font-bold' : 'text-[var(--color-foreground)]'}>
                    {p.value != null ? p.value : '—'}{hasAlert && ' ⚠'}
                  </span>
                </div>
              );
            })}
          </div>
          {alerts.length > 0 && (
            <div className="mt-2 pt-2 border-t border-[var(--color-border)] space-y-1">
              {alerts.map(a => (
                <p key={a.AlertId} className="text-red-500 text-[11px]">
                  {a.Severity === 'critical' ? '🔴' : '🟡'} {a.Message}
                </p>
              ))}
            </div>
          )}
        </div>
      );
    },
    [alertsByReadingId, alertedMetrics]
  );

  const sortedReadings = useMemo(() => {
    return [...explorerReadings].sort((a, b) => {
      const getVal = (r: SensorReading): number | string | null => {
        if (sortKey === 'SampleTimeUtc')
          return new Date(`${r.SampleTimeUtc}Z`).getTime();
        const v = r[sortKey as keyof SensorReading];
        return (v as number | string | null | undefined) ?? null;
      };
      const av = getVal(a);
      const bv = getVal(b);
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      const cmp =
        typeof av === 'string'
          ? av.localeCompare(bv as string)
          : (av as number) - (bv as number);
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [explorerReadings, sortKey, sortDir]);

  const latest = liveData?.latestReading ?? null;

  // ── derived booleans for export ─────────────────────────────────────────────

  const canExportTable = explorerLoaded && explorerReadings.length > 0;
  const canExportGraph =
    explorerLoaded && explorerReadings.length > 0 && viewMode === 'graph';

  // ── loading skeleton ────────────────────────────────────────────────────────

  if (sensorsLoading || (loading && sensors.length === 0)) {
    return (
      <main className="mx-auto max-w-7xl px-6 py-8">
        <p className="text-[var(--color-muted-foreground)] text-sm">{se.loadingSensorDashboard}</p>
      </main>
    );
  }

  if (!sensorsLoading && sensors.length === 0) {
    return (
      <main className="mx-auto max-w-7xl px-6 py-8">
        <Alert variant="info">{se.noSensorsFound}</Alert>
      </main>
    );
  }

  const statusStyle = getStatusStyle(liveData?.status);

  // clickable sort header cell
  const SortTh = ({
    colKey,
    label,
    color,
  }: {
    colKey: SortKey;
    label: string;
    color?: string;
  }) => {
    const active = sortKey === colKey;
    const Icon   = active
      ? sortDir === 'asc' ? ChevronUp : ChevronDown
      : ChevronsUpDown;
    return (
      <th
        onClick={() => toggleSort(colKey)}
        className="px-3 py-3 text-xs font-semibold uppercase tracking-wide whitespace-nowrap
          cursor-pointer select-none hover:bg-[var(--color-muted)] transition-colors"
        style={{ color: active ? (color ?? '#374151') : (color ?? '#6B7280') }}
      >
        <span className="inline-flex items-center gap-1">
          {label}
          <Icon className={`w-3 h-3 ${active ? 'opacity-100' : 'opacity-30'}`} />
        </span>
      </th>
    );
  };

  const SensorTabBar = () => (
    <div className="border-b border-[var(--color-border)] bg-white sticky top-[52px] z-40">
      <div className="max-w-7xl mx-auto px-6 flex">
        {[
          { id: 'live', label: 'Live Sensors', icon: <Radio size={14} /> },
          { id: 'anomalies', label: 'Anomalies', icon: <AlertTriangle size={14} /> },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => router.replace(`/manager/sensors?tab=${tab.id}`)}
            className={`flex items-center gap-1.5 px-5 py-3.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === tab.id
                ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                : 'border-transparent text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] hover:border-[var(--color-border)]'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );

  if (activeTab === "anomalies") {
    return (
      <>
        <SensorTabBar />
        <AnomalyDashboardEmbed />
      </>
    );
  }

  return (
    <>
      <SensorTabBar />

      <main className="mx-auto max-w-7xl px-6 py-8 space-y-6">
        {/* ── Header ── */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-3">
            <div>
              <p className="text-xs font-medium text-[var(--color-muted-foreground)] uppercase tracking-widest mb-0.5">
                {se.managerLabel}
              </p>

              <h1 className="text-2xl font-semibold text-[var(--color-foreground)]">
                {se.dashboardTitle}
              </h1>

              {liveData?.macAddress && (
                <p className="text-sm text-[var(--color-muted-foreground)] mt-0.5">
                  {se.deviceLabel}:{" "}
                  <span dir="ltr">{liveData.macAddress}</span>
                </p>
              )}
            </div>
        </div>

        {/* ── Sensor selector ── */}
        {sensors.length > 0 && (
          <div className="flex items-center gap-2">
            <label
              htmlFor="sensor-select"
              className="text-xs font-semibold text-[var(--color-muted-foreground)] uppercase tracking-widest whitespace-nowrap"
            >
              {se.sensorLabel}
            </label>
            <select
              id="sensor-select"
              value={selectedSensorId ?? ''}
              onChange={e => handleSensorChange(Number(e.target.value))}
              disabled={sensorsLoading || loading}
              className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-foreground)]
                bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30
                disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sensors.map(s => (
                <option key={s.SensorId} value={s.SensorId}>
                  {sensorLabel(s, se.inactive)}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            onClick={() => { setExportError(null); setShowExportModal(true); }}
          >
            <Download className="w-4 h-4 mr-2" />
            {se.export}
          </Button>

          <Button
            onClick={() => selectedSensorId && loadDashboard(selectedSensorId, true)}
            disabled={refreshing || !selectedSensorId}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? se.syncing : se.syncFromAtomation}
          </Button>
        </div>
      </div>

      {error       && <Alert variant="error">{error}</Alert>}
      {syncError   && (
        <Alert variant="info">
          {se.atomationSyncFailed} {syncError}
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
                {se.statusLabel} {getStatusLabel(liveData.status, se)}
              </span>
            </div>
            <p className={`text-sm ${statusStyle.text}`}>{liveData.message}</p>
            {liveData.staleMinutes !== null && (
              <p className={`text-sm ${statusStyle.text}`}>
                {se.lastUpdate}{' '}
                <span className="font-semibold" dir="ltr">{liveData.staleMinutes} {se.minAgo}</span>
              </p>
            )}
          </div>
        </div>
      )}

      {!latest ? (
        <Alert variant="info">{se.noReadings}</Alert>
      ) : (
        <>
          {/* ── Live metric cards ── */}
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {METRIC_CONFIG.map(({ key, label, unit, color, digits }) => {
              const val = latest[key as keyof SensorReading] as number | null | undefined;
              return (
                <Card key={key}>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wide">
                      {label}
                    </p>
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                  </div>
                  <p className="text-3xl font-bold text-[var(--color-foreground)]">
                    {formatNumber(val, digits)}
                    {unit && (
                      <span className="text-base font-normal text-[var(--color-muted-foreground)] ml-1">{unit}</span>
                    )}
                  </p>
                </Card>
              );
            })}
          </section>

          {/* ── Latest reading details ── */}
          <Card>
            <p className="text-xs font-semibold text-[var(--color-muted-foreground)] uppercase tracking-widest mb-4">
              {se.latestReadingDetails}
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { label: se.readingId,        value: String(latest.ReadingId) },
                { label: se.type,             value: latest.ReadingType ?? '—' },
                { label: se.sampleTime,       value: formatDateTime(latest.SampleTimeUtc) },
                { label: se.gatewayRead,      value: formatDateTime(latest.GatewayReadTimeUtc) },
                { label: se.atomationCreated, value: formatDateTime(latest.AtomationCreatedAtUtc) },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-lg bg-[var(--color-muted)] px-4 py-3">
                  <p className="text-xs text-[var(--color-muted-foreground)] mb-0.5">{label}</p>
                  <p className="text-sm font-medium text-[var(--color-foreground)]" dir="ltr">{value}</p>
                </div>
              ))}

              {/* Location tile with Google Maps link */}
              <div className="rounded-lg bg-[var(--color-muted)] px-4 py-3">
                <p className="text-xs text-[var(--color-muted-foreground)] mb-0.5">{se.location}</p>
                {mapsUrl(latest.Latitude, latest.Longitude) ? (
                  <a
                    href={mapsUrl(latest.Latitude, latest.Longitude)!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-[#2F6F4E] hover:underline"
                  >
                    <MapPin className="w-3.5 h-3.5 shrink-0" />
                    {formatNumber(latest.Latitude, 5)}, {formatNumber(latest.Longitude, 5)}
                  </a>
                ) : (
                  <p className="text-sm font-medium text-[var(--color-foreground)]">—</p>
                )}
              </div>
            </div>
          </Card>
        </>
      )}

      {/* ── Data Explorer ── */}
      <Card>
        <p className="text-xs font-semibold text-[var(--color-muted-foreground)] uppercase tracking-widest mb-5">
          {se.dataExplorer}
        </p>

        {/* Controls */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:flex-wrap mb-6">

          {/* Date range */}
          <div className="flex items-end gap-2">
            <div>
              <label className="block text-xs text-[var(--color-muted-foreground)] mb-1">{se.from}</label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-foreground)]
                  focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30"
              />
            </div>
            <div>
              <label className="block text-xs text-[var(--color-muted-foreground)] mb-1">{se.to}</label>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-foreground)]
                  focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30"
              />
            </div>
            <Button size="sm" onClick={loadExplorerData} disabled={explorerLoading}>
              {explorerLoading ? se.loading : se.loadData}
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
                <span className="text-sm text-[var(--color-muted-foreground)]">{label}</span>
              </label>
            ))}
          </div>

          {/* View toggle */}
          <div className="flex rounded-lg border border-[var(--color-border)] overflow-hidden shrink-0">
            {([['table', se.tableView], ['graph', se.graphView]] as const).map(([mode, label]) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-4 py-2 text-sm font-medium capitalize transition-colors ${
                  viewMode === mode
                    ? 'bg-[var(--color-primary)] text-white'
                    : 'bg-white text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {explorerError && <Alert variant="error" className="mb-4">{explorerError}</Alert>}

        {/* Results */}
        {!explorerLoaded ? (
          <div className="py-12 text-center text-[var(--color-muted-foreground)] text-sm">
            {se.selectDateRange}
          </div>
        ) : explorerReadings.length === 0 ? (
          <div className="py-12 text-center text-[var(--color-muted-foreground)] text-sm">
            {se.noReadingsInRange}
          </div>
        ) : viewMode === 'table' ? (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b bg-[var(--color-muted)]">
                  <SortTh colKey="SampleTimeUtc" label={se.sampleTime} />
                  <SortTh colKey="ReadingId"      label={se.colId} />
                  <SortTh colKey="ReadingType"    label={se.type} />
                  <SortTh colKey="Latitude"       label={se.location} />
                  {METRIC_CONFIG.filter(m => selectedMetrics.has(m.key)).map(m => (
                    <SortTh
                      key={m.key}
                      colKey={m.key as SortKey}
                      label={`${m.label}${m.unit ? ` (${m.unit})` : ''}`}
                      color={m.color}
                    />
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedReadings.map(r => {
                  const url = mapsUrl(r.Latitude, r.Longitude);
                  return (
                    <tr
                      key={r.ReadingId}
                      className={`border-b last:border-b-0 transition-colors ${
                        alertsByReadingId.has(r.ReadingId)
                          ? 'bg-[var(--color-error-bg)]/60 hover:bg-[var(--color-error-bg)]'
                          : 'hover:bg-[var(--color-muted)]'
                      }`}
                    >
                      <td className="px-3 py-2.5 text-[var(--color-muted-foreground)] whitespace-nowrap">
                        {formatDateTime(r.SampleTimeUtc)}
                      </td>
                      <td className="px-3 py-2.5 text-[var(--color-muted-foreground)] whitespace-nowrap">
                        {r.ReadingId}
                      </td>
                      <td className="px-3 py-2.5 text-[var(--color-muted-foreground)] whitespace-nowrap">
                        {r.ReadingType ?? '—'}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {url ? (
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[#2F6F4E] hover:underline text-sm"
                          >
                            <MapPin className="w-3.5 h-3.5 shrink-0" />
                            {formatNumber(r.Latitude, 5)}, {formatNumber(r.Longitude, 5)}
                          </a>
                        ) : '—'}
                      </td>
                      {METRIC_CONFIG.filter(m => selectedMetrics.has(m.key)).map(m => {
                        const val      = r[m.key as keyof SensorReading] as number | null | undefined;
                        const isAlert  = alertedMetrics.has(`${r.ReadingId}-${m.key}`);
                        return (
                          <td key={m.key} className="px-3 py-2.5 whitespace-nowrap">
                            {val !== null && val !== undefined ? (
                              <span className={isAlert
                                ? 'font-bold text-[var(--color-error)]'
                                : 'font-medium text-[var(--color-foreground)]'
                              }>
                                {formatNumber(val, m.digits)}{m.unit}
                                {isAlert && <span className="ml-1 text-[var(--color-error)]">⚠</span>}
                              </span>
                            ) : (
                              <span className="text-[var(--color-muted-foreground)]">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <>
            {/* ref is attached here so html2canvas can capture it */}
            <div ref={chartRef} dir="ltr" style={{ height: 320 }}>
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
                  <Tooltip content={renderTooltip as never} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {METRIC_CONFIG.filter(m => selectedMetrics.has(m.key)).map(m => (
                    <Line
                      key={m.key}
                      type="monotone"
                      dataKey={m.key}
                      name={`${m.label}${m.unit ? ` (${m.unit})` : ''}`}
                      stroke={m.color}
                      strokeWidth={2}
                      connectNulls
                      dot={(props: {
                        cx?: number; cy?: number; index: number;
                        payload: { readingId?: number };
                      }) => {
                        const isAlert = alertedMetrics.has(
                          `${props.payload.readingId}-${m.key}`
                        );
                        const cx = props.cx ?? 0;
                        const cy = props.cy ?? 0;
                        return isAlert ? (
                          <circle
                            key={`d-${props.index}`}
                            cx={cx} cy={cy}
                            r={5} fill="#EF4444" stroke="white" strokeWidth={1.5}
                          />
                        ) : (
                          <circle key={`d-${props.index}`} cx={cx} cy={cy} r={0} />
                        );
                      }}
                      activeDot={(props: {
                        cx?: number; cy?: number;
                        payload: { readingId?: number };
                      }) => (
                        <circle
                          key="active"
                          cx={props.cx ?? 0} cy={props.cy ?? 0} r={6}
                          fill={alertedMetrics.has(`${props.payload.readingId}-${m.key}`)
                            ? '#EF4444' : m.color}
                          stroke="white" strokeWidth={2}
                        />
                      )}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
            {explorerAlerts.length > 0 && (
              <p className="mt-2 text-xs text-[var(--color-muted-foreground)] flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded-full bg-red-500 shrink-0" />
                {se.redDotsHint}
              </p>
            )}
          </>
        )}

        {explorerLoaded && explorerReadings.length > 0 && (
          <p className="mt-3 text-xs text-[var(--color-muted-foreground)] text-right" dir="ltr">
            {explorerReadings.length} {se.readingsCount} · {explorerAlerts.length} {se.outOfRange}
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
    </>
  );
}

export default function SensorExplorerPage() {
  return (
    <Suspense>
      <SensorDashboardPage />
    </Suspense>
  );
}
