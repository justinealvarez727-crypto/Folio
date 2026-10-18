import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { idbStorage } from '../lib/storage';
import { applyActivity, dayKey, type Activity, type DayLog } from '../lib/readingLog';

/**
 * The reading log: day → book → what was read. Kept separate from the library so it survives
 * removing a book (entries snapshot the title/author). Persisted to IndexedDB.
 */
interface LogState {
  days: DayLog;
  addActivity: (bookId: string, meta: { title: string; author: string }, a: Activity) => void;
  /** Wipe the whole log (Settings → "Clear reading log"). */
  clear: () => void;
}

export const useLogStore = create<LogState>()(
  persist(
    (set) => ({
      days: {},
      addActivity: (bookId, meta, a) =>
        set((s) => {
          const key = dayKey(a.at);
          const day = s.days[key] ?? {};
          return { days: { ...s.days, [key]: { ...day, [bookId]: applyActivity(day[bookId], meta, a) } } };
        }),
      clear: () => set({ days: {} }),
    }),
    { name: 'folio-log', version: 1, storage: createJSONStorage(() => idbStorage), partialize: (s) => ({ days: s.days }) },
  ),
);
