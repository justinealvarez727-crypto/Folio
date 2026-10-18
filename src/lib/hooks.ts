import { useEffect, useRef, useState, type RefObject } from 'react';
import { loadCover } from './storage';
import { resolveTheme } from './themes';
import { useAnnotationStore } from '../stores/annotationStore';
import { useLibraryStore } from '../stores/libraryStore';
import { useLogStore } from '../stores/logStore';
import { useSettingsStore } from '../stores/settingsStore';
import type { ThemeName } from '../types';

/** True once every persisted store has finished loading from IndexedDB. */
export function useAllHydrated(): boolean {
  const stores = [useLibraryStore, useAnnotationStore, useLogStore];
  const [ready, setReady] = useState(() => stores.every((s) => s.persist.hasHydrated()));
  useEffect(() => {
    if (ready) return;
    const check = () => {
      if (stores.every((s) => s.persist.hasHydrated())) setReady(true);
    };
    const unsubs = stores.map((s) => s.persist.onFinishHydration(check));
    check();
    return () => unsubs.forEach((u) => u());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);
  return ready;
}

/** Resolves "system" to light/dark, mirrors it on <html data-theme> and the theme-color meta tag. */
export function useResolvedTheme(): ThemeName {
  const pref = useSettingsStore((s) => s.theme);
  const [resolved, setResolved] = useState<ThemeName>(() => resolveTheme(pref));

  useEffect(() => {
    const apply = () => setResolved(resolveTheme(pref));
    apply();
    if (pref !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [pref]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', resolved);
    const color = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim().split(/\s+/);
    if (color.length === 3) {
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', `rgb(${color.join(',')})`);
    }
  }, [resolved]);

  return resolved;
}

/** Object URL for a stored cover blob; revoked automatically. */
export function useCoverUrl(bookId: string, hasCover: boolean): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!hasCover) return;
    let revoked: string | null = null;
    let cancelled = false;
    void loadCover(bookId).then((blob) => {
      if (cancelled || !blob) return;
      revoked = URL.createObjectURL(blob);
      setUrl(revoked);
    });
    return () => {
      cancelled = true;
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [bookId, hasCover]);
  return url;
}

/** Trap Tab inside `ref`, close on Escape, restore focus on unmount (WCAG 2.4.3 / 2.1.2). */
export function useFocusTrap(ref: RefObject<HTMLElement>, active: boolean, onEscape: () => void): void {
  const escRef = useRef(onEscape);
  escRef.current = onEscape;
  useEffect(() => {
    if (!active) return;
    const root = ref.current;
    if (!root) return;
    const previous = document.activeElement as HTMLElement | null;
    const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
    const focusables = () => Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE));
    (focusables()[0] ?? root).focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        escRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0]!;
      const last = items[items.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    root.addEventListener('keydown', onKey);
    return () => {
      root.removeEventListener('keydown', onKey);
      previous?.focus?.();
    };
  }, [ref, active]);
}

export function useDebouncedCallback<A extends unknown[]>(fn: (...a: A) => void, ms: number) {
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const timer = useRef<number>();
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return (...args: A) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => fnRef.current(...args), ms);
  };
}

/* ------------------------------------------------------------------ spine colours */

export interface SpineColor {
  /** CSS colours for the spine gradient (top highlight → base → bottom shade). */
  top: string;
  base: string;
  bottom: string;
  /** Readable text colour for this spine. */
  fg: string;
  /** Subtle decorative band colour. */
  band: string;
}

const spineCache = new Map<string, SpineColor>();

function fromRgb(r: number, g: number, b: number): SpineColor {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  // Very light covers would give a washed-out spine; pull them toward the middle.
  const k = lum > 0.7 ? 0.62 : lum < 0.12 ? 1.9 : 1;
  const [R, G, B] = [r * k, g * k, b * k].map(clamp) as [number, number, number];
  const mix = (t: number) => `rgb(${clamp(R * t)} ${clamp(G * t)} ${clamp(B * t)})`;
  const finalLum = (0.299 * R + 0.587 * G + 0.114 * B) / 255;
  const dark = finalLum < 0.55;
  return {
    top: mix(1.18),
    base: mix(1),
    bottom: mix(0.78),
    fg: dark ? 'rgb(255 255 255 / 0.94)' : 'rgb(20 20 20 / 0.9)',
    band: dark ? 'rgb(255 255 255 / 0.28)' : 'rgb(0 0 0 / 0.28)',
  };
}

/** Deterministic, pleasant colour for books without a cover. */
function fallbackSpine(seed: string): SpineColor {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360;
  // HSL(h, 38%, 36%) → RGB
  const s = 0.38;
  const l = 0.36;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return 255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)));
  };
  return fromRgb(f(0), f(8), f(4));
}

/** Average colour of a cover (weighted toward saturated pixels so white margins don't win). */
async function sampleCover(blob: Blob): Promise<[number, number, number] | null> {
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    const size = 16;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, size, size);
    const data = ctx.getImageData(0, 0, size, size).data;
    let r = 0;
    let g = 0;
    let b = 0;
    let w = 0;
    for (let i = 0; i < data.length; i += 4) {
      const R = data[i]!;
      const G = data[i + 1]!;
      const B = data[i + 2]!;
      const sat = Math.max(R, G, B) - Math.min(R, G, B);
      const weight = 1 + sat / 32;
      r += R * weight;
      g += G * weight;
      b += B * weight;
      w += weight;
    }
    return w ? [r / w, g / w, b / w] : null;
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Spine colour derived from the book's cover; falls back to a stable hue from its id. */
export function useSpineColor(bookId: string, hasCover: boolean): SpineColor {
  const [color, setColor] = useState<SpineColor>(() => spineCache.get(bookId) ?? fallbackSpine(bookId));
  useEffect(() => {
    const cached = spineCache.get(bookId);
    if (cached) {
      setColor(cached);
      return;
    }
    if (!hasCover) return;
    let cancelled = false;
    void loadCover(bookId).then(async (blob) => {
      if (!blob || cancelled) return;
      const rgb = await sampleCover(blob);
      if (!rgb || cancelled) return;
      const c = fromRgb(...rgb);
      spineCache.set(bookId, c);
      setColor(c);
    });
    return () => {
      cancelled = true;
    };
  }, [bookId, hasCover]);
  return color;
}
