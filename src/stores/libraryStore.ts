import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { idbStorage } from '../lib/storage';
import type { Book, ReadingProgress } from '../types';

/**
 * Library metadata + per-book reading progress.
 * Persisted to IndexedDB (not localStorage) so large libraries never hit quota.
 */
interface LibraryState {
  books: Record<string, Book>;
  addBook: (book: Book) => void;
  removeBook: (id: string) => void;
  updateProgress: (id: string, progress: Partial<ReadingProgress>) => void;
  markOpened: (id: string) => void;
  /** true = shelve as finished, false = move back to the library, undefined = automatic. */
  setFinished: (id: string, finished: boolean | undefined) => void;
}

export const useLibraryStore = create<LibraryState>()(
  persist(
    (set) => ({
      books: {},
      addBook: (book) => set((s) => ({ books: { ...s.books, [book.id]: book } })),
      removeBook: (id) =>
        set((s) => {
          const { [id]: _removed, ...rest } = s.books;
          return { books: rest };
        }),
      updateProgress: (id, progress) =>
        set((s) => {
          const b = s.books[id];
          if (!b) return s;
          // An explicit "mark as unread" is dropped once the reader is clearly back mid-book,
          // so reaching the end again shelves the book automatically.
          const pct = progress.percentage ?? b.progress.percentage;
          const finished = b.finished === false && pct < 0.99 ? undefined : b.finished;
          return {
            books: { ...s.books, [id]: { ...b, finished, progress: { ...b.progress, ...progress, updatedAt: Date.now() } } },
          };
        }),
      setFinished: (id, finished) =>
        set((s) => {
          const b = s.books[id];
          if (!b) return s;
          return {
            books: { ...s.books, [id]: { ...b, finished, finishedAt: finished ? Date.now() : undefined } },
          };
        }),
      markOpened: (id) =>
        set((s) => {
          const b = s.books[id];
          return b ? { books: { ...s.books, [id]: { ...b, lastOpenedAt: Date.now() } } } : s;
        }),
    }),
    {
      name: 'folio-library',
      version: 1,
      storage: createJSONStorage(() => idbStorage),
      partialize: (s) => ({ books: s.books }),
    },
  ),
);
