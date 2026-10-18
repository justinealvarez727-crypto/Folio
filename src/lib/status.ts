import type { Book } from '../types';

/** Progress at/above this counts as "finished" unless the reader overrides it. */
export const FINISHED_AT = 0.99;

export const isFinished = (b: Book): boolean => b.finished ?? b.progress.percentage >= FINISHED_AT;

export type BookState = 'unread' | 'reading' | 'finished';

export function bookState(b: Book): BookState {
  if (isFinished(b)) return 'finished';
  return !b.progress.cfi && b.progress.percentage === 0 ? 'unread' : 'reading';
}

/** Shelf order: the book finished longest ago sits at the bottom of the first stack. */
export const finishedOrderKey = (b: Book): number => b.finishedAt ?? b.lastOpenedAt ?? b.addedAt;
