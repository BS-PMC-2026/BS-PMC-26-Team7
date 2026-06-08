"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useSearchParams } from "next/navigation";
import PepperSpinnerLoader from "@/components/ui/PepperSpinnerLoader";
import {
  GLOBAL_LOADING_END,
  GLOBAL_LOADING_START,
  GLOBAL_ROUTE_LOADING_START,
  beginRouteLoading,
  beginGlobalLoading,
  endGlobalLoading,
  markRouteLoadingWindow,
} from "@/lib/globalLoading";

interface LoadingContextValue {
  isLoading: boolean;
  showLoader: () => void;
  hideLoader: () => void;
  startRouteLoader: () => void;
  withLoader: <T>(asyncFn: () => Promise<T>) => Promise<T>;
}

const LoadingContext = createContext<LoadingContextValue | null>(null);
const ROUTE_SETTLE_MS = 900;

export function LoadingProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const locationKey = `${pathname}?${searchParams.toString()}`;
  const [pendingCount, setPendingCount] = useState(0);
  const [routePending, setRoutePending] = useState(false);
  const previousLocationKeyRef = useRef(locationKey);
  const routeTimeoutRef = useRef<number | null>(null);

  const showLoader = useCallback(() => {
    setPendingCount((count) => count + 1);
  }, []);

  const hideLoader = useCallback(() => {
    setPendingCount((count) => Math.max(0, count - 1));
  }, []);

  const startRouteLoader = useCallback(() => {
    markRouteLoadingWindow();
    setRoutePending(true);
  }, []);

  const withLoader = useCallback(
    async <T,>(asyncFn: () => Promise<T>): Promise<T> => {
      showLoader();
      try {
        return await asyncFn();
      } finally {
        hideLoader();
      }
    },
    [hideLoader, showLoader],
  );

  useEffect(() => {
    window.addEventListener(GLOBAL_LOADING_START, showLoader);
    window.addEventListener(GLOBAL_LOADING_END, hideLoader);
    window.addEventListener(GLOBAL_ROUTE_LOADING_START, startRouteLoader);
    return () => {
      window.removeEventListener(GLOBAL_LOADING_START, showLoader);
      window.removeEventListener(GLOBAL_LOADING_END, hideLoader);
      window.removeEventListener(GLOBAL_ROUTE_LOADING_START, startRouteLoader);
    };
  }, [hideLoader, showLoader, startRouteLoader]);

  useEffect(() => {
    const onDocumentClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const anchor = (event.target as Element | null)?.closest?.("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;

      let nextUrl: URL;
      try {
        nextUrl = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }

      if (nextUrl.origin !== window.location.origin) return;

      const currentUrl = new URL(window.location.href);
      const samePathAndSearch =
        nextUrl.pathname === currentUrl.pathname &&
        nextUrl.search === currentUrl.search;

      if (samePathAndSearch) return;

      startRouteLoader();
    };

    document.addEventListener("click", onDocumentClick, true);
    return () => document.removeEventListener("click", onDocumentClick, true);
  }, [startRouteLoader]);

  useEffect(() => {
    if (!routePending) return;

    if (routeTimeoutRef.current !== null) {
      window.clearTimeout(routeTimeoutRef.current);
    }

    routeTimeoutRef.current = window.setTimeout(() => {
      setRoutePending(false);
      routeTimeoutRef.current = null;
    }, 10_000);

    return () => {
      if (routeTimeoutRef.current !== null) {
        window.clearTimeout(routeTimeoutRef.current);
        routeTimeoutRef.current = null;
      }
    };
  }, [routePending]);

  useEffect(() => {
    if (previousLocationKeyRef.current !== locationKey) {
      previousLocationKeyRef.current = locationKey;
      markRouteLoadingWindow(2_500);
      if (routeTimeoutRef.current !== null) {
        window.clearTimeout(routeTimeoutRef.current);
      }
      routeTimeoutRef.current = window.setTimeout(() => {
        setRoutePending(false);
        routeTimeoutRef.current = null;
      }, ROUTE_SETTLE_MS);
    }
  }, [locationKey]);

  const value = useMemo(
    () => ({
      isLoading: pendingCount > 0 || routePending,
      showLoader,
      hideLoader,
      startRouteLoader,
      withLoader,
    }),
    [hideLoader, pendingCount, routePending, showLoader, startRouteLoader, withLoader],
  );

  return (
    <LoadingContext.Provider value={value}>
      {children}
      <PepperSpinnerLoader isLoading={pendingCount > 0 || routePending} fullscreen minDelay={routePending ? 0 : 250} />
    </LoadingContext.Provider>
  );
}

export function useLoading(): LoadingContextValue {
  const context = useContext(LoadingContext);
  if (context) return context;

  return {
    isLoading: false,
    showLoader: beginGlobalLoading,
    hideLoader: endGlobalLoading,
    startRouteLoader: beginRouteLoading,
    withLoader: async <T,>(asyncFn: () => Promise<T>) => {
      beginGlobalLoading();
      try {
        return await asyncFn();
      } finally {
        endGlobalLoading();
      }
    },
  };
}
