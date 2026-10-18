import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { idbStorage } from '../lib/storage';
import { uid } from '../lib/id';
import type { Highlight } from '../types';

interface AnnotationState {
  highlights: Highlight[];
  addHighlight: (h: Omit<Highlight, 'id' | 'createdAt' | 'note'> & { note?: string }) => Highlight;
  updateHighlight: (id: string, patch: Partial<Pick<Highlight, 'color' | 'note'>>) => void;
  removeHighlight: (id: string) => void;
  removeByBook: (bookId: string) => void;
}

export const useAnnotationStore = create<AnnotationState>()(
  persist(
    (set) => ({
      highlights: [],
      addHighlight: (h) => {
        const highlight: Highlight = { note: '', ...h, id: uid(), createdAt: Date.now() };
        set((s) => ({ highlights: [...s.highlights, highlight] }));
        return highlight;
      },
      updateHighlight: (id, patch) =>
        set((s) => ({ highlights: s.highlights.map((h) => (h.id === id ? { ...h, ...patch } : h)) })),
      removeHighlight: (id) => set((s) => ({ highlights: s.highlights.filter((h) => h.id !== id) })),
      removeByBook: (bookId) => set((s) => ({ highlights: s.highlights.filter((h) => h.bookId !== bookId) })),
    }),
    { name: 'folio-annotations', version: 1, storage: createJSONStorage(() => idbStorage) },
  ),
);
