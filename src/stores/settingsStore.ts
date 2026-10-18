import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ReaderSettings } from '../types';

/**
 * Settings are tiny, so they persist to localStorage (synchronous). That lets
 * index.html read the theme before first paint and avoids a hydration flash.
 */
export const DEFAULT_SETTINGS: ReaderSettings = {
  theme: 'light',
  fontSize: 110,
  fontFamily: 'serif',
  lineHeight: 1.5,
  flow: 'paginated',
  margin: 'normal',
  justify: true,
  pageTurn: 'curl',
};

interface SettingsState extends ReaderSettings {
  set: <K extends keyof ReaderSettings>(key: K, value: ReaderSettings[K]) => void;
  reset: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      set: (key, value) => set({ [key]: value } as Partial<SettingsState>),
      reset: () => set({ ...DEFAULT_SETTINGS }),
    }),
    {
      name: 'folio-settings',
      version: 2,
      // v1 had no margin/justify; fill them from defaults.
      migrate: (old) => ({ ...DEFAULT_SETTINGS, ...(old as Partial<ReaderSettings>) }),
      partialize: (s): ReaderSettings => ({
        theme: s.theme,
        fontSize: s.fontSize,
        fontFamily: s.fontFamily,
        lineHeight: s.lineHeight,
        flow: s.flow,
        margin: s.margin,
        justify: s.justify,
        pageTurn: s.pageTurn,
      }),
    },
  ),
);
