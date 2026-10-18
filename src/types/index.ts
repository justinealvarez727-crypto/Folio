/**
 * Domain model.
 *
 * Architecture decision: heavy binary data (the .epub file itself, cover image,
 * generated epub.js locations) lives in IndexedDB under `lib/storage.ts`, while
 * Zustand stores only hold small JSON metadata. That keeps persisted state well
 * under any quota and makes hydration fast even with large libraries.
 */

export type ThemeName = 'light' | 'dark' | 'sepia';
export type ThemePreference = ThemeName | 'system';
export type FontFamilyKey = 'serif' | 'sans';
export type FlowMode = 'paginated' | 'scrolled';
export type PageTurn = 'curl' | 'slide' | 'none';
export type MarginSize = 'narrow' | 'normal' | 'wide';

export interface ReadingProgress {
  /** epub CFI of the first visible position; null until the book is first opened. */
  cfi: string | null;
  /** 0..1 */
  percentage: number;
  updatedAt: number | null;
}

export interface Book {
  /** First 16 hex chars of the SHA-256 of the file -> importing the same file twice is a no-op. */
  id: string;
  title: string;
  author: string;
  language: string | null;
  fileName: string;
  fileSize: number;
  hasCover: boolean;
  addedAt: number;
  lastOpenedAt: number | null;
  progress: ReadingProgress;
  /**
   * Explicit override of the finished state. `undefined` = automatic (finished once
   * progress reaches 99%); `true`/`false` = the reader chose "Mark as finished/unread".
   */
  finished?: boolean;
  /** When the reader marked it finished; used to order the shelf (newest on top). */
  finishedAt?: number;
}

export type HighlightColor = 'yellow' | 'green' | 'blue' | 'pink';

export interface Highlight {
  id: string;
  bookId: string;
  cfiRange: string;
  text: string;
  color: HighlightColor;
  note: string;
  chapter: string;
  createdAt: number;
}

export interface ReaderSettings {
  theme: ThemePreference;
  /** Percent, 80..180 */
  fontSize: number;
  fontFamily: FontFamilyKey;
  lineHeight: number;
  flow: FlowMode;
  /** Side margins of the page, like Kindle's Layout > Margins. */
  margin: MarginSize;
  justify: boolean;
  /** Animation when turning a page (paginated mode). */
  pageTurn: PageTurn;
}

export interface TocEntry {
  id: string;
  label: string;
  href: string;
  depth: number;
}

/** What one book contributed to one calendar day in the reading log. */
export interface DayBookEntry {
  /** Snapshot, so the log still reads well after a book is removed from the library. */
  title: string;
  author: string;
  /** Active reading time that day, in seconds (idle gaps are capped, not counted). */
  seconds: number;
  /** Page turns / jumps that day. */
  turns: number;
  /** Book progress (0..1) at the first and latest activity of the day. */
  startPct: number;
  endPct: number;
  firstAt: number;
  lastAt: number;
}
