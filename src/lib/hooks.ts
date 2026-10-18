import { useEffect, useRef, useState, type RefObject } from 'react';
import { loadCover } from './storage';
import { resolveTheme } from './themes';
import { useAnnotationStore } from '../stores/annotationStore';
import { useLibraryStore } from '../stores/libraryStore';
import { useSettingsStore } from '../stores/settingsStore';
import type { ThemeName } from '../types';

/** True once every persisted store has finished loading from IndexedDB. */
export function useAllHydrated(): boolean {
  const stores = [useLibraryStore, useAnnotationStore];
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
