export const GLOBAL_LOADING_START = "pepper-farm:loading-start";
export const GLOBAL_LOADING_END = "pepper-farm:loading-end";
export const GLOBAL_ROUTE_LOADING_START = "pepper-farm:route-loading-start";

const ROUTE_LOADING_WINDOW_MS = 8_000;

declare global {
  interface Window {
    __pepperRouteLoadingUntil?: number;
  }
}

export function markRouteLoadingWindow(durationMs = ROUTE_LOADING_WINDOW_MS) {
  if (typeof window === "undefined") return;
  window.__pepperRouteLoadingUntil = Date.now() + durationMs;
}

export function isRouteLoadingWindowActive() {
  return (
    typeof window !== "undefined" &&
    typeof window.__pepperRouteLoadingUntil === "number" &&
    window.__pepperRouteLoadingUntil > Date.now()
  );
}

export function beginGlobalLoading() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(GLOBAL_LOADING_START));
}

export function endGlobalLoading() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(GLOBAL_LOADING_END));
}

export function beginRouteLoading() {
  if (typeof window === "undefined") return;
  markRouteLoadingWindow();
  window.dispatchEvent(new Event(GLOBAL_ROUTE_LOADING_START));
}

export async function withGlobalLoading<T>(asyncFn: () => Promise<T>): Promise<T> {
  beginGlobalLoading();
  try {
    return await asyncFn();
  } finally {
    endGlobalLoading();
  }
}
