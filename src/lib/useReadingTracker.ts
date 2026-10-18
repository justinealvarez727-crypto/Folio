import { useCallback, useEffect, useRef } from 'react';
import { useLogStore } from '../stores/logStore';
import { creditSeconds, FLUSH_CAP_S, IDLE_CAP_S } from './readingLog';
import type { Book } from '../types';

/**
 * Feeds the reading log while a book is open.
 *
 * Call the returned `note(pct, isTurn)` from the reader's "relocated" event. The first call after
 * opening only starts the clock (landing on your saved page isn't a page turn). When the book is
 * closed, or the app goes to the background, the final stretch of reading is credited (capped).
 */
export function useReadingTracker(book: Book | undefined) {
  const last = useRef<number | null>(null);
  const bookRef = useRef(book);
  bookRef.current = book;
  const pctRef = useRef(0);
  const started = useRef(false);

  const note = useCallback((pct: number, isTurn: boolean) => {
    const b = bookRef.current;
    if (!b) return;
    const now = Date.now();
    pctRef.current = pct;
    useLogStore.getState().addActivity(b.id, { title: b.title, author: b.author }, {
      at: now,
      seconds: creditSeconds(last.current, now, IDLE_CAP_S),
      // Landing on the saved page (no clock running yet) is not a page turn.
      turn: isTurn && last.current != null,
      pct,
    });
    started.current = true;
    last.current = now;
  }, []);

  const flush = useCallback(() => {
    const b = bookRef.current;
    if (!b || last.current == null) return;
    const now = Date.now();
    useLogStore.getState().addActivity(b.id, { title: b.title, author: b.author }, {
      at: now,
      seconds: creditSeconds(last.current, now, FLUSH_CAP_S),
      turn: false,
      pct: pctRef.current,
    });
    last.current = null;
  }, []);

  const bookId = book?.id;
  useEffect(() => {
    last.current = null;
    started.current = false;
    const onVisibility = () => {
      if (document.hidden) flush();
      // Coming back: only restart the clock if we were actually mid-book.
      else if (started.current) last.current = Date.now();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', flush);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, [bookId, flush]);

  return note;
}
