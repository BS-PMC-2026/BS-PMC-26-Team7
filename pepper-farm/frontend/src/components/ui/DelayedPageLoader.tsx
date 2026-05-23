"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

interface DelayedPageLoaderProps {
  delayMs?: number;
}

export default function DelayedPageLoader({ delayMs = 1000 }: DelayedPageLoaderProps) {
  const { t, dir } = useLanguage();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(true), delayMs);
    return () => window.clearTimeout(timer);
  }, [delayMs]);

  if (!visible) return null;

  return (
    <main
      dir={dir}
      className="min-h-screen flex items-center justify-center bg-[var(--color-background)] px-6"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-[var(--color-border)] bg-white px-8 py-7 shadow-sm">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--color-primary)]" aria-hidden="true" />
        <p className="text-sm font-medium text-[var(--color-muted-foreground)]">
          {t.common.loading}
        </p>
      </div>
    </main>
  );
}
