/**
 * Lightweight performance + error monitoring.
 *
 * - Core Web Vitals via the `web-vitals` package (loaded lazily, after first paint).
 * - `performance.mark/measure` helpers for app-specific timings (e.g. epub open time).
 * - Reports go to the console in dev and to VITE_TELEMETRY_URL via sendBeacon in
 *   production. If no endpoint is configured nothing leaves the device.
 */

const ENDPOINT: string = import.meta.env.VITE_TELEMETRY_URL ?? '';

function send(payload: Record<string, unknown>) {
  if (import.meta.env.DEV) {
    console.debug('[telemetry]', payload);
    return;
  }
  if (!ENDPOINT) return;
  try {
    const body = JSON.stringify({ ...payload, ts: Date.now(), ua: navigator.userAgent });
    if (!navigator.sendBeacon?.(ENDPOINT, body)) {
      void fetch(ENDPOINT, { method: 'POST', body, keepalive: true, headers: { 'content-type': 'application/json' } });
    }
  } catch {
    /* telemetry must never throw */
  }
}

export function initPerformanceMonitoring(): void {
  const run = () =>
    import('web-vitals').then(({ onCLS, onFCP, onINP, onLCP, onTTFB }) => {
      const report = (m: { name: string; value: number; rating: string }) =>
        send({ type: 'web-vital', name: m.name, value: Math.round(m.value * 100) / 100, rating: m.rating });
      onCLS(report);
      onFCP(report);
      onINP(report);
      onLCP(report);
      onTTFB(report);
    });
  // Defer so monitoring itself never competes with first paint.
  if ('requestIdleCallback' in window) window.requestIdleCallback(() => void run());
  else setTimeout(() => void run(), 2000);
}

export function mark(name: string): void {
  try {
    performance.mark(name);
  } catch {
    /* ignore */
  }
}

/** Measure between two marks and report; returns duration in ms (or null). */
export function measure(name: string, startMark: string): number | null {
  try {
    const m = performance.measure(name, startMark);
    send({ type: 'timing', name, value: Math.round(m.duration) });
    return m.duration;
  } catch {
    return null;
  }
}

export function reportError(error: unknown, componentStack?: string): void {
  const err = error instanceof Error ? error : new Error(String(error));
  console.error(err);
  send({ type: 'error', message: err.message, stack: err.stack?.slice(0, 2000), componentStack: componentStack?.slice(0, 2000) });
}

export function installGlobalErrorHandlers(): void {
  window.addEventListener('error', (e) => reportError(e.error ?? e.message));
  window.addEventListener('unhandledrejection', (e) => reportError(e.reason));
}
