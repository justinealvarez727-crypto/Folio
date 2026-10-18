import { useReadingTracker } from '../lib/useReadingTracker';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ePub, { type Book as EpubBook, type NavItem, type Rendition } from 'epubjs';
import { AnimatePresence, motion } from 'framer-motion';
import { useLibraryStore } from '../stores/libraryStore';
import { useAnnotationStore } from '../stores/annotationStore';
import { useSettingsStore } from '../stores/settingsStore';
import { loadBookFile, loadLocations, saveLocations } from '../lib/storage';
import { FONT_STACKS, HIGHLIGHT_COLORS, READER_THEMES } from '../lib/themes';
import { mark, measure, reportError } from '../lib/perf';
import { disposeEpub } from '../lib/epubSafe';
import { useDebouncedCallback, useResolvedTheme } from '../lib/hooks';
import { navigate, paths } from '../lib/router';
import type { HighlightColor, MarginSize, ThemeName, TocEntry } from '../types';
import { ProgressBar } from './ProgressBar';
import { Sheet } from './Sheet';
import { SettingsPanel } from './SettingsPanel';
import { HighlightsPanel, TocPanel } from './ReaderPanels';
import { SelectionToolbar, type SelectionState } from './SelectionToolbar';
import { IconBack, IconHighlight, IconList, IconNext } from './Icons';

type Panel = 'contents' | 'highlights' | 'settings' | null;
type TocItem = TocEntry & { index: number };

/** One "location" = this many characters (epub.js locations, like Kindle's Location numbers). */
const CHARS_PER_LOCATION = 250;
/** ~238 wpm average adult reading speed, ~5 chars per word. */
const CHARS_PER_MINUTE = 238 * 5;

/** Side padding per Margins setting; the book column itself never exceeds ~46rem. */
const MARGIN_CLASS: Record<MarginSize, string> = {
  narrow: 'px-4 sm:px-8',
  normal: 'px-7 sm:px-14',
  wide: 'px-10 sm:px-24',
};

/** Walk the (nested) TOC into a flat list annotated with each entry's spine index. */
function flattenToc(items: NavItem[], epub: EpubBook, depth = 0, out: TocItem[] = []): TocItem[] {
  for (const it of items) {
    const base = it.href.split('#')[0] ?? it.href;
    const spineItem = epub.spine.get(base) as { index?: number } | null;
    out.push({ id: it.id || `${depth}-${out.length}`, label: it.label.trim(), href: it.href, depth, index: spineItem?.index ?? -1 });
    if (it.subitems?.length) flattenToc(it.subitems, epub, depth + 1, out);
  }
  return out;
}

function formatMinutes(min: number): string {
  if (min < 1) return 'Less than a minute left';
  if (min < 60) return `${Math.round(min)} min left`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return `${h} hr${m ? ` ${m} min` : ''} left`;
}

export default function Reader({ bookId }: { bookId: string }) {
  const book = useLibraryStore((s) => s.books[bookId]);
  const updateProgress = useLibraryStore((s) => s.updateProgress);
  const markOpened = useLibraryStore((s) => s.markOpened);
  const noteReading = useReadingTracker(book);
  const noteRef = useRef(noteReading);
  noteRef.current = noteReading;
  const allHighlights = useAnnotationStore((s) => s.highlights);
  const { addHighlight, updateHighlight, removeHighlight } = useAnnotationStore.getState();
  const settings = useSettingsStore();
  const resolvedTheme = useResolvedTheme();

  const hostRef = useRef<HTMLDivElement>(null);
  const shadeRef = useRef<HTMLDivElement>(null);
  const epubRef = useRef<EpubBook | null>(null);
  const renditionRef = useRef<Rendition | null>(null);
  const contentsRef = useRef<{ window: Window } | null>(null);
  const appliedRef = useRef(new Map<string, { cfiRange: string; color: HighlightColor }>());
  const tocRef = useRef<TocItem[]>([]);
  const panelRef = useRef<Panel>(null);
  const selectionRef = useRef<SelectionState | null>(null);
  const currentCfiRef = useRef<string | null>(null);
  const themeRef = useRef<ThemeName>(resolvedTheme);
  themeRef.current = resolvedTheme;

  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const [toc, setToc] = useState<TocItem[]>([]);
  const [chapter, setChapter] = useState<{ id: string | null; label: string }>({ id: null, label: '' });
  const [percentage, setPercentage] = useState(book?.progress.percentage ?? 0);
  const [location, setLocation] = useState<{ n: number; total: number } | null>(null);
  const [locationsReady, setLocationsReady] = useState(false);
  const [panel, setPanelState] = useState<Panel>(null);
  const [selection, setSelectionState] = useState<SelectionState | null>(null);
  /** Kindle-style chrome: hidden while reading, toggled by tapping the middle of the page. */
  const [chrome, setChrome] = useState(true);
  const chromeRef = useRef(chrome);
  chromeRef.current = chrome;

  const setPanel = (p: Panel) => {
    panelRef.current = p;
    setPanelState(p);
    if (p) setChrome(false);
  };
  const setSelection = useCallback((s: SelectionState | null) => {
    selectionRef.current = s;
    setSelectionState(s);
    if (s) setChrome(false);
  }, []);

  const bookHighlights = useMemo(() => allHighlights.filter((h) => h.bookId === bookId), [allHighlights, bookId]);
  const bookHighlightsRef = useRef(bookHighlights);
  bookHighlightsRef.current = bookHighlights;

  const clearBrowserSelection = () => contentsRef.current?.window.getSelection()?.removeAllRanges();
  const closeSelection = useCallback(() => {
    clearBrowserSelection();
    setSelection(null);
  }, [setSelection]);

  /* -------------------------------------------------------------- theme/font */
  const applyStyles = useCallback((rendition: Rendition) => {
    const s = useSettingsStore.getState();
    const t = READER_THEMES[themeRef.current];
    rendition.themes.default({
      '::selection': { background: t.selection },
      a: { color: `${t.link} !important` },
      img: { 'max-width': '100% !important', height: 'auto' },
      body: { 'padding-top': '0.4em !important', 'padding-bottom': '0.4em !important' },
      p: { 'orphans': '2', 'widows': '2' },
    });
    rendition.themes.override('color', t.fg);
    rendition.themes.override('background', t.bg);
    rendition.themes.override('font-family', FONT_STACKS[s.fontFamily]);
    rendition.themes.override('line-height', String(s.lineHeight));
    rendition.themes.override('text-align', s.justify ? 'justify' : 'left');
    rendition.themes.override('hyphens', s.justify ? 'auto' : 'manual');
    rendition.themes.fontSize(`${s.fontSize}%`);
  }, []);

  /** Update Location n of N for a CFI (needs the locations index). */
  const updateLocation = useCallback((cfi: string | null) => {
    const epub = epubRef.current;
    if (!epub || !cfi) return;
    const total = epub.locations.length();
    if (total > 0) setLocation({ n: (epub.locations.locationFromCfi(cfi) as unknown as number) + 1, total });
  }, []);

  /* ------------------------------------------------------------- open the book */
  const saveProgress = useDebouncedCallback((cfi: string, pct: number) => updateProgress(bookId, { cfi, percentage: pct }), 500);
  const saveProgressRef = useRef(saveProgress);
  saveProgressRef.current = saveProgress;

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !book) return;
    let cancelled = false;
    appliedRef.current = new Map();
    setStatus('loading');
    mark('reader-open-start');

    (async () => {
      try {
        const buffer = await loadBookFile(bookId);
        if (!buffer) throw new Error('This book’s file is missing from storage. Remove it and add it again.');
        if (cancelled) return;

        const epub = ePub(buffer.slice(0));
        epubRef.current = epub;
        const s = useSettingsStore.getState();
        const rendition = epub.renderTo(host, {
          width: '100%',
          height: '100%',
          flow: s.flow === 'scrolled' ? 'scrolled-doc' : 'paginated',
          spread: 'none',
          allowScriptedContent: false, // never run scripts embedded in untrusted books
        });
        renditionRef.current = rendition;
        applyStyles(rendition);

        // Progress, Location n of N, chapter tracking.
        rendition.on('relocated', (loc: { start: { cfi: string; index: number; percentage: number; displayed: { page: number; total: number } } }) => {
          const spineLen = (epub.spine as unknown as { length: number }).length || 1;
          const fallback = (loc.start.index + (loc.start.displayed.page - 1) / Math.max(1, loc.start.displayed.total)) / spineLen;
          const pct = epub.locations.length() > 0 ? loc.start.percentage : fallback;
          currentCfiRef.current = loc.start.cfi;
          setPercentage(pct);
          updateLocation(loc.start.cfi);
          saveProgressRef.current(loc.start.cfi, pct);
          noteRef.current(pct, true);
          const current = [...tocRef.current].reverse().find((t) => t.index !== -1 && t.index <= loc.start.index);
          setChapter({ id: current?.id ?? null, label: current?.label ?? '' });
        });

        // Selection → toolbar.
        rendition.on('selected', (cfiRange: string, contents: { window: Window }) => {
          const sel = contents.window.getSelection();
          const text = sel?.toString().trim() ?? '';
          if (!text) return;
          contentsRef.current = contents;
          setSelection({ kind: 'new', cfiRange, text: text.slice(0, 1000) });
        });

        // Keyboard inside the book iframe.
        rendition.on('keyup', (e: KeyboardEvent) => handleNavKey(e));

        // Kindle tap zones: left quarter = previous page, right quarter = next page,
        // middle = show/hide the reading menu. In continuous-scroll mode any tap toggles the menu.
        rendition.on('click', (e: MouseEvent) => {
          if (selectionRef.current) {
            closeSelection();
            return;
          }
          if (panelRef.current) return;
          const view = e.view;
          if ((e.target as HTMLElement | null)?.closest?.('a[href]')) return; // let links work
          if (view?.getSelection()?.toString()) return; // end of a text selection, not a tap
          const frame = view?.frameElement as HTMLElement | null;
          const hostRect = hostRef.current?.getBoundingClientRect();
          if (!frame || !hostRect) return;
          // The iframe is as wide as all columns and slides under the host, so convert to host coordinates.
          const x = e.clientX + frame.getBoundingClientRect().left;
          const frac = (x - hostRect.left) / hostRect.width;
          if (useSettingsStore.getState().flow === 'paginated' && frac < 0.25) turn('prev');
          else if (useSettingsStore.getState().flow === 'paginated' && frac > 0.75) turn('next');
          else setChrome((c) => !c);
        });

        // Swipe to turn pages (paginated mode only; ignored while the user is selecting text).
        let touchStart: { x: number; y: number } | null = null;
        rendition.on('touchstart', (e: TouchEvent) => {
          const t = e.changedTouches[0];
          touchStart = t ? { x: t.screenX, y: t.screenY } : null;
        });
        rendition.on('touchend', (e: TouchEvent) => {
          const t = e.changedTouches[0];
          if (!touchStart || !t || useSettingsStore.getState().flow !== 'paginated') return;
          const dx = t.screenX - touchStart.x;
          const dy = t.screenY - touchStart.y;
          touchStart = null;
          const hasSelection = (rendition.getContents() as unknown as { window: Window }[]).some((c) => !!c.window.getSelection()?.toString());
          if (hasSelection) return;
          if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) turn(dx < 0 ? 'next' : 'prev');
        });

        await epub.ready;
        if (cancelled) return;
        const nav = await epub.loaded.navigation;
        const flat = flattenToc(nav.toc, epub);
        tocRef.current = flat;
        setToc(flat);

        await rendition.display(book.progress.cfi || undefined);
        if (cancelled) return;
        markOpened(bookId);
        setStatus('ready');
        mark('reader-open-end');
        measure('reader-open', 'reader-open-start');

        // Build the location index in the background (cached in IndexedDB after the first open).
        const cached = await loadLocations(bookId);
        if (cached) epub.locations.load(cached);
        else {
          await epub.locations.generate(CHARS_PER_LOCATION);
          if (cancelled) return;
          void saveLocations(bookId, epub.locations.save());
        }
        if (cancelled) return;
        setLocationsReady(true);
        const cur = rendition.currentLocation() as unknown as { start?: { cfi: string } } | undefined;
        if (cur?.start?.cfi) {
          setPercentage(epub.locations.percentageFromCfi(cur.start.cfi));
          updateLocation(cur.start.cfi);
        }
      } catch (e) {
        if (cancelled) return;
        reportError(e);
        setError(e instanceof Error ? e.message : 'Could not open this book.');
        setStatus('error');
      }
    })();

    return () => {
      cancelled = true;
      // disposeEpub waits for epub.js to finish opening before destroying it (the reader may
      // tap Back right after opening a book), which avoids epub.js's teardown race.
      disposeEpub(epubRef.current, renditionRef.current);
      renditionRef.current = null;
      epubRef.current = null;
      setLocationsReady(false);
      setLocation(null);
    };
    // The book is opened once per bookId; settings changes are applied by the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId]);

  /* Show the menu briefly on open (so it's discoverable), then get out of the way like Kindle does. */
  useEffect(() => {
    if (status !== 'ready') return;
    const id = window.setTimeout(() => {
      if (!panelRef.current) setChrome(false);
    }, 2200);
    return () => window.clearTimeout(id);
  }, [status]);

  /* --------------------------------------------- react to settings / theme changes */
  useEffect(() => {
    const r = renditionRef.current;
    if (r && status === 'ready') applyStyles(r);
  }, [status, resolvedTheme, settings.fontFamily, settings.fontSize, settings.lineHeight, settings.justify, applyStyles]);

  useEffect(() => {
    const r = renditionRef.current;
    if (!r || status !== 'ready') return;
    const cfi = currentCfiRef.current;
    r.flow(settings.flow === 'scrolled' ? 'scrolled-doc' : 'paginated');
    if (cfi) void r.display(cfi);
  }, [settings.flow, status]);

  /* Margins change the host's width without a window resize, so tell epub.js to re-measure. */
  useEffect(() => {
    const r = renditionRef.current;
    const host = hostRef.current;
    if (!r || !host || status !== 'ready') return;
    const id = requestAnimationFrame(() => {
      r.resize(host.clientWidth, host.clientHeight);
      if (currentCfiRef.current) void r.display(currentCfiRef.current);
    });
    return () => cancelAnimationFrame(id);
  }, [settings.margin, status]);

  /* ------------------------------------------------- highlights ↔ epub.js annotations */
  useEffect(() => {
    const r = renditionRef.current;
    if (!r || status !== 'ready') return;
    const applied = appliedRef.current;
    const ids = new Set(bookHighlights.map((h) => h.id));
    for (const [id, a] of applied) {
      if (!ids.has(id)) {
        r.annotations.remove(a.cfiRange, 'highlight');
        applied.delete(id);
      }
    }
    for (const h of bookHighlights) {
      const a = applied.get(h.id);
      if (a && a.color === h.color) continue;
      if (a) r.annotations.remove(a.cfiRange, 'highlight');
      r.annotations.highlight(
        h.cfiRange,
        { id: h.id },
        () => setSelection({ kind: 'existing', id: h.id }),
        `hl-${h.color}`,
        {
          fill: HIGHLIGHT_COLORS[h.color].fill,
          'fill-opacity': '0.35',
          'mix-blend-mode': themeRef.current === 'dark' ? 'normal' : 'multiply',
        },
      );
      applied.set(h.id, { cfiRange: h.cfiRange, color: h.color });
    }
  }, [bookHighlights, status, setSelection]);

  /* --------------------------------------------------------------- navigation */
  /** Turning a page also dismisses the menu, exactly like tapping the page edge on a Kindle. */
  function turn(dir: 'next' | 'prev') {
    setChrome(false);
    const r = renditionRef.current;
    if (!r) return;
    void (dir === 'next' ? r.next() : r.prev()).then(() => animateTurn(dir));
  }

  /**
   * Page-turn animation. The page text lives in an epub.js iframe we can't snapshot, so we animate
   * the *arriving* page: it swings in from the binding edge (flip) or glides in (slide), while a soft
   * shadow sweeps across like light on a curling page. Skipped for reduced motion / continuous scroll.
   */
  function animateTurn(dir: 'next' | 'prev') {
    const mode = useSettingsStore.getState().pageTurn;
    const host = hostRef.current;
    const shade = shadeRef.current;
    if (!host || mode === 'none' || useSettingsStore.getState().flow !== 'paginated') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const fwd = dir === 'next';
    host.getAnimations().forEach((a) => a.cancel());
    if (mode === 'slide') {
      host.animate(
        [{ transform: `translateX(${fwd ? 36 : -36}px)`, opacity: 0.25 }, { transform: 'translateX(0)', opacity: 1 }],
        { duration: 260, easing: 'cubic-bezier(.2,.8,.2,1)' },
      );
      return;
    }
    host.style.transformOrigin = fwd ? 'left center' : 'right center';
    host.animate(
      [
        { transform: `perspective(1400px) rotateY(${fwd ? -24 : 24}deg)`, opacity: 0.3, offset: 0 },
        { transform: 'perspective(1400px) rotateY(0deg)', opacity: 1, offset: 1 },
      ],
      { duration: 420, easing: 'cubic-bezier(.22,.7,.2,1)' },
    );
    shade?.animate(
      [{ opacity: 0.55, transform: `translateX(${fwd ? '-30%' : '30%'})` }, { opacity: 0, transform: 'translateX(0)' }],
      { duration: 420, easing: 'ease-out' },
    );
  }

  function handleNavKey(e: KeyboardEvent) {
    if (panelRef.current || selectionRef.current) {
      if (e.key === 'Escape' && selectionRef.current) closeSelection();
      return;
    }
    const target = e.target as HTMLElement | null;
    if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
    if (e.key === 'ArrowRight' || e.key === 'PageDown') turn('next');
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') turn('prev');
    else if (e.key === 'Escape') navigate(paths.library());
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => handleNavKey(e);
    window.addEventListener('keyup', onKey);
    return () => window.removeEventListener('keyup', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Taps in the white margins around the text column (outside the epub iframe, so the
   * iframe's own click handler never sees them). The whole screen is tappable, like a Kindle:
   * left half = previous page, right half = next page; in continuous-scroll mode they toggle the menu.
   */
  const onMarginTap = (e: React.MouseEvent<HTMLElement>) => {
    if (!(e.target as HTMLElement).hasAttribute('data-tap')) return; // ignore clicks on real buttons
    if (selectionRef.current) {
      closeSelection();
      return;
    }
    if (panelRef.current || status !== 'ready') return;
    if (useSettingsStore.getState().flow !== 'paginated') setChrome((c) => !c);
    else turn(e.clientX < window.innerWidth / 2 ? 'prev' : 'next');
  };

  const goto = (target: string) => {
    setPanel(null);
    void renditionRef.current?.display(target);
  };

  const seek = (p: number) => {
    const epub = epubRef.current;
    const r = renditionRef.current;
    if (!epub || !r) return;
    if (locationsReady) {
      void r.display(epub.locations.cfiFromPercentage(Math.min(0.999, p)));
    } else {
      const len = (epub.spine as unknown as { length: number }).length;
      const item = epub.spine.get(Math.min(len - 1, Math.floor(p * len)));
      if (item) void r.display(item.href);
    }
  };

  /* -------------------------------------------------------------- highlight actions */
  const chapterLabel = chapter.label;

  const onHighlight = (color: HighlightColor) => {
    const sel = selectionRef.current;
    if (!sel) return;
    if (sel.kind === 'existing') {
      updateHighlight(sel.id, { color });
      return;
    }
    const dup = bookHighlightsRef.current.find((h) => h.cfiRange === sel.cfiRange);
    if (dup) updateHighlight(dup.id, { color });
    else addHighlight({ bookId, cfiRange: sel.cfiRange, text: sel.text, color, chapter: chapterLabel });
    closeSelection();
  };

  const activeHighlight = selection?.kind === 'existing' ? bookHighlights.find((h) => h.id === selection.id) : undefined;

  if (!book) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
        <p className="text-sm text-muted">This book isn’t in your library.</p>
        <button className="btn-primary" onClick={() => navigate(paths.library())}>
          Back to library
        </button>
      </div>
    );
  }

  const pct = Math.round(percentage * 100);
  const minutesLeft = location ? ((location.total - location.n) * CHARS_PER_LOCATION) / CHARS_PER_MINUTE : null;
  const locationText = location ? `Location ${location.n} of ${location.total}` : locationsReady ? '' : 'Calculating location…';
  const rightText = minutesLeft != null ? `${pct}% · ${formatMinutes(minutesLeft)}` : `${pct}%`;

  return (
    <div className="fixed inset-0 bg-bg">
      {/* ---------------------------------------------------------------- page */}
      {/* The page itself is mouse/touch only: keyboard users turn pages with the arrow keys or the buttons. */}
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions */}
      <main id="main" data-tap="" className="absolute inset-0" onClick={onMarginTap}>
        <div data-tap="" className={`mx-auto h-full max-w-[46rem] pb-12 pt-12 ${MARGIN_CLASS[settings.margin]}`}>
          <div className="relative h-full w-full" style={{ perspective: '1400px' }}>
            <div ref={hostRef} className="epub-host h-full w-full will-change-transform" aria-label={`Text of ${book.title}`} />
            <div
              ref={shadeRef}
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-0"
              style={{ background: 'linear-gradient(90deg, rgb(0 0 0 / 0.22), transparent 55%)' }}
            />
          </div>
        </div>

        {status === 'ready' && settings.flow === 'paginated' && (
          <>
            <button
              className="icon-btn absolute left-1 top-1/2 hidden h-14 w-10 -translate-y-1/2 text-muted opacity-40 hover:opacity-100 md:inline-flex"
              onClick={() => turn('prev')}
              aria-label="Previous page"
            >
              <IconBack />
            </button>
            <button
              className="icon-btn absolute right-1 top-1/2 hidden h-14 w-10 -translate-y-1/2 text-muted opacity-40 hover:opacity-100 md:inline-flex"
              onClick={() => turn('next')}
              aria-label="Next page"
            >
              <IconNext />
            </button>
          </>
        )}

        <AnimatePresence>
          {status === 'loading' && (
            <motion.div
              key="loading"
              initial={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-bg"
              role="status"
              aria-label="Opening book"
            >
              <span className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" aria-hidden />
              <p className="text-sm text-muted">Opening “{book.title}”…</p>
            </motion.div>
          )}
          {status === 'error' && (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              role="alert"
              className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-bg px-6 text-center"
            >
              <h2 className="text-base font-semibold">Couldn’t open this book</h2>
              <p className="max-w-sm text-sm text-muted">{error}</p>
              <button className="btn-primary" onClick={() => navigate(paths.library())}>
                Back to library
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* ------------------------------------------- quiet running header / footer */}
      {/* Visible while reading (menu hidden): book title on top, location + progress below. */}
      <AnimatePresence>
        {!chrome && status === 'ready' && (
          <motion.div key="running" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
            <div className="pointer-events-none absolute inset-x-0 top-0 px-6 pt-[max(0.75rem,env(safe-area-inset-top))] text-center text-[12px] text-muted">
              <span className="mx-auto block max-w-[46rem] truncate">{book.title}</span>
            </div>
            <div className="pointer-events-none absolute inset-x-0 bottom-0 px-6 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-[12px] tabular-nums text-muted">
              <div className="mx-auto flex max-w-[46rem] justify-between gap-4">
                <span className="truncate">{locationText}</span>
                <span className="shrink-0">{rightText}</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Keyboard / screen-reader users can't tap the middle of the page: give them a real button. */}
      <button
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-40 focus:rounded-md focus:bg-accent focus:px-3 focus:py-2 focus:text-sm focus:text-accent-fg"
        onClick={() => setChrome((c) => !c)}
        aria-expanded={chrome}
      >
        {chrome ? 'Hide reading menu' : 'Show reading menu'}
      </button>

      {/* ------------------------------------------------------------- top menu */}
      <AnimatePresence>
        {chrome && (
          <motion.header
            key="top"
            initial={{ y: -64, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -64, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 420, damping: 38 }}
            className="absolute inset-x-0 top-0 z-30 flex items-center gap-1 border-b border-line bg-bg/95 px-2 pb-1.5 pt-[max(0.375rem,env(safe-area-inset-top))] backdrop-blur sm:px-4"
          >
            <button className="icon-btn" onClick={() => navigate(paths.library())} aria-label="Back to library">
              <IconBack width={22} height={22} />
            </button>
            <h1 className="mx-1 min-w-0 flex-1 truncate text-center text-[14px] font-semibold">{book.title}</h1>
            <button className="icon-btn font-serif text-[17px] font-semibold" onClick={() => setPanel('settings')} aria-label="Reading settings">
              Aa
            </button>
            <button className="icon-btn" onClick={() => setPanel('contents')} aria-label="Table of contents">
              <IconList width={20} height={20} />
            </button>
            <button className="icon-btn relative" onClick={() => setPanel('highlights')} aria-label={`Highlights and notes (${bookHighlights.length})`}>
              <IconHighlight width={20} height={20} />
              {bookHighlights.length > 0 && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-accent" aria-hidden />}
            </button>
          </motion.header>
        )}
      </AnimatePresence>

      {/* ---------------------------------------------------------- bottom menu */}
      <AnimatePresence>
        {chrome && (
          <motion.footer
            key="bottom"
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 420, damping: 38 }}
            className="absolute inset-x-0 bottom-0 z-30 border-t border-line bg-bg/95 px-5 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:px-8"
          >
            <div className="mx-auto max-w-[46rem]">
              <p className="mb-1 truncate text-[13px] font-medium" aria-live="polite">
                {chapterLabel || book.author}
              </p>
              <ProgressBar value={percentage} label="Reading progress. Use arrow keys to jump." onSeek={seek} disabled={status !== 'ready'} />
              <div className="mt-0.5 flex justify-between gap-4 text-[12px] tabular-nums text-muted">
                <span className="truncate">{locationText}</span>
                <span className="shrink-0">{rightText}</span>
              </div>
            </div>
          </motion.footer>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selection && (selection.kind === 'new' || activeHighlight) && (
          <SelectionToolbar
            key="toolbar"
            selection={selection}
            highlight={activeHighlight}
            activeColor={activeHighlight?.color}
            onHighlight={onHighlight}
            onDelete={() => {
              if (selection.kind === 'existing') removeHighlight(selection.id);
              closeSelection();
            }}
            onSaveNote={(note) => selection.kind === 'existing' && updateHighlight(selection.id, { note })}
            onClose={closeSelection}
          />
        )}
      </AnimatePresence>

      <Sheet open={panel === 'contents'} onClose={() => setPanel(null)} title="Contents">
        <TocPanel entries={toc} activeId={chapter.id} onGoto={goto} />
      </Sheet>
      <Sheet open={panel === 'highlights'} onClose={() => setPanel(null)} title="Highlights & notes">
        <HighlightsPanel book={book} highlights={bookHighlights} onGoto={goto} />
      </Sheet>
      <Sheet open={panel === 'settings'} onClose={() => setPanel(null)} title="Reading settings" placement="bottom">
        <SettingsPanel />
      </Sheet>
    </div>
  );
}
