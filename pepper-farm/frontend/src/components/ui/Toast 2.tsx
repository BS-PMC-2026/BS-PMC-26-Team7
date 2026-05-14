'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface ToastItem {
  id: string;
  title: string;
  body: string;
  severity: 'High' | 'Medium';
  autoDismissMs?: number;
}

// ---------------------------------------------------------------------------
// Single Toast card
// ---------------------------------------------------------------------------
function Toast({
  item,
  onDismiss,
}: {
  item: ToastItem;
  onDismiss: (id: string) => void;
}) {
  const isHigh = item.severity === 'High';

  useEffect(() => {
    const timer = setTimeout(() => onDismiss(item.id), item.autoDismissMs ?? 6000);
    return () => clearTimeout(timer);
  }, [item.id, item.autoDismissMs, onDismiss]);

  return (
    <motion.div
      layout
      initial={{ x: 120, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 120, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className={`
        relative flex gap-3 items-start w-80 rounded-xl shadow-lg border bg-white p-4
        ${isHigh ? 'border-l-4 border-l-red-500 border-gray-200' : 'border-l-4 border-l-amber-400 border-gray-200'}
      `}
    >
      {/* Severity dot */}
      <span
        className={`mt-0.5 shrink-0 w-2 h-2 rounded-full ${isHigh ? 'bg-red-500' : 'bg-amber-400'}`}
      />

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-bold uppercase tracking-wider mb-0.5 ${isHigh ? 'text-red-600' : 'text-amber-600'}`}>
          {item.title}
        </p>
        <p className="text-xs text-gray-600 leading-snug whitespace-pre-line">{item.body}</p>
      </div>

      {/* Close */}
      <button
        onClick={() => onDismiss(item.id)}
        className="shrink-0 text-gray-300 hover:text-gray-500 transition-colors text-base leading-none cursor-pointer"
        aria-label="Dismiss"
      >
        ×
      </button>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Container — rendered as a portal at the bottom-right of the viewport
// ---------------------------------------------------------------------------
export function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;

  return createPortal(
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 items-end pointer-events-none">
      <AnimatePresence mode="sync">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto">
            <Toast item={t} onDismiss={onDismiss} />
          </div>
        ))}
      </AnimatePresence>
    </div>,
    document.body
  );
}
