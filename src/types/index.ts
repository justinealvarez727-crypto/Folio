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
}

export interface TocEntry {
  id: string;
  label: string;
  href: string;
  depth: number;
}
