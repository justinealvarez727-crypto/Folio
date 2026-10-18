import type { FontFamilyKey, HighlightColor, ThemeName } from '../types';

/**
 * Reader themes are applied inside epub.js's iframe, which cannot see our CSS
 * variables, so the same palette is mirrored here as plain strings.
 * Contrast ratios (fg on bg) are all >= 7:1 (WCAG AAA for body text).
 */
export interface ReaderTheme {
  bg: string;
  fg: string;
  link: string;
  selection: string;
}

export const READER_THEMES: Record<ThemeName, ReaderTheme> = {
  light: { bg: '#ffffff', fg: '#111111', link: '#005a96', selection: 'rgba(0,113,188,0.25)' },
  dark: { bg: '#000000', fg: '#d6d6d8', link: '#7cc0f2', selection: 'rgba(84,170,235,0.35)' },
  sepia: { bg: '#f8f1e3', fg: '#3c2e1e', link: '#8c4619', selection: 'rgba(140,70,25,0.25)' },
};

export const FONT_STACKS: Record<FontFamilyKey, string> = {
  serif: 'Bookerly, "Iowan Old Style", Georgia, "Times New Roman", serif',
  sans: '"Amazon Ember", Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
};

export const HIGHLIGHT_COLORS: Record<HighlightColor, { fill: string; label: string }> = {
  yellow: { fill: '#facc15', label: 'Yellow' },
  green: { fill: '#4ade80', label: 'Green' },
  blue: { fill: '#60a5fa', label: 'Blue' },
  pink: { fill: '#f472b6', label: 'Pink' },
};

export function resolveTheme(pref: ThemeName | 'system'): ThemeName {
  if (pref !== 'system') return pref;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
