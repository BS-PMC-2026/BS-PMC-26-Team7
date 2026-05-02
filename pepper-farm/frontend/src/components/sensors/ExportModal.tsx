'use client';

import { useState } from 'react';
import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';

export interface ExportOptions {
  includeTable: boolean;
  includeGraph: boolean;
  delivery: 'download' | 'email';
  email: string;
}

interface ExportModalProps {
  onClose: () => void;
  canExportTable: boolean;
  canExportGraph: boolean;
  isExporting: boolean;
  exportError: string | null;
  onExport: (opts: ExportOptions) => Promise<void>;
}

export default function ExportModal({
  onClose,
  canExportTable,
  canExportGraph,
  isExporting,
  exportError,
  onExport,
}: ExportModalProps) {
  const [includeTable, setIncludeTable] = useState(canExportTable);
  const [includeGraph, setIncludeGraph] = useState(canExportGraph);
  const [delivery, setDelivery] = useState<'download' | 'email'>('download');
  const [email, setEmail] = useState('');

  const nothingSelected = !includeTable && !includeGraph;
  const emailInvalid    = delivery === 'email' && !email.includes('@');
  const canSubmit       = !nothingSelected && !emailInvalid && !isExporting;

  async function handleSubmit() {
    if (!canSubmit) return;
    await onExport({ includeTable, includeGraph, delivery, email });
  }

  return (
    <Modal onClose={onClose}>
      <h2 className="text-lg font-semibold text-gray-900 mb-5">Export Sensor Data</h2>

      {exportError && (
        <Alert variant="error" className="mb-4">{exportError}</Alert>
      )}

      {/* ── What to export ── */}
      <fieldset className="mb-6">
        <legend className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
          Include
        </legend>

        <div className="space-y-3">
          <label
            className={`flex items-start gap-3 ${
              canExportTable ? 'cursor-pointer' : 'opacity-40 cursor-not-allowed'
            }`}
          >
            <input
              type="checkbox"
              checked={includeTable}
              disabled={!canExportTable}
              onChange={e => setIncludeTable(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded accent-[#2F6F4E]"
            />
            <div>
              <span className="text-sm text-gray-700">
                Table{' '}
                <span className="text-gray-400 font-normal">→ Excel (.xlsx)</span>
              </span>
              {!canExportTable && (
                <p className="text-xs text-gray-400 mt-0.5">
                  Load data first in the Data Explorer
                </p>
              )}
            </div>
          </label>

          <label
            className={`flex items-start gap-3 ${
              canExportGraph ? 'cursor-pointer' : 'opacity-40 cursor-not-allowed'
            }`}
          >
            <input
              type="checkbox"
              checked={includeGraph}
              disabled={!canExportGraph}
              onChange={e => setIncludeGraph(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded accent-[#2F6F4E]"
            />
            <div>
              <span className="text-sm text-gray-700">
                Graph{' '}
                <span className="text-gray-400 font-normal">→ PDF</span>
              </span>
              {!canExportGraph && (
                <p className="text-xs text-gray-400 mt-0.5">
                  Switch to Graph view and load data first
                </p>
              )}
            </div>
          </label>
        </div>
      </fieldset>

      {/* ── Delivery method ── */}
      <fieldset className="mb-6">
        <legend className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
          Deliver via
        </legend>

        <div className="space-y-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="radio"
              name="delivery"
              value="download"
              checked={delivery === 'download'}
              onChange={() => setDelivery('download')}
              className="w-4 h-4 accent-[#2F6F4E]"
            />
            <span className="text-sm text-gray-700">Download to device</span>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="radio"
              name="delivery"
              value="email"
              checked={delivery === 'email'}
              onChange={() => setDelivery('email')}
              className="w-4 h-4 accent-[#2F6F4E]"
            />
            <span className="text-sm text-gray-700">Send by email</span>
          </label>
        </div>

        {delivery === 'email' && (
          <div className="mt-4">
            <label className="block text-xs text-gray-500 mb-1">Recipient email address</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-lg border border-[#DDE5DC] px-3 py-2 text-sm
                text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#2F6F4E]/30"
            />
          </div>
        )}
      </fieldset>

      {/* ── Actions ── */}
      <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
        <Button variant="ghost" onClick={onClose} disabled={isExporting}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={!canSubmit}>
          {isExporting ? 'Exporting…' : 'Export'}
        </Button>
      </div>
    </Modal>
  );
}
