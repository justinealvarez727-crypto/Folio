import type { DayBookEntry } from '../types';

/**
 * Reading-log maths — pure functions, no React, no storage.
 *
 * Time model: we only see page turns, not eyeballs. Each turn credits the time since the previous
 * activity, but never more than IDLE_CAP_S (a page rarely takes longer than 3 minutes; anything
 * longer is a phone left on the table). When the reader leaves the book or hides the app, the
 * last stretch is credited up to FLUSH_CAP_S.
 */

export type DayLog = Record<string, Record<string, DayBookEntry>>;
export interface DayBook extends DayBookEntry {
  bookId: string;
}

export const IDLE_CAP_S = 180;
export const FLUSH_CAP_S = 90;
/** A day "counts" for a book once it has this much reading… */
export const MIN_SECONDS = 30;
/** …or this many page turns (so a quick skim of a few pages still shows up). */
export const MIN_TURNS = 2;

/** Local-time calendar key, e.g. "2026-10-18". */
export function dayKey(t: number | Date = Date.now()): string {
  const d = typeof t === 'number' ? new Date(t) : t;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function dateFromKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d);
}

export const isRead = (e: DayBookEntry): boolean => e.turns >= MIN_TURNS || e.seconds >= MIN_SECONDS;

/** Books read on a given day, most time first. */
export function booksRead(days: DayLog, key: string): DayBook[] {
  const day = days[key];
  if (!day) return [];
  return Object.entries(day)
    .filter(([, e]) => isRead(e))
    .map(([bookId, e]) => ({ bookId, ...e }))
    .sort((a, b) => b.seconds - a.seconds || a.firstAt - b.firstAt);
}

export const daysInMonth = (year: number, month: number): number => new Date(year, month + 1, 0).getDate();

/** Cells for a Sunday-first month grid: leading `null`s, then 1…N. */
export function monthCells(year: number, month: number): (number | null)[] {
  const lead = new Date(year, month, 1).getDay();
  return [...Array<null>(lead).fill(null), ...Array.from({ length: daysInMonth(year, month) }, (_, i) => i + 1)];
}

export interface MonthStats {
  daysRead: number;
  seconds: number;
  books: number;
}

export function monthStats(days: DayLog, year: number, month: number): MonthStats {
  let daysRead = 0;
  let seconds = 0;
  const books = new Set<string>();
  for (let d = 1; d <= daysInMonth(year, month); d++) {
    const list = booksRead(days, dayKey(new Date(year, month, d)));
    if (list.length) daysRead++;
    for (const b of list) {
      seconds += b.seconds;
      books.add(b.bookId);
    }
  }
  return { daysRead, seconds, books: books.size };
}

/**
 * Consecutive days with reading, counting back from today. If you haven't read yet today the
 * streak is still alive (it runs up to yesterday) — it only breaks once a whole day is missed.
 */
export function currentStreak(days: DayLog, today: Date = new Date()): number {
  const cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (!booksRead(days, dayKey(cursor)).length) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (booksRead(days, dayKey(cursor)).length) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/** "<1 min", "12 min", "1 h", "1 h 05 min". */
export function formatDuration(seconds: number): string {
  if (seconds < 45) return seconds <= 0 ? '0 min' : '<1 min';
  const total = Math.round(seconds / 60);
  if (total < 60) return `${total} min`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m ? `${h} h ${String(m).padStart(2, '0')} min` : `${h} h`;
}

export interface Activity {
  at: number;
  /** Seconds of reading to credit with this event. */
  seconds: number;
  /** Was this a page turn / jump (as opposed to just closing the book)? */
  turn: boolean;
  /** Book progress 0..1 at this moment. */
  pct: number;
}

/** Fold one activity event into a day entry. */
export function applyActivity(prev: DayBookEntry | undefined, meta: { title: string; author: string }, a: Activity): DayBookEntry {
  if (!prev) {
    return {
      title: meta.title,
      author: meta.author,
      seconds: a.seconds,
      turns: a.turn ? 1 : 0,
      startPct: a.pct,
      endPct: a.pct,
      firstAt: a.at,
      lastAt: a.at,
    };
  }
  return {
    ...prev,
    title: meta.title,
    author: meta.author,
    seconds: prev.seconds + a.seconds,
    turns: prev.turns + (a.turn ? 1 : 0),
    endPct: a.turn ? a.pct : prev.endPct,
    lastAt: a.at,
  };
}

/** Seconds to credit for activity at `now` given the previous activity time (null = none yet). */
export function creditSeconds(last: number | null, now: number, cap: number): number {
  if (last == null) return 0;
  return Math.max(0, Math.min((now - last) / 1000, cap));
}
