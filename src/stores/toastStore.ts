import { create } from 'zustand';
import { uid } from '../lib/id';

export interface Toast {
  id: string;
  message: string;
  tone: 'info' | 'success' | 'error';
  action?: { label: string; onClick: () => void };
  /** ms; 0 = sticky until dismissed */
  duration: number;
}

interface ToastState {
  toasts: Toast[];
  push: (t: Partial<Toast> & { message: string }) => string;
  dismiss: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (t) => {
    const id = uid();
    const toast: Toast = { id, tone: 'info', duration: 4000, ...t };
    set((s) => ({ toasts: [...s.toasts.slice(-2), toast] }));
    return id;
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/** Imperative helper usable outside React. */
export const toast = {
  info: (message: string, o: Partial<Toast> = {}) => useToastStore.getState().push({ message, tone: 'info', ...o }),
  success: (message: string, o: Partial<Toast> = {}) => useToastStore.getState().push({ message, tone: 'success', ...o }),
  error: (message: string, o: Partial<Toast> = {}) =>
    useToastStore.getState().push({ message, tone: 'error', duration: 6000, ...o }),
};
