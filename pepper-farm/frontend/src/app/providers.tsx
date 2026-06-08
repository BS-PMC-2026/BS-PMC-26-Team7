"use client";

import { Suspense, type ReactNode } from "react";
import { LanguageProvider } from "@/context/LanguageContext";
import { LoadingProvider } from "@/context/LoadingContext";

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <LanguageProvider>
      <Suspense fallback={null}>
        <LoadingProvider>{children}</LoadingProvider>
      </Suspense>
    </LanguageProvider>
  );
}
